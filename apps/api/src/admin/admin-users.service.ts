import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination, PaginationQuery } from '../common/utils/pagination';
import { OperationLogService } from './operation-logs.service';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

export interface AdminUserItem {
  id: string;
  username: string;
  nickname: string;
  avatar: string | null;
  role: User['role'];
  status: User['status'];
  createdAt: Date;
  lastLoginAt: Date | null;
}

function toAdminUserItem(user: User): AdminUserItem {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
  ) {}

  async list(query: PaginationQuery): Promise<PageResult<AdminUserItem>> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return { items: users.map(toAdminUserItem), total, page, pageSize };
  }

  async getById(id: string): Promise<AdminUserItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BusinessException('USER_NOT_FOUND', '用户不存在', HttpStatus.NOT_FOUND);
    }
    return toAdminUserItem(user);
  }

  async updateStatus(
    adminUserId: string,
    id: string,
    dto: UpdateUserStatusDto,
    request: Request,
  ): Promise<AdminUserItem> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BusinessException('USER_NOT_FOUND', '用户不存在', HttpStatus.NOT_FOUND);
    }

    if (id === adminUserId && dto.status === 'DISABLED') {
      throw new BusinessException('CANNOT_DISABLE_SELF', '不能禁用自己', HttpStatus.FORBIDDEN);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
    });

    await this.operationLog.log({
      adminUserId,
      action: 'USER_STATUS_UPDATE',
      targetType: 'User',
      targetId: id,
      metadata: { from: user.status, to: dto.status },
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    return toAdminUserItem(updated);
  }
}
