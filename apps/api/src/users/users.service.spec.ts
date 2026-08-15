import { Test, TestingModule } from '@nestjs/testing';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UserService } from './users.service';

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
  ...overrides,
});

describe('UserService', () => {
  let service: UserService;
  let prisma: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  describe('getMe', () => {
    it('should return public user without passwordHash', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.getMe(user.id);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: user.id } });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('zhangsan');
      expect(result.updatedAt).toBeInstanceOf(Date);
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getMe('missing')).rejects.toMatchObject({
        status: 404,
        response: { code: 'USER_NOT_FOUND', message: '用户不存在' },
      });
    });
  });

  describe('updateMe', () => {
    it('should update nickname only and keep username/role/status', async () => {
      const user = makeUser();
      const updated = makeUser({
        nickname: '李四',
        updatedAt: new Date('2026-08-15T05:00:00.000Z'),
      });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(user.id, { nickname: ' 李四 ' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { nickname: '李四' },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.nickname).toBe('李四');
      expect(result.username).toBe('zhangsan');
      expect(result.role).toBe('USER');
      expect(result.status).toBe('ACTIVE');
    });

    it('should update avatar', async () => {
      const user = makeUser();
      const updated = makeUser({ avatar: 'https://example.com/avatar.jpg' });
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updated);

      const result = await service.updateMe(user.id, {
        avatar: 'https://example.com/avatar.jpg',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { avatar: 'https://example.com/avatar.jpg' },
      });
      expect(result.avatar).toBe('https://example.com/avatar.jpg');
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NOT_FOUND when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.updateMe('missing', { nickname: '李四' })).rejects.toMatchObject({
        status: 404,
        response: { code: 'USER_NOT_FOUND', message: '用户不存在' },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should never allow modifying role', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(makeUser({ role: 'ADMIN' }));

      const result = await service.updateMe(user.id, {});

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('role');
      expect(result.role).toBe('ADMIN'); // 只反映 DB 现状，绝不从 DTO 写入 role
    });

    it('should never allow modifying status', async () => {
      const user = makeUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(makeUser());

      await service.updateMe(user.id, {});

      const data = prisma.user.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('status');
    });
  });
});
