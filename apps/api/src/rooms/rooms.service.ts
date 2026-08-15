import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CreateRoomDto } from './dto/create-room.dto';

/**
 * 邀请码字符集：排除容易混淆的 I / O / 0 / 1。
 */
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_MAX_ATTEMPTS = 10;

/**
 * 结束冷静期（毫秒）：ACTIVE → ENDING 后，超过该时长自动归档为 ENDED。
 */
export const ROOM_END_COOLING_MS = 15 * 60 * 1000;

interface PrismaUniqueError {
  code?: string;
  meta?: { target?: unknown };
}

function isUniqueError(error: unknown, target: string): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as PrismaUniqueError;
  if (err.code !== 'P2002') {
    return false;
  }
  const metaTarget = err.meta?.target;
  if (typeof metaTarget === 'string') {
    return metaTarget === target;
  }
  if (Array.isArray(metaTarget)) {
    return metaTarget.includes(target);
  }
  return false;
}

@Injectable()
export class RoomService {
  private readonly logger = new Logger('Room');

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成 6 位大写字母+数字邀请码（排除 I/O/0/1）。
   */
  generateInviteCode(): string {
    const bytes = randomBytes(INVITE_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
      code += INVITE_CODE_CHARS[bytes[i] % INVITE_CODE_CHARS.length];
    }
    return code;
  }

  /**
   * 创建房间：在同一个事务中创建 Room 与 RoomMember(OWNER)。
   * 邀请码唯一冲突时自动重试。
   */
  async createRoom(userId: string, dto: CreateRoomDto): Promise<Room> {
    const name = dto.name.trim();

    for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt++) {
      const inviteCode = this.generateInviteCode();
      try {
        return await this.prisma.$transaction(async (tx) => {
          const room = await tx.room.create({
            data: { name, ownerId: userId, inviteCode },
          });
          await tx.roomMember.create({
            data: { roomId: room.id, userId, role: 'OWNER' },
          });
          return room;
        });
      } catch (error) {
        if (isUniqueError(error, 'inviteCode')) {
          this.logger.warn(`邀请码冲突，重试第 ${attempt + 1} 次`);
          continue;
        }
        throw error;
      }
    }

    throw new BusinessException(
      'INVITE_CODE_CONFLICT',
      '邀请码生成失败，请重试',
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }

  /**
   * 当前用户参与的房间列表（基于 RoomMember.userId）。
   * 若存在已过冷静期的 ENDING 房间，先懒归档为 ENDED。
   */
  async listMyRooms(userId: string): Promise<Room[]> {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { joinedAt: 'desc' },
    });
    const rooms = memberships.map((membership) => membership.room);
    return Promise.all(rooms.map((room) => this.finalizeIfExpired(room)));
  }

  /**
   * 房间详情：非成员一律返回 404 ROOM_NOT_FOUND，不泄露房间是否存在。
   * ENDING 房间若已过冷静期则自动归档为 ENDED。
   */
  async getRoomById(userId: string, roomId: string): Promise<Room> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    return this.finalizeIfExpired(room);
  }

  /**
   * 懒归档：若房间处于 ENDING 且已超过冷静期（now > endedAt + 15min），
   * 自动置为 ENDED 并记录 finalizedAt，同时写入 ROOM_FINALIZED 操作日志。
   */
  private async finalizeIfExpired(room: Room): Promise<Room> {
    if (room.status !== 'ENDING' || !room.endedAt) {
      return room;
    }
    const expiredAt = room.endedAt.getTime() + ROOM_END_COOLING_MS;
    if (Date.now() <= expiredAt) {
      return room;
    }
    const finalized = await this.prisma.room.update({
      where: { id: room.id },
      data: { status: 'ENDED', finalizedAt: new Date() },
    });
    await this.logRoomOperation(null, room.id, 'ROOM_FINALIZED', {
      roomId: room.id,
      operator: 'system',
      oldStatus: 'ENDING',
      newStatus: 'ENDED',
    });
    return finalized;
  }

  /**
   * 结束房间（仅 OWNER）：ACTIVE → ENDING（进入冷静期，endedAt 写入当前时间）。
   * ENDING → 409 ROOM_ALREADY_ENDING；ENDED → 409 ROOM_ALREADY_ENDED。
   */
  async endRoom(userId: string, roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    if (room.ownerId !== userId) {
      throw new BusinessException('ROOM_NOT_OWNER', '只有房主才能结束房间', HttpStatus.FORBIDDEN);
    }
    // 已过冷静期的 ENDING 先归档，再判断状态
    const current = await this.finalizeIfExpired(room);
    if (current.status === 'ENDED') {
      throw new BusinessException('ROOM_ALREADY_ENDED', '房间已结束', HttpStatus.CONFLICT);
    }
    if (current.status === 'ENDING') {
      throw new BusinessException('ROOM_ALREADY_ENDING', '房间已进入结束流程，等待冷静期结束', HttpStatus.CONFLICT);
    }

    const ending = await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'ENDING', endedAt: new Date(), finalizedAt: null },
    });

    await this.logRoomOperation(userId, roomId, 'ROOM_END_REQUEST', {
      roomId,
      operator: await this.getUsername(userId),
      oldStatus: current.status,
      newStatus: 'ENDING',
    });

    return ending;
  }

  /**
   * 撤销结束（仅 OWNER）：仅 ENDING → ACTIVE，endedAt 置空。
   */
  async cancelEnd(userId: string, roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    if (room.ownerId !== userId) {
      throw new BusinessException('ROOM_NOT_OWNER', '只有房主才能撤销结束', HttpStatus.FORBIDDEN);
    }
    if (room.status !== 'ENDING') {
      throw new BusinessException('ROOM_NOT_ENDING', '房间不在结束流程中，无法撤销', HttpStatus.CONFLICT);
    }

    const canceled = await this.prisma.room.update({
      where: { id: roomId },
      data: { status: 'ACTIVE', endedAt: null, finalizedAt: null },
    });

    await this.logRoomOperation(userId, roomId, 'ROOM_END_CANCEL', {
      roomId,
      operator: await this.getUsername(userId),
      oldStatus: 'ENDING',
      newStatus: 'ACTIVE',
    });

    return canceled;
  }

  /** 写入房间状态流转的操作日志（adminUserId 为 null 表示系统自动动作）。 */
  private async logRoomOperation(
    actorId: string | null,
    roomId: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.operationLog.create({
      data: {
        adminUserId: actorId,
        action,
        targetType: 'Room',
        targetId: roomId,
        details: JSON.stringify(details),
        ip: null,
        userAgent: null,
      },
    });
  }

  private async getUsername(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { username: true } });
    return user?.username ?? userId;
  }
}
