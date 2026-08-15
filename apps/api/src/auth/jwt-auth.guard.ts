import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PublicUser } from '../common/utils/public-user';
import type { JwtPayload } from './auth.constants';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';

export interface AuthenticatedRequest extends Request {
  user: PublicUser;
}

/**
 * JWT 认证守卫（全局注册）。
 * - 标记 @Public() 的路由跳过认证。
 * - 未携带 / 无效 / 过期的 token → 401。
 * - token 有效但用户不存在 / 被禁用 → 401 USER_DISABLED。
 * - 用户状态每次请求都从数据库实时校验，避免仅凭 token 中的状态判断。
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('未登录或凭证缺失');
    }

    let payload: JwtPayload;
    try {
      const secret = this.configService.get<string>('JWT_SECRET');
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, { secret });
    } catch {
      throw new UnauthorizedException('登录凭证无效或已过期');
    }

    if (typeof payload.sub !== 'string' || !payload.sub) {
      throw new UnauthorizedException('登录凭证无效');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('账号已被禁用');
    }

    const { passwordHash: _passwordHash, ...publicUser } = user;
    request.user = publicUser;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | null {
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice('Bearer '.length).trim();
      return token.length > 0 ? token : null;
    }
    return null;
  }
}
