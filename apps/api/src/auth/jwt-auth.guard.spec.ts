import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const buildRequest = (authorization?: string) =>
  ({
    headers: authorization ? { authorization } : {},
  }) as unknown as import('express').Request;

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let prisma: {
    user: { findUnique: jest.Mock };
  };
  let jwt: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let config: { get: jest.Mock };
  let context: {
    getHandler: jest.Mock;
    getClass: jest.Mock;
    switchToHttp: jest.Mock;
  };
  let request: import('express').Request & { user?: unknown };

  const USER = {
    id: '11111111-1111-4111-8111-111111111111',
    username: 'zhangsan',
    nickname: '张三',
    passwordHash: 'hashed',
    avatar: null,
    role: 'USER',
    status: 'ACTIVE',
    createdAt: new Date('2026-08-15T04:10:20.000Z'),
    updatedAt: new Date('2026-08-15T04:10:20.000Z'),
    lastLoginAt: null,
    deletedAt: null,
  };

  beforeEach(() => {
    prisma = { user: { findUnique: jest.fn() } };
    jwt = { verifyAsync: jest.fn() };
    reflector = { getAllAndOverride: jest.fn() };
    config = { get: jest.fn().mockReturnValue('test-secret') };
    request = {} as import('express').Request;

    guard = new JwtAuthGuard(
      reflector as unknown as Reflector,
      jwt as unknown as JwtService,
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    );

    context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({ getRequest: jest.fn().mockReturnValue(request) }),
    };
  });

  it('should allow public routes without token', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);

    await expect(guard.canActivate(context as never)).resolves.toBe(true);
  });

  it('should throw 401 when no token is provided', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    request = buildRequest();
    context.switchToHttp.mockReturnValue({ getRequest: () => request });

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw 401 when token is invalid', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    request = buildRequest('Bearer invalid.token.value');
    context.switchToHttp.mockReturnValue({ getRequest: () => request });
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw 401 when token is expired', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    request = buildRequest('Bearer expired.token.value');
    context.switchToHttp.mockReturnValue({ getRequest: () => request });
    jwt.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw 401 when token is valid but user does not exist', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    request = buildRequest('Bearer valid.token.value');
    context.switchToHttp.mockReturnValue({ getRequest: () => request });
    jwt.verifyAsync.mockResolvedValue({ sub: USER.id, role: 'USER' });
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('should throw 401 USER_DISABLED when user is disabled', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    request = buildRequest('Bearer valid.token.value');
    context.switchToHttp.mockReturnValue({ getRequest: () => request });
    jwt.verifyAsync.mockResolvedValue({ sub: USER.id, role: 'USER' });
    prisma.user.findUnique.mockResolvedValue({ ...USER, status: 'DISABLED' });

    await expect(guard.canActivate(context as never)).rejects.toThrow(UnauthorizedException);
  });

  it('should attach public user without passwordHash on success', async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    request = buildRequest('Bearer valid.token.value');
    context.switchToHttp.mockReturnValue({ getRequest: () => request });
    jwt.verifyAsync.mockResolvedValue({ sub: USER.id, role: 'USER' });
    prisma.user.findUnique.mockResolvedValue(USER);

    const allowed = await guard.canActivate(context as never);
    expect(allowed).toBe(true);
    expect(request.user).toBeDefined();
    expect(request.user).not.toHaveProperty('passwordHash');
    expect((request.user as { id: string }).id).toBe(USER.id);
  });
});
