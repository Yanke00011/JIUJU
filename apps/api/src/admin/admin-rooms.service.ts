import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Room, RoomMember, DrinkRecord } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination, PaginationQuery } from '../common/utils/pagination';
import { OperationLogService } from './operation-logs.service';

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

export interface AdminRoomQuery extends PaginationQuery {
  keyword?: string;
}

export interface AdminRoomMemberItem {
  userId: string;
  nickname: string;
  avatar: string | null;
  role: RoomMember['role'];
  joinedAt: Date;
}

export interface AdminDrinkItem {
  id: string;
  productId: string;
  userId: string;
  barcode: string;
  volumeMlSnapshot: number;
  alcoholPercentSnapshot: number | null;
  quantity: number;
  createdAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  deleteReason: string | null;
  user: { id: string; nickname: string } | null;
  createdByUser: { id: string; nickname: string } | null;
  product: { id: string; name: string } | null;
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
  ) {}

  async list(query: AdminRoomQuery): Promise<PageResult<AdminRoomItem>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.buildWhere(query.keyword);

    const [rooms, total] = await Promise.all([
      this.prisma.room.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, username: true, nickname: true } },
          _count: { select: { members: true } },
        },
      }),
      this.prisma.room.count({ where }),
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

  async listMembers(roomId: string): Promise<AdminRoomMemberItem[]> {
    await this.assertRoom(roomId);
    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { nickname: true, avatar: true } } },
      orderBy: { joinedAt: 'asc' },
    });

    return members
      .map((m) => ({
        userId: m.userId,
        nickname: m.user.nickname,
        avatar: m.user.avatar,
        role: m.role,
        joinedAt: m.joinedAt,
      }))
      .sort((a, b) => {
        if (a.role === 'OWNER' && b.role !== 'OWNER') return -1;
        if (a.role !== 'OWNER' && b.role === 'OWNER') return 1;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      });
  }

  async listDrinks(
    roomId: string,
    query: PaginationQuery,
  ): Promise<PageResult<AdminDrinkItem>> {
    await this.assertRoom(roomId);
    const { skip, take, page, pageSize } = parsePagination(query);

    const [records, total] = await Promise.all([
      this.prisma.drinkRecord.findMany({
        where: { roomId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true } },
          createdByUser: { select: { id: true, nickname: true } },
          product: { select: { id: true, name: true } },
        },
      }),
      this.prisma.drinkRecord.count({ where: { roomId } }),
    ]);

    return {
      items: records.map(toAdminDrinkItem),
      total,
      page,
      pageSize,
    };
  }

  /** 结束房间（管理员），仅 ACTIVE → ENDED。 */
  async endRoom(adminUserId: string, roomId: string, request: Request): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    if (room.status === 'ENDED') {
      throw new BusinessException('ROOM_ALREADY_ENDED', '房间已结束', HttpStatus.CONFLICT);
    }

    const ended = await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'ENDED', endedAt: new Date() },
    });

    await this.operationLog.log({
      adminUserId,
      action: 'ROOM_END',
      targetType: 'Room',
      targetId: roomId,
      metadata: {},
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    return ended;
  }

  /** 导出房间饮酒记录 CSV（包含已软删除记录）。 */
  async exportCsv(roomId: string): Promise<{ filename: string; csv: string }> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const records = await this.prisma.drinkRecord.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { nickname: true } },
        product: { select: { name: true } },
      },
    });

    const header = ['用户', '酒品', '数量', '容量快照ml', '酒精度快照%', '时间', '已删除'];
    const escape = (v: string | number | null | undefined): string => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = records.map((r) =>
      [
        r.user?.nickname ?? '',
        r.product?.name ?? '',
        Number(r.quantity),
        r.volumeMlSnapshot,
        r.alcoholPercentSnapshot === null ? '' : Number(r.alcoholPercentSnapshot),
        r.createdAt.toISOString(),
        r.deletedAt ? '是' : '否',
      ]
        .map(escape)
        .join(','),
    );

    const csv = [header.map(escape).join(','), ...lines].join('\n');
    const filename = `room-${room.name}-drinks.csv`;
    return { filename, csv };
  }

  private async assertRoom(roomId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
  }

  private buildWhere(keyword?: string): Prisma.RoomWhereInput {
    if (!keyword || keyword.trim() === '') {
      return {};
    }
    const kw = keyword.trim();
    return {
      OR: [
        { name: { contains: kw, mode: 'insensitive' } },
        { inviteCode: { contains: kw, mode: 'insensitive' } },
        { owner: { username: { contains: kw, mode: 'insensitive' } } },
        { owner: { nickname: { contains: kw, mode: 'insensitive' } } },
      ],
    };
  }
}

function toAdminDrinkItem(record: DrinkRecord & {
  user: { id: string; nickname: string } | null;
  createdByUser: { id: string; nickname: string } | null;
  product: { id: string; name: string } | null;
}): AdminDrinkItem {
  return {
    id: record.id,
    productId: record.productId,
    userId: record.userId,
    barcode: record.barcode,
    volumeMlSnapshot: record.volumeMlSnapshot,
    alcoholPercentSnapshot:
      record.alcoholPercentSnapshot === null ? null : Number(record.alcoholPercentSnapshot),
    quantity: Number(record.quantity),
    createdAt: record.createdAt,
    deletedAt: record.deletedAt,
    deletedBy: record.deletedBy,
    deleteReason: record.deleteReason,
    user: record.user,
    createdByUser: record.createdByUser,
    product: record.product,
  };
}
