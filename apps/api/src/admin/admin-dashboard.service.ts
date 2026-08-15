import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminDashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalRooms: number;
  activeRooms: number;
  totalDrinkRecords: number;
  totalProducts: number;
}

export interface RecentRoomItem {
  id: string;
  name: string;
  status: string;
  createdAt: Date;
  owner: { id: string; username: string; nickname: string } | null;
}

export interface RecentLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  admin: { id: string; username: string } | null;
}

export interface AdminDashboardResult {
  stats: AdminDashboardStats;
  recentRooms: RecentRoomItem[];
  recentLogs: RecentLogItem[];
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(): Promise<AdminDashboardResult> {
    const [
      totalUsers,
      activeUsers,
      totalRooms,
      activeRooms,
      totalDrinkRecords,
      totalProducts,
      recentRooms,
      recentLogs,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.room.count(),
      this.prisma.room.count({ where: { status: 'ACTIVE' } }),
      this.prisma.drinkRecord.count(),
      this.prisma.product.count(),
      this.prisma.room.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, username: true, nickname: true } } },
      }),
      this.prisma.operationLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { admin: { select: { id: true, username: true } } },
      }),
    ]);

    return {
      stats: {
        totalUsers,
        activeUsers,
        totalRooms,
        activeRooms,
        totalDrinkRecords,
        totalProducts,
      },
      recentRooms: recentRooms.map((r) => ({
        id: r.id,
        name: r.name,
        status: r.status,
        createdAt: r.createdAt,
        owner: r.owner,
      })),
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        targetType: l.targetType,
        targetId: l.targetId,
        createdAt: l.createdAt,
        admin: l.admin,
      })),
    };
  }
}
