import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface OperationLogInput {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * 管理员操作日志写入。
 * OperationLog.details 以 JSON 字符串存储 metadata。
 */
@Injectable()
export class OperationLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: OperationLogInput): Promise<void> {
    await this.prisma.operationLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        details: input.metadata ? JSON.stringify(input.metadata) : null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }
}
