import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { hash, verify } from '@node-rs/argon2';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { ARGON2_OPTIONS } from './auth.constants';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: '11111111-1111-4111-8111-111111111111',
  username: 'zhangsan',
  nickname: '张三',
  passwordHash: 'hashed-password',
  avatar: null,
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  lastLoginAt: null,
  deletedAt: null,
  ...overrides,
});

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findUniqueOrThrow: jest.Mock;
    };
    $executeRaw: jest.Mock;
  };
  let jwt: { signAsync: jest.Mock; decode: jest.Mock };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
      decode: jest.fn().mockReturnValue({ exp: Math.floor(Date.now() / 1000) + 3600 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('should register a user and return public user without passwordHash', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(user);

      const result = await service.register({
        username: '  zhangsan  ',
        nickname: ' 张三 ',
        password: 'Password123',
      });

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          username: 'zhangsan',
          nickname: '张三',
          passwordHash: expect.any(String),
        },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('zhangsan');
    });

    it('should hash the password with Argon2id and not store plaintext', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const user = makeUser();
      prisma.user.create.mockImplementation(
        async ({ data }: { data: { passwordHash: string } }) => ({
          ...user,
          passwordHash: data.passwordHash,
        }),
      );

      const result = await service.register({
        username: 'zhangsan',
        nickname: '张三',
        password: 'Password123',
      });

      expect(result).not.toHaveProperty('passwordHash');
      const created = prisma.user.create.mock.calls[0][0].data;
      expect(created.passwordHash).not.toContain('Password123');
      expect(created.passwordHash.startsWith('$argon2id$')).toBe(true);
      expect(await verify(created.passwordHash, 'Password123')).toBe(true);
    });

    it('should throw CONFLICT when username already taken', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(
        service.register({ username: 'zhangsan', nickname: '张三', password: 'Password123' }),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: 'USERNAME_TAKEN', message: '用户名已被占用' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should return token and public user, and update lastLoginAt with DB time', async () => {
      const user = makeUser({ lastLoginAt: new Date('2026-08-15T05:00:00.000Z') });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);
      // passwordHash 必须是真实 argon2 hash 才能通过校验
      user.passwordHash = await hash('Password123', ARGON2_OPTIONS);

      const result = await service.login({ username: 'zhangsan', password: 'Password123' });

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt');
      expect(result.tokenType).toBe('Bearer');
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user.username).toBe('zhangsan');
    });

    it('should throw INVALID_CREDENTIALS on wrong password without leaking user', async () => {
      const user = makeUser();
      user.passwordHash = await hash('Password123', ARGON2_OPTIONS);
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ username: 'zhangsan', password: 'WrongPass123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should throw INVALID_CREDENTIALS for nonexistent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ username: 'nobody', password: 'Password123' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should throw INVALID_CREDENTIALS for disabled user', async () => {
      const user = makeUser({ status: 'DISABLED' });
      user.passwordHash = await hash('Password123', ARGON2_OPTIONS);
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.login({ username: 'zhangsan', password: 'Password123' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });
  });

  describe('JWT payload', () => {
    it('should sign JWT with only sub and role', async () => {
      const user = makeUser();
      user.passwordHash = await hash('Password123', ARGON2_OPTIONS);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.findUniqueOrThrow.mockResolvedValue(user);

      await service.login({ username: 'zhangsan', password: 'Password123' });

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: user.id,
        role: 'USER',
      });
      expect(jwt.signAsync).not.toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
    });
  });
});
