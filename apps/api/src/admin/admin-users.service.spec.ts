import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from './operation-logs.service';
import { AdminUsersService } from './admin-users.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const makeUser = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: USER_ID,
  username: 'zhangsan',
  nickname: '张三',
  passwordHash: 'hashed',
  avatar: null,
  role: 'USER',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  lastLoginAt: null,
  ...overrides,
});

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    operationLog: { create: jest.Mock };
  };
  let logService: OperationLogService;
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
  } as never;

  beforeEach(async () => {
    prisma = {
      user: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      operationLog: { create: jest.fn() },
    };
    const logPrisma = { operationLog: prisma.operationLog };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: OperationLogService, useValue: new OperationLogService(logPrisma as never) },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    logService = module.get<OperationLogService>(OperationLogService);
    jest.spyOn(logService, 'log').mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('should paginate with defaults and omit passwordHash', async () => {
      prisma.user.findMany.mockResolvedValue([makeUser()]);
      prisma.user.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
      );
      expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(result.items[0]).not.toHaveProperty('passwordHash');
      expect(result.items[0].id).toBe(USER_ID);
    });

    it('should cap pageSize at 100', async () => {
      prisma.user.findMany.mockResolvedValue([]);
      prisma.user.count.mockResolvedValue(0);

      const result = await service.list({ page: 2, pageSize: 999 });

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 100, take: 100 }),
      );
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(100);
    });
  });

  describe('getById', () => {
    it('should return a user without passwordHash', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());

      const result = await service.getById(USER_ID);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.username).toBe('zhangsan');
    });

    it('should return 404 when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.getById(USER_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'USER_NOT_FOUND', message: '用户不存在' },
      });
    });
  });

  describe('updateStatus', () => {
    it('should update a user status and write an operation log', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser());
      prisma.user.update.mockResolvedValue(makeUser({ status: 'DISABLED' }));

      const result = await service.updateStatus(ADMIN_ID, USER_ID, { status: 'DISABLED' }, request);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { status: 'DISABLED' },
      });
      expect(logService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: ADMIN_ID,
          action: 'USER_STATUS_UPDATE',
          targetType: 'User',
          targetId: USER_ID,
          metadata: { from: 'ACTIVE', to: 'DISABLED' },
        }),
      );
      expect(result.status).toBe('DISABLED');
    });

    it('should reject disabling self with 403', async () => {
      prisma.user.findUnique.mockResolvedValue(makeUser({ id: ADMIN_ID, role: 'SUPER_ADMIN' }));

      await expect(
        service.updateStatus(ADMIN_ID, ADMIN_ID, { status: 'DISABLED' }, request),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'CANNOT_DISABLE_SELF', message: '不能禁用自己' },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(logService.log).not.toHaveBeenCalled();
    });

    it('should return 404 when user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus(ADMIN_ID, USER_ID, { status: 'ACTIVE' }, request),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'USER_NOT_FOUND' },
      });
    });
  });
});
