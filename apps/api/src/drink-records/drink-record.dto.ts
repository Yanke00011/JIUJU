import type { DrinkRecord } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type DrinkRecordWithRelations = Prisma.DrinkRecordGetPayload<{
  include: {
    user: { select: { id: true; nickname: true; avatar: true } };
    product: { select: { id: true; name: true; brand: true } };
  };
}>;

export interface DrinkRecordDto {
  id: string;
  roomId: string;
  productId: string;
  userId: string;
  barcode: string;
  volumeMlSnapshot: number;
  alcoholPercentSnapshot: number | null;
  quantity: number;
  createdAt: Date;
  updatedAt: Date;
  user: {
    id: string;
    nickname: string;
    avatar: string | null;
  };
  product: {
    id: string;
    name: string;
    brand: string | null;
  };
}

export function toDrinkRecordDto(record: DrinkRecordWithRelations): DrinkRecordDto {
  return {
    id: record.id,
    roomId: record.roomId,
    productId: record.productId,
    userId: record.userId,
    barcode: record.barcode,
    volumeMlSnapshot: record.volumeMlSnapshot,
    alcoholPercentSnapshot:
      record.alcoholPercentSnapshot === null ? null : Number(record.alcoholPercentSnapshot),
    quantity: Number(record.quantity),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    user: {
      id: record.user.id,
      nickname: record.user.nickname,
      avatar: record.user.avatar,
    },
    product: {
      id: record.product.id,
      name: record.product.name,
      brand: record.product.brand,
    },
  };
}

export type { DrinkRecord };
