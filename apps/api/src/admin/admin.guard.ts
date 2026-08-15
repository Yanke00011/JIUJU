import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessException } from '../common/exceptions/business.exception';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';

/**
 * Admin 守卫：仅 ADMIN / SUPER_ADMIN 可访问。
 * 复用 JwtAuthGuard（全局）注入的 request.user（身份来自 JWT sub）。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & Request>();
    const user = request.user;
    if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
      throw new BusinessException('FORBIDDEN', '无管理员权限', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
