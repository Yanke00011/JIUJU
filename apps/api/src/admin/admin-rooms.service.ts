import { HttpStatus, Injectable } from '@nestjs/common';
import type { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination, PaginationQuery } from '../common/utils/pagination';

export interface AdminRoomItem {
  id: string;
  name: string;
  owner: { id: string; username: string; nickname: string } | null;
  memberCount: number;
  status: Room['status'];
  createdAt: Date;
  endedAt: Date | null;
}

export interface AdminRoomDetail extends AdminRoomItem {
  drinkRecordCount: number;
  stats: {
    totalQuantity: number;
    totalVolumeMl: number;
    totalAlcoholMl: number;
  };
}

interface RoomWithCounts {
  id: string;
  name: string;
  ownerId: string;
  status: Room['status'];
  createdAt: Date;
  endedAt: Date | null;
  owner: { id: string; username: string; nickname: string } | null;
  _count: { members: number };
}

interface DrinkAggRow {
  totalQuantity: unknown;
  totalVolumeMl: unknown;
  totalAlcoholMl: unknown;
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

@Injectable()
export class AdminRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PaginationQuery): Promise<PageResult<AdminRoomItem>> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, username: true, nickname: true } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.room.count(),
    ]);

    return {
      items: (rooms as unknown as RoomWithCounts[]).map((room) => ({
        id: room.id,
        name: room.name,
        owner: room.owner,
        memberCount: room._count.members,
        status: room.status,
        createdAt: room.createdAt,
        endedAt: room.endedAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<AdminRoomDetail> {
    const room = await this.prisma.room.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true, nickname: true } },
        _count: { select: { members: true, drinkRecords: true } },
      },
    });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const agg = await this.prisma.$queryRaw<DrinkAggRow[]>`
      SELECT
        COALESCE(SUM(quantity), 0) AS "totalQuantity",
        COALESCE(SUM(quantity * "volumeMlSnapshot"), 0) AS "totalVolumeMl",
        COALESCE(
          SUM(quantity * "volumeMlSnapshot" * COALESCE("alcoholPercentSnapshot", 0) / 100),
          0
        ) AS "totalAlcoholMl"
      FROM "DrinkRecord"
      WHERE "roomId" = ${id}::uuid AND "deletedAt" IS NULL
    `;
    const aggRow = agg[0];

    return {
      id: room.id,
      name: room.name,
      owner: room.owner,
      memberCount: room._count.members,
      drinkRecordCount: room._count.drinkRecords,
      status: room.status,
      createdAt: room.createdAt,
      endedAt: room.endedAt,
      stats: {
        totalQuantity: toNumber(aggRow?.totalQuantity),
        totalVolumeMl: toNumber(aggRow?.totalVolumeMl),
        totalAlcoholMl: toNumber(aggRow?.totalAlcoholMl),
      },
    };
  }
}
