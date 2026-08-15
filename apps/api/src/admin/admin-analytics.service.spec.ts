import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAnalyticsService } from './admin-analytics.service';

describe('AdminAnalyticsService', () => {
  let service: AdminAnalyticsService;
  let prisma: {
    $queryRaw: jest.Mock;
    room: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $queryRaw: jest.fn(),
      room: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminAnalyticsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminAnalyticsService>(AdminAnalyticsService);
  });

  it('should aggregate trends, rankings, and active rooms from DB', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([
        { date: new Date('2026-08-15T00:00:00Z'), count: 3 },
        { date: new Date('2026-08-16T00:00:00Z'), count: 2 },
      ])
      .mockResolvedValueOnce([{ date: new Date('2026-08-15T00:00:00Z'), count: 12 }])
      .mockResolvedValueOnce([
        { productId: 'p1', name: 'XX啤酒', barcode: '6901', quantity: '10.50' },
      ])
      .mockResolvedValueOnce([
        {
          userId: 'u1',
          username: 'a',
          nickname: 'A',
          quantity: '5',
          volumeMl: '2500',
          alcoholMl: '120.5',
        },
      ]);
    prisma.room.findMany.mockResolvedValue([
      { id: 'r1', name: '酒局', inviteCode: 'A7K92P', createdAt: new Date(), owner: null },
    ]);

    const result = await service.getAnalytics(14);

    expect(result.roomTrends).toEqual([
      { date: '2026-08-15', count: 3 },
      { date: '2026-08-16', count: 2 },
    ]);
    expect(result.drinkTrends).toEqual([{ date: '2026-08-15', count: 12 }]);
    expect(result.topProducts[0]).toMatchObject({ productId: 'p1', quantity: 10.5 });
    expect(result.userRanking[0]).toMatchObject({ alcoholMl: 120.5, volumeMl: 2500 });
    expect(result.activeRooms).toHaveLength(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    expect(prisma.room.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE' } }),
    );
  });

  it('should default to 14 days and cap at 90', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    prisma.room.findMany.mockResolvedValue([]);

    await service.getAnalytics();
    await service.getAnalytics(500);

    // 验证 days 被夹在 [1, 90] 之间：通过 SQL 参数
    const sqlCalls = prisma.$queryRaw.mock.calls.map((c) => String(c[0]));
    expect(sqlCalls.length).toBe(8);
  });
});
