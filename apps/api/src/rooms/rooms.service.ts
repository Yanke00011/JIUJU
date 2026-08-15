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
   */
  async listMyRooms(userId: string): Promise<Room[]> {
    const memberships = await this.prisma.roomMember.findMany({
      where: { userId },
      include: { room: true },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((membership) => membership.room);
  }

  /**
   * 房间详情：非成员一律返回 404 ROOM_NOT_FOUND，不泄露房间是否存在。
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
    return room;
  }

  /**
   * 结束房间：仅 OWNER 可操作；ACTIVE → ENDED，endedAt 使用数据库时间。
   */
  async endRoom(userId: string, roomId: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    if (room.status === 'ENDED') {
      throw new BusinessException('ROOM_ALREADY_ENDED', '房间已结束', HttpStatus.CONFLICT);
    }
    if (room.ownerId !== userId) {
      throw new BusinessException('ROOM_NOT_OWNER', '只有房主才能结束房间', HttpStatus.FORBIDDEN);
    }

    await this.prisma.$executeRaw`
      UPDATE "Room" SET status = 'ENDED', "endedAt" = now(), "updatedAt" = now() WHERE "id" = ${room.id}::uuid
    `;

    const ended = await this.prisma.room.findUniqueOrThrow({ where: { id: room.id } });
    return ended;
  }
}
