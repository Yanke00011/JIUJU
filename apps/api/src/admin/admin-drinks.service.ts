import { HttpStatus, Injectable } from '@nestjs/common';
import type { DrinkRecord } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination } from '../common/utils/pagination';
import { OperationLogService } from './operation-logs.service';

export interface AdminDrinksQuery {
  page?: number;
  pageSize?: number;
  roomId?: string;
  userId?: string;
  productId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AdminDrinkRecordItem {
  id: string;
  roomId: string;
  productId: string;
  userId: string;
  createdBy: string;
  barcode: string;
  volumeMlSnapshot: number;
  alcoholPercentSnapshot: number | null;
  quantity: number;
  clientRequestId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  deletedBy: string | null;
  deleteReason: string | null;
  user: { id: string; username: string; nickname: string } | null;
  createdByUser: { id: string; username: string; nickname: string } | null;
  deletedByUser: { id: string; username: string; nickname: string } | null;
  product: { id: string; name: string; barcode: string } | null;
  room: { id: string; name: string; inviteCode: string } | null;
}

@Injectable()
export class AdminDrinksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
  ) {}

  async list(query: AdminDrinksQuery): Promise<PageResult<AdminDrinkRecordItem>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.buildWhere(query);

    const [records, total] = await Promise.all([
      this.prisma.drinkRecord.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, nickname: true } },
          createdByUser: { select: { id: true, username: true, nickname: true } },
          deletedByUser: { select: { id: true, username: true, nickname: true } },
          product: { select: { id: true, name: true, barcode: true } },
          room: { select: { id: true, name: true, inviteCode: true } },
        },
      }),
      this.prisma.drinkRecord.count({ where }),
    ]);

    return {
      items: records.map(toAdminDrinkRecordItem),
      total,
      page,
      pageSize,
    };
  }

  /** 恢复软删除的饮酒记录。 */
  async restore(adminUserId: string, id: string): Promise<AdminDrinkRecordItem> {
    const record = await this.prisma.drinkRecord.findUnique({ where: { id } });
    if (!record) {
      throw new BusinessException('DRINK_RECORD_NOT_FOUND', '饮酒记录不存在', HttpStatus.NOT_FOUND);
    }
    if (record.deletedAt === null) {
      throw new BusinessException('DRINK_RECORD_NOT_DELETED', '该记录未被删除', HttpStatus.CONFLICT);
    }

    const restored = await this.prisma.drinkRecord.update({
      where: { id },
      data: { deletedAt: null, deletedBy: null, deleteReason: null },
      include: {
        user: { select: { id: true, username: true, nickname: true } },
        createdByUser: { select: { id: true, username: true, nickname: true } },
        deletedByUser: { select: { id: true, username: true, nickname: true } },
        product: { select: { id: true, name: true, barcode: true } },
        room: { select: { id: true, name: true, inviteCode: true } },
      },
    });

    await this.operationLog.log({
      adminUserId,
      action: 'DRINK_RECORD_RESTORE',
      targetType: 'DrinkRecord',
      targetId: id,
      metadata: { roomId: record.roomId },
    });

    return toAdminDrinkRecordItem(restored);
  }

  private buildWhere(query: AdminDrinksQuery): Prisma.DrinkRecordWhereInput {
    const where: Prisma.DrinkRecordWhereInput = {};
    if (query.roomId) where.roomId = query.roomId;
    if (query.userId) where.userId = query.userId;
    if (query.productId) where.productId = query.productId;

    const createdAt: Prisma.DateTimeFilter = {};
    const start = query.startDate ? new Date(query.startDate) : null;
    const end = query.endDate ? new Date(query.endDate) : null;
    if (start !== null && !Number.isNaN(start.getTime())) createdAt.gte = start;
    if (end !== null && !Number.isNaN(end.getTime())) createdAt.lte = end;
    if (createdAt.gte !== undefined || createdAt.lte !== undefined) where.createdAt = createdAt;

    return where;
  }
}

function toAdminDrinkRecordItem(
  record: DrinkRecord & {
    user: { id: string; username: string; nickname: string } | null;
    createdByUser: { id: string; username: string; nickname: string } | null;
    deletedByUser: { id: string; username: string; nickname: string } | null;
    product: { id: string; name: string; barcode: string } | null;
    room: { id: string; name: string; inviteCode: string } | null;
  },
): AdminDrinkRecordItem {
  return {
    id: record.id,
    roomId: record.roomId,
    productId: record.productId,
    userId: record.userId,
    createdBy: record.createdBy,
    barcode: record.barcode,
    volumeMlSnapshot: record.volumeMlSnapshot,
    alcoholPercentSnapshot:
      record.alcoholPercentSnapshot === null ? null : Number(record.alcoholPercentSnapshot),
    quantity: Number(record.quantity),
    clientRequestId: record.clientRequestId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
    deletedBy: record.deletedBy,
    deleteReason: record.deleteReason,
    user: record.user,
    createdByUser: record.createdByUser,
    deletedByUser: record.deletedByUser,
    product: record.product,
    room: record.room,
  };
}
