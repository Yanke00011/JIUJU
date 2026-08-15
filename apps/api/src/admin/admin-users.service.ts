import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { User } from '@prisma/client';
import { Prisma } from '@prisma/client';
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
  deletedAt: Date | null;
}

export interface AdminUserDetail extends AdminUserItem {
  roomCount: number;
  drinkRecordCount: number;
}

export interface AdminUserQuery extends PaginationQuery {
  keyword?: string;
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
    deletedAt: user.deletedAt,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
  ) {}

  async list(query: AdminUserQuery): Promise<PageResult<AdminUserItem>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.buildWhere(query.keyword);

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: users.map(toAdminUserItem), total, page, pageSize };
  }

  async getById(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BusinessException('USER_NOT_FOUND', '用户不存在', HttpStatus.NOT_FOUND);
    }

    const [roomCount, drinkRecordCount] = await Promise.all([
      this.prisma.roomMember.count({ where: { userId: id } }),
      this.prisma.drinkRecord.count({ where: { userId: id } }),
    ]);

    return { ...toAdminUserItem(user), roomCount, drinkRecordCount };
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

  /**
   * 删除用户（仅 SUPER_ADMIN）：
   * - 不能删除自己；
   * - 不能删除 SUPER_ADMIN；
   * - 若存在历史饮酒记录（饮用者或登记人）或有自有房间，改为软删除（deletedAt + status=DISABLED）；
   * - 否则物理删除。
   */
  async delete(
    adminUserId: string,
    id: string,
    request: Request,
  ): Promise<{ deleted: boolean; softDeleted: boolean }> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new BusinessException('USER_NOT_FOUND', '用户不存在', HttpStatus.NOT_FOUND);
    }
    if (id === adminUserId) {
      throw new BusinessException('CANNOT_DELETE_SELF', '不能删除自己', HttpStatus.FORBIDDEN);
    }
    if (user.role === 'SUPER_ADMIN') {
      throw new BusinessException(
        'CANNOT_DELETE_SUPER_ADMIN',
        '不能删除超级管理员',
        HttpStatus.FORBIDDEN,
      );
    }

    const [drinkCount, createdCount, ownedRoomCount] = await Promise.all([
      this.prisma.drinkRecord.count({ where: { userId: id } }),
      this.prisma.drinkRecord.count({ where: { createdBy: id } }),
      this.prisma.room.count({ where: { ownerId: id } }),
    ]);

    const hasHistory = drinkCount > 0 || createdCount > 0 || ownedRoomCount > 0;

    if (hasHistory) {
      await this.prisma.user.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'DISABLED' },
      });
      await this.operationLog.log({
        adminUserId,
        action: 'USER_SOFT_DELETE',
        targetType: 'User',
        targetId: id,
        metadata: { reason: '存在历史数据，软删除' },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
      return { deleted: false, softDeleted: true };
    }

    await this.prisma.user.delete({ where: { id } });
    await this.operationLog.log({
      adminUserId,
      action: 'USER_DELETE',
      targetType: 'User',
      targetId: id,
      metadata: {},
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
    return { deleted: true, softDeleted: false };
  }

  private buildWhere(keyword?: string): Prisma.UserWhereInput {
    if (!keyword || keyword.trim() === '') {
      return {};
    }
    const kw = keyword.trim();
    return {
      OR: [
        { username: { contains: kw, mode: 'insensitive' } },
        { nickname: { contains: kw, mode: 'insensitive' } },
      ],
    };
  }
}
