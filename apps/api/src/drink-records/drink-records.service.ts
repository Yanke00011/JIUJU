import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { RoomMember } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { CreateDrinkRecordDto, UpdateDrinkRecordDto } from './dto/drink-record.dto';
import { DrinkRecordWithRelations, DrinkRecordDto, toDrinkRecordDto } from './drink-record.dto';

const RECORD_INCLUDE = {
  user: { select: { id: true, nickname: true, avatar: true } },
  product: { select: { id: true, name: true, brand: true } },
} as const;

@Injectable()
export class DrinkRecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    currentUserId: string,
    roomId: string,
    dto: CreateDrinkRecordDto,
  ): Promise<DrinkRecordDto> {
    const { room, membership } = await this.assertActiveMember(currentUserId, roomId);
    const isOwner = room.ownerId === currentUserId;

    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) {
      throw new BusinessException('PRODUCT_NOT_FOUND', '酒品不存在', HttpStatus.NOT_FOUND);
    }

    const targetUserId = await this.resolveTargetUser(
      currentUserId,
      roomId,
      dto.userId,
      isOwner,
      membership,
    );

    const record = await this.prisma.drinkRecord.create({
      data: {
        roomId,
        productId: product.id,
        userId: targetUserId,
        createdBy: currentUserId,
        barcode: product.barcode,
        volumeMlSnapshot: product.volumeMl,
        alcoholPercentSnapshot: product.alcoholPercent === null ? null : product.alcoholPercent,
        quantity: dto.quantity,
        clientRequestId: randomUUID(),
      },
      include: RECORD_INCLUDE,
    });

    return toDrinkRecordDto(record);
  }

  async list(currentUserId: string, roomId: string): Promise<DrinkRecordDto[]> {
    await this.assertMember(currentUserId, roomId);

    const records = await this.prisma.drinkRecord.findMany({
      where: { roomId, deletedAt: null },
      include: RECORD_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return records.map((r) => toDrinkRecordDto(r));
  }

  async getOne(currentUserId: string, roomId: string, drinkId: string): Promise<DrinkRecordDto> {
    await this.assertMember(currentUserId, roomId);

    const record = await this.prisma.drinkRecord.findFirst({
      where: { id: drinkId, roomId, deletedAt: null },
      include: RECORD_INCLUDE,
    });
    if (!record) {
      throw new BusinessException('DRINK_RECORD_NOT_FOUND', '饮酒记录不存在', HttpStatus.NOT_FOUND);
    }
    return toDrinkRecordDto(record);
  }

  async update(
    currentUserId: string,
    roomId: string,
    drinkId: string,
    dto: UpdateDrinkRecordDto,
  ): Promise<DrinkRecordDto> {
    const { room, membership } = await this.assertActiveMember(currentUserId, roomId);
    const isOwner = room.ownerId === currentUserId;

    const record = await this.findActiveRecord(roomId, drinkId);

    if (!isOwner && record.userId !== currentUserId) {
      throw new BusinessException(
        'DRINK_NOT_OWNER',
        '只能修改自己的饮酒记录',
        HttpStatus.FORBIDDEN,
      );
    }

    const data: { quantity?: number; userId?: string } = {};
    if (dto.quantity !== undefined) {
      data.quantity = dto.quantity;
    }
    if (dto.userId !== undefined) {
      data.userId = await this.resolveTargetUser(
        currentUserId,
        roomId,
        dto.userId,
        isOwner,
        membership,
      );
    }

    const updated = await this.prisma.drinkRecord.update({
      where: { id: drinkId },
      data,
      include: RECORD_INCLUDE,
    });
    return toDrinkRecordDto(updated);
  }

  async softDelete(currentUserId: string, roomId: string, drinkId: string): Promise<void> {
    await this.assertActiveMember(currentUserId, roomId);
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const isOwner = room.ownerId === currentUserId;

    const record = await this.findActiveRecord(roomId, drinkId);

    if (!isOwner && record.userId !== currentUserId) {
      throw new BusinessException(
        'DRINK_NOT_OWNER',
        '只能删除自己的饮酒记录',
        HttpStatus.FORBIDDEN,
      );
    }

    await this.prisma.drinkRecord.update({
      where: { id: drinkId },
      data: {
        deletedAt: new Date(),
        deletedBy: currentUserId,
      },
    });
  }

  private async assertMember(userId: string, roomId: string): Promise<{ membership: RoomMember }> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }
    return { membership };
  }

  private async assertActiveMember(
    userId: string,
    roomId: string,
  ): Promise<{ room: { ownerId: string; status: string }; membership: RoomMember }> {
    const membership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) {
      throw new BusinessException('ROOM_NOT_FOUND', '房间不存在', HttpStatus.NOT_FOUND);
    }

    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.status === 'ENDING') {
      throw new BusinessException('ROOM_ENDING', '房间即将结束，无法登记', HttpStatus.CONFLICT);
    }
    if (room.status === 'ENDED') {
      throw new BusinessException('ROOM_ENDED', '房间已结束，无法操作', HttpStatus.CONFLICT);
    }
    return { room, membership };
  }

  private async findActiveRecord(
    roomId: string,
    drinkId: string,
  ): Promise<DrinkRecordWithRelations> {
    const record = await this.prisma.drinkRecord.findFirst({
      where: { id: drinkId, roomId, deletedAt: null },
    });
    if (!record) {
      throw new BusinessException('DRINK_RECORD_NOT_FOUND', '饮酒记录不存在', HttpStatus.NOT_FOUND);
    }
    return record as DrinkRecordWithRelations;
  }

  private async resolveTargetUser(
    currentUserId: string,
    roomId: string,
    targetUserId: string,
    isOwner: boolean,
    _membership: RoomMember,
  ): Promise<string> {
    if (!isOwner) {
      if (targetUserId !== currentUserId) {
        throw new BusinessException(
          'CANNOT_REGISTER_OTHERS',
          '普通成员只能登记自己的饮酒记录',
          HttpStatus.FORBIDDEN,
        );
      }
      return currentUserId;
    }

    const targetMembership = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });
    if (!targetMembership) {
      throw new BusinessException(
        'TARGET_NOT_ROOM_MEMBER',
        '该用户不是房间成员',
        HttpStatus.BAD_REQUEST,
      );
    }
    return targetUserId;
  }
}
