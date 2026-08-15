import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminDashboardService } from './admin-dashboard.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let prisma: {
    user: { count: jest.Mock };
    room: { count: jest.Mock; findMany: jest.Mock };
    drinkRecord: { count: jest.Mock };
    product: { count: jest.Mock };
    operationLog: { findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn() },
      room: { count: jest.fn(), findMany: jest.fn() },
      drinkRecord: { count: jest.fn() },
      product: { count: jest.fn() },
      operationLog: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminDashboardService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  it('should return stats, recent rooms, and recent logs', async () => {
    prisma.user.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(8);
    prisma.room.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(3);
    prisma.drinkRecord.count.mockResolvedValue(50);
    prisma.product.count.mockResolvedValue(20);
    prisma.room.findMany.mockResolvedValue([]);
    prisma.operationLog.findMany.mockResolvedValue([]);

    const result = await service.getDashboard();

    expect(result.stats).toEqual({
      totalUsers: 10,
      activeUsers: 8,
      totalRooms: 5,
      activeRooms: 3,
      totalDrinkRecords: 50,
      totalProducts: 20,
    });
    expect(result.recentRooms).toEqual([]);
    expect(result.recentLogs).toEqual([]);
  });
});
