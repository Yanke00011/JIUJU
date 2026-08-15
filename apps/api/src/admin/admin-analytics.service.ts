import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface TrendPoint {
  date: string;
  count: number;
}

export interface TopProductItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
}

export interface UserRankItem {
  userId: string;
  username: string;
  nickname: string;
  quantity: number;
  volumeMl: number;
  alcoholMl: number;
}

export interface ActiveRoomItem {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: Date;
  owner: { id: string; username: string; nickname: string } | null;
}

export interface AdminAnalyticsResult {
  roomTrends: TrendPoint[];
  drinkTrends: TrendPoint[];
  topProducts: TopProductItem[];
  userRanking: UserRankItem[];
  activeRooms: ActiveRoomItem[];
}

const DEFAULT_DAYS = 14;
const MAX_DAYS = 90;

interface TrendRow {
  date: Date;
  count: number;
}

interface TopProductRow {
  productId: string;
  name: string;
  barcode: string;
  quantity: unknown;
}

interface UserRankRow {
  userId: string;
  username: string;
  nickname: string;
  quantity: unknown;
  volumeMl: unknown;
  alcoholMl: unknown;
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class AdminAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAnalytics(days?: number): Promise<AdminAnalyticsResult> {
    const dayCount = Math.min(Math.max(days ?? DEFAULT_DAYS, 1), MAX_DAYS);

    const [roomTrends, drinkTrends, topProducts, userRanking, activeRooms] = await Promise.all([
      this.prisma.$queryRaw<TrendRow[]>`
          SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
          FROM "Room"
          WHERE "createdAt" >= NOW() - (${dayCount} || ' days')::interval
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `,
      this.prisma.$queryRaw<TrendRow[]>`
          SELECT DATE("createdAt") AS date, COUNT(*)::int AS count
          FROM "DrinkRecord"
          WHERE "createdAt" >= NOW() - (${dayCount} || ' days')::interval
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `,
      this.prisma.$queryRaw<TopProductRow[]>`
          SELECT
            d."productId",
            p."name",
            p."barcode",
            COALESCE(SUM(d.quantity), 0) AS quantity
          FROM "DrinkRecord" d
          JOIN "Product" p ON p."id" = d."productId"
          WHERE d."deletedAt" IS NULL
          GROUP BY d."productId", p."name", p."barcode"
          ORDER BY quantity DESC
          LIMIT 10
        `,
      this.prisma.$queryRaw<UserRankRow[]>`
          SELECT
            u."id" AS "userId",
            u."username",
            u."nickname",
            COALESCE(SUM(d.quantity), 0) AS quantity,
            COALESCE(SUM(d.quantity * d."volumeMlSnapshot"), 0) AS "volumeMl",
            COALESCE(
              SUM(d.quantity * d."volumeMlSnapshot" * COALESCE(d."alcoholPercentSnapshot", 0) / 100),
              0
            ) AS "alcoholMl"
          FROM "DrinkRecord" d
          JOIN "User" u ON u."id" = d."userId"
          WHERE d."deletedAt" IS NULL
          GROUP BY u."id", u."username", u."nickname"
          ORDER BY "alcoholMl" DESC
          LIMIT 10
        `,
      this.prisma.room.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { owner: { select: { id: true, username: true, nickname: true } } },
      }),
    ]);

    return {
      roomTrends: roomTrends.map((r) => ({
        date: this.toDateString(r.date),
        count: r.count,
      })),
      drinkTrends: drinkTrends.map((r) => ({
        date: this.toDateString(r.date),
        count: r.count,
      })),
      topProducts: topProducts.map((r) => ({
        productId: r.productId,
        name: r.name,
        barcode: r.barcode,
        quantity: toNumber(r.quantity),
      })),
      userRanking: userRanking.map((r) => ({
        userId: r.userId,
        username: r.username,
        nickname: r.nickname,
        quantity: toNumber(r.quantity),
        volumeMl: toNumber(r.volumeMl),
        alcoholMl: toNumber(r.alcoholMl),
      })),
      activeRooms: activeRooms.map((r) => ({
        id: r.id,
        name: r.name,
        inviteCode: r.inviteCode,
        createdAt: r.createdAt,
        owner: r.owner,
      })),
    };
  }

  private toDateString(date: Date): string {
    // 转为 YYYY-MM-DD（UTC）
    return date.toISOString().slice(0, 10);
  }
}
