import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from './operation-logs.service';
import { AdminRoomsService } from './admin-rooms.service';

const ROOM_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';

const makeRoom = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: ROOM_ID,
  name: '周末朋友酒局',
  ownerId: ADMIN_ID,
  inviteCode: 'A7K92P',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  endedAt: null,
  ...overrides,
});

const makeDrink = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'drink-1',
  roomId: ROOM_ID,
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
  deletedAt: null,
  deletedBy: null,
  deleteReason: null,
  user: { id: 'u1', nickname: '张三' },
  createdByUser: { id: 'u1', nickname: '张三' },
  product: { id: 'p1', name: 'XX啤酒' },
  ...overrides,
});

describe('AdminRoomsService', () => {
  let service: AdminRoomsService;
  let prisma: {
    room: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    roomMember: { findMany: jest.Mock };
    drinkRecord: { findMany: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
    operationLog: { create: jest.Mock };
  };
  let logService: OperationLogService;
  const request = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as never;

  beforeEach(async () => {
    prisma = {
      room: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      roomMember: { findMany: jest.fn() },
      drinkRecord: { findMany: jest.fn(), count: jest.fn() },
      $queryRaw: jest.fn(),
      operationLog: { create: jest.fn() },
    };
    const logPrisma = { operationLog: prisma.operationLog };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRoomsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OperationLogService, useValue: new OperationLogService(logPrisma as never) },
      ],
    }).compile();

    service = module.get<AdminRoomsService>(AdminRoomsService);
    logService = module.get<OperationLogService>(OperationLogService);
    jest.spyOn(logService, 'log').mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('should pass keyword search filter', async () => {
      prisma.room.findMany.mockResolvedValue([]);
      prisma.room.count.mockResolvedValue(0);

      await service.list({ keyword: '酒局' });

      const where = prisma.room.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });
  });

  describe('getById', () => {
    it('should aggregate stats from queryRaw', async () => {
      prisma.room.findUnique.mockResolvedValue({
        ...makeRoom(),
        owner: { id: ADMIN_ID, username: 'admin', nickname: '管理员' },
        _count: { members: 2, drinkRecords: 3 },
      });
      prisma.$queryRaw.mockResolvedValue([
        { totalQuantity: 6, totalVolumeMl: 3000, totalAlcoholMl: 120 },
      ]);

      const result = await service.getById(ROOM_ID);

      expect(result.memberCount).toBe(2);
      expect(result.drinkRecordCount).toBe(3);
      expect(result.stats.totalVolumeMl).toBe(3000);
    });
  });

  describe('listMembers', () => {
    it('should sort OWNER first', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom());
      prisma.roomMember.findMany.mockResolvedValue([
        { id: 'm2', roomId: ROOM_ID, userId: 'b', role: 'MEMBER', joinedAt: new Date('2026-08-15T06:00:00Z'), user: { nickname: '李四', avatar: null } },
        { id: 'm1', roomId: ROOM_ID, userId: 'a', role: 'OWNER', joinedAt: new Date('2026-08-15T05:00:00Z'), user: { nickname: '张三', avatar: null } },
      ]);

      const result = await service.listMembers(ROOM_ID);

      expect(result[0].role).toBe('OWNER');
      expect(result[0].userId).toBe('a');
    });
  });

  describe('listDrinks', () => {
    it('should include deleted records for admin', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findMany.mockResolvedValue([makeDrink({ deletedAt: new Date() })]);
      prisma.drinkRecord.count.mockResolvedValue(1);

      const result = await service.listDrinks(ROOM_ID, {});

      expect(result.items[0].deletedAt).toBeInstanceOf(Date);
      expect(result.total).toBe(1);
    });
  });

  describe('endRoom', () => {
    it('should end an ACTIVE room and log', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom());
      prisma.room.update.mockResolvedValue(makeRoom({ status: 'ENDED', endedAt: new Date() }));

      const result = await service.endRoom(ADMIN_ID, ROOM_ID, request);

      expect(result.status).toBe('ENDED');
      expect(logService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ROOM_END' }),
      );
    });

    it('should reject ending an already-ended room', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom({ status: 'ENDED' }));

      await expect(service.endRoom(ADMIN_ID, ROOM_ID, request)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ROOM_ALREADY_ENDED' },
      });
    });
  });

  describe('exportCsv', () => {
    it('should build CSV with header and rows', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findMany.mockResolvedValue([makeDrink()]);

      const result = await service.exportCsv(ROOM_ID);

      expect(result.filename).toContain('.csv');
      expect(result.csv).toContain('用户');
      expect(result.csv).toContain('酒品');
      expect(result.csv).toContain('张三');
      expect(result.csv).toContain('XX啤酒');
    });
  });
});
