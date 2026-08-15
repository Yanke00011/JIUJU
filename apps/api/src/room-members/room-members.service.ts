import { HttpStatus, Injectable } from '@nestjs/common';
import { Room, RoomMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';

export interface RoomMemberInfo {
  userId: string;
  nickname: string;
  avatar: string | null;
  role: RoomMember['role'];
  joinedAt: Date;
}

interface PrismaUniqueError {
  code?: string;
  meta?: { target?: unknown };
}

function isRoomMemberUniqueError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as PrismaUniqueError;
  if (err.code !== 'P2002') {
    return false;
  }
  const target = err.meta?.target;
  if (typeof target === 'string') {
    return target === 'roomId_userId';
  }
  if (Array.isArray(target)) {
    return target.includes('roomId') && target.includes('userId');
  }
  return false;
}

@Injectable()
export class RoomMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async joinRoom(userId: string, inviteCode: string): Promise<{ room: Room; member: RoomMember }> {
    const room = await this.prisma.room.findUnique({ where: { inviteCode } });
    if (!room) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    if (room.status === 'ENDED') {
      throw new BusinessException('ROOM_ENDED', '房间已结束，无法加入', HttpStatus.CONFLICT);
    }

    try {
      const member = await this.prisma.roomMember.create({
        data: { roomId: room.id, userId, role: 'MEMBER' },
      });
      return { room, member };
    } catch (error) {
      if (isRoomMemberUniqueError(error)) {
        throw new BusinessException('ALREADY_MEMBER', '你已在该房间中', HttpStatus.CONFLICT);
      }
      throw error;
    }
  }

  async listMembers(userId: string, roomId: string): Promise<RoomMemberInfo[]> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const members = await this.prisma.roomMember.findMany({
      where: { roomId },
      include: { user: { select: { nickname: true, avatar: true } } },
    });

    const items: RoomMemberInfo[] = members.map((m) => ({
      userId: m.userId,
      nickname: m.user.nickname,
      avatar: m.user.avatar,
      role: m.role,
      joinedAt: m.joinedAt,
    }));

    items.sort((a, b) => {
      if (a.role === 'OWNER' && b.role !== 'OWNER') return -1;
      if (a.role !== 'OWNER' && b.role === 'OWNER') return 1;
      return a.joinedAt.getTime() - b.joinedAt.getTime();
    });

    return items;
  }

  async getMyMembership(userId: string, roomId: string): Promise<RoomMember> {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!member) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    return member;
  }

  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.status === 'ENDED') {
      throw new BusinessException('ROOM_ENDED', '房间已结束，无法退出', HttpStatus.CONFLICT);
    }
    if (membership.role === 'OWNER') {
      throw new BusinessException(
        'OWNER_CANNOT_LEAVE',
        '房主不能退出自己的房间，只能结束房间',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });
  }

  async removeMember(ownerId: string, roomId: string, targetUserId: string): Promise<void> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: ownerId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.ownerId !== ownerId) {
      throw new BusinessException('ROOM_NOT_OWNER', '只有房主才能移除成员', HttpStatus.FORBIDDEN);
    }
    if (room.status === 'ENDED') {
      throw new BusinessException('ROOM_ENDED', '房间已结束，无法移除成员', HttpStatus.CONFLICT);
    }

    const target = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!target) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    if (target.role === 'OWNER') {
      throw new BusinessException('CANNOT_REMOVE_OWNER', '不能移除房主', HttpStatus.CONFLICT);
    }

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
  }
}
