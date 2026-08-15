import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from './operation-logs.service';
import { AdminDrinksService } from './admin-drinks.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const DRINK_ID = '22222222-2222-4222-8222-222222222222';

const makeDrink = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: DRINK_ID,
  roomId: 'r1',
  productId: 'p1',
  userId: 'u1',
  createdBy: 'u1',
  barcode: '6901234567890',
  volumeMlSnapshot: 500,
  alcoholPercentSnapshot: { toNumber: () => 4.3, toString: () => '4.3' },
  quantity: { toNumber: () => 2, toString: () => '2' },
  clientRequestId: 'c1',
  createdAt: new Date('2026-08-15T05:00:00Z'),
  updatedAt: new Date('2026-08-15T05:00:00Z'),
  deletedAt: new Date('2026-08-15T06:00:00Z'),
  deletedBy: 'u2',
  deleteReason: null,
  user: { id: 'u1', username: 'zhangsan', nickname: '张三' },
  createdByUser: { id: 'u1', username: 'zhangsan', nickname: '张三' },
  deletedByUser: { id: 'u2', username: 'lisi', nickname: '李四' },
  product: { id: 'p1', name: 'XX啤酒', barcode: '6901234567890' },
  room: { id: 'r1', name: '酒局', inviteCode: 'A7K92P' },
  ...overrides,
});

describe('AdminDrinksService', () => {
  let service: AdminDrinksService;
  let prisma: {
    drinkRecord: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    operationLog: { create: jest.Mock };
  };
  let logService: OperationLogService;

  beforeEach(async () => {
    prisma = {
      drinkRecord: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      operationLog: { create: jest.fn() },
    };
    const logPrisma = { operationLog: prisma.operationLog };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDrinksService,
        { provide: PrismaService, useValue: prisma },
        { provide: OperationLogService, useValue: new OperationLogService(logPrisma as never) },
      ],
    }).compile();

    service = module.get<AdminDrinksService>(AdminDrinksService);
    logService = module.get<OperationLogService>(OperationLogService);
    jest.spyOn(logService, 'log').mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('should pass filters (room/user/product/time)', async () => {
      prisma.drinkRecord.findMany.mockResolvedValue([]);
      prisma.drinkRecord.count.mockResolvedValue(0);

      await service.list({ roomId: 'r1', userId: 'u1', startDate: '2026-08-01T00:00:00Z' });

      const where = prisma.drinkRecord.findMany.mock.calls[0][0].where;
      expect(where.roomId).toBe('r1');
      expect(where.userId).toBe('u1');
      expect(where.createdAt.gte).toBeInstanceOf(Date);
    });
  });

  describe('restore', () => {
    it('should restore a soft-deleted record and log', async () => {
      prisma.drinkRecord.findUnique.mockResolvedValue(makeDrink());
      prisma.drinkRecord.update.mockResolvedValue(makeDrink({ deletedAt: null, deletedBy: null }));

      const result = await service.restore(ADMIN_ID, DRINK_ID);

      expect(prisma.drinkRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ deletedAt: null }),
        }),
      );
      expect(result.deletedAt).toBeNull();
      expect(logService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DRINK_RECORD_RESTORE' }),
      );
    });

    it('should return 404 when record does not exist', async () => {
      prisma.drinkRecord.findUnique.mockResolvedValue(null);

      await expect(service.restore(ADMIN_ID, DRINK_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'DRINK_RECORD_NOT_FOUND' },
      });
    });

    it('should reject restoring a non-deleted record', async () => {
      prisma.drinkRecord.findUnique.mockResolvedValue(makeDrink({ deletedAt: null }));

      await expect(service.restore(ADMIN_ID, DRINK_ID)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'DRINK_RECORD_NOT_DELETED' },
      });
    });
  });
});
