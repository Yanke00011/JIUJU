import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination } from '../common/utils/pagination';

export interface AdminLogItem {
  id: string;
  admin: { id: string; username: string } | null;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AdminLogQuery {
  page?: number;
  pageSize?: number;
  adminUserId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
}

type LogWithAdmin = {
  id: string;
  adminUserId: string | null;
  action: string;
  targetType: string;
  targetId: string;
  details: string | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  admin: { id: string; username: string } | null;
};

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toAdminLogItem(log: LogWithAdmin): AdminLogItem {
  return {
    id: log.id,
    admin: log.admin ? { id: log.admin.id, username: log.admin.username } : null,
    action: log.action,
    targetType: log.targetType,
    targetId: log.targetId,
    details: parseDetails(log.details),
    ip: log.ip,
    userAgent: log.userAgent,
    createdAt: log.createdAt,
  };
}

@Injectable()
export class AdminLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminLogQuery): Promise<PageResult<AdminLogItem>> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const where = this.buildWhere(query);

    const [logs, total] = await Promise.all([
      this.prisma.operationLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          admin: { select: { id: true, username: true } },
        },
      }),
      this.prisma.operationLog.count({ where }),
    ]);

    return {
      items: (logs as unknown as LogWithAdmin[]).map(toAdminLogItem),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<AdminLogItem> {
    const log = await this.prisma.operationLog.findUnique({
      where: { id },
      include: {
        admin: { select: { id: true, username: true } },
      },
    });
    if (!log) {
      throw new BusinessException('LOG_NOT_FOUND', '日志不存在', HttpStatus.NOT_FOUND);
    }
    return toAdminLogItem(log as unknown as LogWithAdmin);
  }

  private buildWhere(query: AdminLogQuery): Prisma.OperationLogWhereInput {
    const where: Prisma.OperationLogWhereInput = {};

    if (query.adminUserId !== undefined && query.adminUserId !== '') {
      where.adminUserId = query.adminUserId;
    }
    if (query.action !== undefined && query.action !== '') {
      where.action = query.action;
    }
    if (query.targetType !== undefined && query.targetType !== '') {
      where.targetType = query.targetType;
    }
    if (query.targetId !== undefined && query.targetId !== '') {
      where.targetId = query.targetId;
    }

    const createdAt: Prisma.DateTimeFilter = {};
    const start =
      query.startDate !== undefined && query.startDate !== '' ? new Date(query.startDate) : null;
    const end =
      query.endDate !== undefined && query.endDate !== '' ? new Date(query.endDate) : null;
    if (start !== null && !Number.isNaN(start.getTime())) {
      createdAt.gte = start;
    }
    if (end !== null && !Number.isNaN(end.getTime())) {
      createdAt.lte = end;
    }
    if (createdAt.gte !== undefined || createdAt.lte !== undefined) {
      where.createdAt = createdAt;
    }

    return where;
  }
}
