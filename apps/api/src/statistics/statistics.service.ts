import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';

export interface RoomTotals {
  records: number;
  totalQuantity: number;
  totalVolumeMl: number;
  totalAlcoholMl: number;
}

export interface UserStatItem {
  userId: string;
  nickname: string;
  avatar: string | null;
  quantity: number;
  volumeMl: number;
  alcoholMl: number;
}

export interface ProductStatItem {
  productId: string;
  name: string;
  barcode: string;
  quantity: number;
  volumeMl: number;
}

export interface RoomStatistics {
  total: RoomTotals;
  users: UserStatItem[];
  products: ProductStatItem[];
}

interface TotalsRow {
  records: number;
  totalQuantity: unknown;
  totalVolumeMl: unknown;
  totalAlcoholMl: unknown;
}

interface UserStatRow {
  userId: string;
  nickname: string;
  avatar: string | null;
  quantity: unknown;
  volumeMl: unknown;
  alcoholMl: unknown;
}

interface ProductStatRow {
  productId: string;
  name: string;
  barcode: string;
  quantity: unknown;
  volumeMl: unknown;
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRoomStatistics(userId: string, roomId: string): Promise<RoomStatistics> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const [totalsRows, userRows, productRows] = await Promise.all([
      this.prisma.$queryRaw<TotalsRow[]>`
        SELECT
          COUNT(*)::int AS records,
          COALESCE(SUM(quantity), 0) AS "totalQuantity",
          COALESCE(SUM(quantity * "volumeMlSnapshot"), 0) AS "totalVolumeMl",
          COALESCE(
            SUM(quantity * "volumeMlSnapshot" * COALESCE("alcoholPercentSnapshot", 0) / 100),
            0
          ) AS "totalAlcoholMl"
        FROM "DrinkRecord"
        WHERE "roomId" = ${roomId}::uuid AND "deletedAt" IS NULL
      `,
      this.prisma.$queryRaw<UserStatRow[]>`
        SELECT
          d."userId",
          u."nickname",
          u."avatar",
          COALESCE(SUM(d.quantity), 0) AS quantity,
          COALESCE(SUM(d.quantity * d."volumeMlSnapshot"), 0) AS "volumeMl",
          COALESCE(
            SUM(d.quantity * d."volumeMlSnapshot" * COALESCE(d."alcoholPercentSnapshot", 0) / 100),
            0
          ) AS "alcoholMl"
        FROM "DrinkRecord" d
        JOIN "User" u ON u."id" = d."userId"
        WHERE d."roomId" = ${roomId}::uuid AND d."deletedAt" IS NULL
        GROUP BY d."userId", u."nickname", u."avatar"
        ORDER BY "alcoholMl" DESC
      `,
      this.prisma.$queryRaw<ProductStatRow[]>`
        SELECT
          d."productId",
          p."name",
          p."barcode",
          COALESCE(SUM(d.quantity), 0) AS quantity,
          COALESCE(SUM(d.quantity * d."volumeMlSnapshot"), 0) AS "volumeMl"
        FROM "DrinkRecord" d
        JOIN "Product" p ON p."id" = d."productId"
        WHERE d."roomId" = ${roomId}::uuid AND d."deletedAt" IS NULL
        GROUP BY d."productId", p."name", p."barcode"
        ORDER BY quantity DESC
      `,
    ]);

    const totalsRow = totalsRows[0];

    return {
      total: {
        records: totalsRow?.records ?? 0,
        totalQuantity: toNumber(totalsRow?.totalQuantity),
        totalVolumeMl: toNumber(totalsRow?.totalVolumeMl),
        totalAlcoholMl: toNumber(totalsRow?.totalAlcoholMl),
      },
      users: userRows.map((row) => ({
        userId: row.userId,
        nickname: row.nickname,
        avatar: row.avatar,
        quantity: toNumber(row.quantity),
        volumeMl: toNumber(row.volumeMl),
        alcoholMl: toNumber(row.alcoholMl),
      })),
      products: productRows.map((row) => ({
        productId: row.productId,
        name: row.name,
        barcode: row.barcode,
        quantity: toNumber(row.quantity),
        volumeMl: toNumber(row.volumeMl),
      })),
    };
  }
}
