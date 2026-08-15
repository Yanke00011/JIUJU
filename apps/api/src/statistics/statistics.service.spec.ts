import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { StatisticsService } from './statistics.service';

const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_MEMBER_ID = '55555555-5555-4555-8555-555555555555';

const makeMembership = (userId: string) => ({
  id: 'm1',
  roomId: ROOM_ID,
  userId,
  role: 'MEMBER',
  joinedAt: new Date('2026-08-15T04:10:20.000Z'),
});

describe('StatisticsService', () => {
  let service: StatisticsService;
  let prisma: {
    roomMember: { findUnique: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      roomMember: { findUnique: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [StatisticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<StatisticsService>(StatisticsService);
  });

  describe('getRoomStatistics', () => {
    it('should return empty statistics for an empty room', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 0, totalQuantity: 0, totalVolumeMl: 0, totalAlcoholMl: 0 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      expect(result).toEqual({
        total: { records: 0, totalQuantity: 0, totalVolumeMl: 0, totalAlcoholMl: 0 },
        users: [],
        products: [],
      });
    });

    it('should aggregate a single drink record with alcohol formula', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 1, totalQuantity: 2, totalVolumeMl: 1000, totalAlcoholMl: 40 },
        ])
        .mockResolvedValueOnce([
          {
            userId: MEMBER_ID,
            nickname: '李四',
            avatar: null,
            quantity: 2,
            volumeMl: 1000,
            alcoholMl: 40,
          },
        ])
        .mockResolvedValueOnce([
          {
            productId: '44444444-4444-4444-8444-444444444444',
            name: 'XX啤酒',
            barcode: '6901234567890',
            quantity: 2,
            volumeMl: 1000,
          },
        ]);

      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      // 500ml × 4% × 2 = 40ml 酒精
      expect(result.total).toEqual({
        records: 1,
        totalQuantity: 2,
        totalVolumeMl: 1000,
        totalAlcoholMl: 40,
      });
      expect(result.users).toHaveLength(1);
      expect(result.users[0]).toMatchObject({ userId: MEMBER_ID, quantity: 2, alcoholMl: 40 });
      expect(result.products).toHaveLength(1);
      expect(result.products[0]).toMatchObject({ quantity: 2, volumeMl: 1000 });
    });

    it('should convert Decimal to number in responses', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 1, totalQuantity: '12.50', totalVolumeMl: '6250', totalAlcoholMl: '12.5' },
        ])
        .mockResolvedValueOnce([
          {
            userId: MEMBER_ID,
            nickname: '李四',
            avatar: null,
            quantity: '12.50',
            volumeMl: '6250',
            alcoholMl: '12.5',
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      expect(result.total.totalQuantity).toBe(12.5);
      expect(result.total.totalAlcoholMl).toBe(12.5);
      expect(result.users[0].quantity).toBe(12.5);
    });

    it('should rank users by alcoholMl DESC', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 2, totalQuantity: 6, totalVolumeMl: 3000, totalAlcoholMl: 120 },
        ])
        .mockResolvedValueOnce([
          {
            userId: OWNER_ID,
            nickname: 'A',
            avatar: null,
            quantity: 2,
            volumeMl: 1000,
            alcoholMl: 80,
          },
          {
            userId: MEMBER_ID,
            nickname: 'B',
            avatar: null,
            quantity: 1,
            volumeMl: 500,
            alcoholMl: 20,
          },
          {
            userId: OTHER_MEMBER_ID,
            nickname: 'C',
            avatar: null,
            quantity: 3,
            volumeMl: 1500,
            alcoholMl: 20,
          },
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      expect(result.users[0].alcoholMl).toBe(80);
      expect(result.users[0].userId).toBe(OWNER_ID);
      // 酒精量相同的 B 与 C 保持稳定（结果集由 SQL ORDER BY 决定）
      expect(result.users.length).toBe(3);
    });

    it('should rank products by quantity DESC', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 2, totalQuantity: 12, totalVolumeMl: 6000, totalAlcoholMl: 200 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { productId: 'p2', name: '多', barcode: '2', quantity: 9, volumeMl: 4500 },
          { productId: 'p1', name: '少', barcode: '1', quantity: 3, volumeMl: 1500 },
        ]);

      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      expect(result.products[0].productId).toBe('p2');
      expect(result.products[0].quantity).toBe(9);
    });

    it('should not count soft-deleted records (SQL excludes deletedAt IS NOT NULL)', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 5, totalQuantity: 5, totalVolumeMl: 2500, totalAlcoholMl: 100 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      expect(result.total.records).toBe(5);
      // 验证 SQL 包含 deletedAt IS NULL 过滤
      const sqlCalls = prisma.$queryRaw.mock.calls.map((c) => String(c[0]));
      for (const sql of sqlCalls) {
        expect(sql).toContain('"deletedAt" IS NULL');
      }
    });

    it('should return 404 for a non-member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.getRoomStatistics(MEMBER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('should allow members to view statistics of an ENDED room', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { records: 3, totalQuantity: 3, totalVolumeMl: 1500, totalAlcoholMl: 60 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      // 服务不校验房间状态，ENDED 房间仅需成员身份即可查看
      const result = await service.getRoomStatistics(MEMBER_ID, ROOM_ID);

      expect(result.total.records).toBe(3);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(3);
    });
  });
});
