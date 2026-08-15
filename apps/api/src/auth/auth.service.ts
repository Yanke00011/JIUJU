import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { toPublicUser, PublicUser } from '../common/utils/public-user';
import { ARGON2_OPTIONS, JwtPayload } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { BusinessException } from '../common/exceptions/business.exception';

/**
 * Argon2id 校验失败时的虚拟比对结果，
 * 用于用户名不存在时仍消耗相当的哈希校验时间，防止用户枚举。
 */
const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export interface LoginResult {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<PublicUser> {
    const username = dto.username.trim();
    const nickname = dto.nickname.trim();

    const existing = await this.prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new BusinessException('USERNAME_TAKEN', '用户名已被占用', HttpStatus.CONFLICT);
    }

    const passwordHash = await hash(dto.password, ARGON2_OPTIONS);
    const user = await this.prisma.user.create({
      data: { username, nickname, passwordHash },
    });

    return toPublicUser(user);
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const username = dto.username.trim();
    const user = await this.prisma.user.findUnique({ where: { username } });

    if (!user) {
      await verify(DUMMY_PASSWORD_HASH, dto.password).catch(() => undefined);
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.status !== 'ACTIVE') {
      await verify(DUMMY_PASSWORD_HASH, dto.password).catch(() => undefined);
      throw new UnauthorizedException('用户名或密码错误');
    }

    const passwordValid = await verify(user.passwordHash, dto.password).catch(() => false);
    if (!passwordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    const expiresIn = this.jwtService.decode(accessToken) as { exp?: number } | null;

    await this.prisma.$executeRaw`
      UPDATE "User" SET "lastLoginAt" = now() WHERE "id" = ${user.id}::uuid
    `;

    const freshUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: expiresIn?.exp ? Math.max(0, expiresIn.exp - Math.floor(Date.now() / 1000)) : 0,
      user: toPublicUser(freshUser),
    };
  }
}
