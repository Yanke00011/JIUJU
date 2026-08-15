import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { DrinkRecordsService } from './drink-records.service';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_MEMBER_ID = '55555555-5555-4555-8555-555555555555';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';
const PRODUCT_ID = '44444444-4444-4444-8444-444444444444';
const DRINK_ID = '66666666-6666-4666-8666-666666666666';

const makeRoom = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: ROOM_ID,
  name: '酒局',
  ownerId: OWNER_ID,
  inviteCode: 'A7K92P',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  endedAt: null,
  ...overrides,
});

const makeDecimal = (n: number) => ({
  toNumber: () => n,
  toString: () => String(n),
  valueOf: () => n,
});

const makeProduct = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: PRODUCT_ID,
  barcode: '6901234567890',
  name: 'XX啤酒',
  brand: 'XX',
  category: 'BEER',
  volumeMl: 500,
  alcoholPercent: makeDecimal(4.3),
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  ...overrides,
});

const makeMembership = (userId: string, role = 'MEMBER') => ({
  id: 'm1',
  roomId: ROOM_ID,
  userId,
  role,
  joinedAt: new Date('2026-08-15T04:10:20.000Z'),
});

const makeRecord = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: DRINK_ID,
  roomId: ROOM_ID,
  productId: PRODUCT_ID,
  userId: MEMBER_ID,
  createdBy: MEMBER_ID,
  barcode: '6901234567890',
  volumeMlSnapshot: 500,
  alcoholPercentSnapshot: makeDecimal(4.3),
  quantity: makeDecimal(1),
  clientRequestId: 'cccccccc-0000-0000-0000-000000000000',
  createdAt: new Date('2026-08-15T05:00:00.000Z'),
  updatedAt: new Date('2026-08-15T05:00:00.000Z'),
  deletedAt: null,
  deletedBy: null,
  deleteReason: null,
  user: { id: MEMBER_ID, nickname: '李四', avatar: null },
  product: { id: PRODUCT_ID, name: 'XX啤酒', brand: 'XX' },
  ...overrides,
});

describe('DrinkRecordsService', () => {
  let service: DrinkRecordsService;
  let prisma: {
    roomMember: { findUnique: jest.Mock };
    room: { findUniqueOrThrow: jest.Mock };
    product: { findUnique: jest.Mock };
    drinkRecord: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      roomMember: { findUnique: jest.fn() },
      room: { findUniqueOrThrow: jest.fn() },
      product: { findUnique: jest.fn() },
      drinkRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [DrinkRecordsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<DrinkRecordsService>(DrinkRecordsService);
  });

  describe('create', () => {
    it('should let a MEMBER register themselves and snapshot product data', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.drinkRecord.create.mockResolvedValue(makeRecord({ userId: MEMBER_ID }));

      const result = await service.create(MEMBER_ID, ROOM_ID, {
        productId: PRODUCT_ID,
        userId: MEMBER_ID,
        quantity: 0.5,
      });

      expect(prisma.drinkRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          roomId: ROOM_ID,
          productId: PRODUCT_ID,
          userId: MEMBER_ID,
          createdBy: MEMBER_ID,
          barcode: '6901234567890',
          volumeMlSnapshot: 500,
          quantity: 0.5,
          clientRequestId: expect.any(String),
        }),
        include: expect.anything(),
      });
      const data = prisma.drinkRecord.create.mock.calls[0][0].data;
      expect(
        data.alcoholPercentSnapshot.toNumber ? data.alcoholPercentSnapshot.toNumber() : 4.3,
      ).toBeCloseTo(4.3);
      expect(result.quantity).toBe(1); // quantity 从 Decimal 转 number
    });

    it('should reject MEMBER registering another user', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.product.findUnique.mockResolvedValue(makeProduct());

      await expect(
        service.create(MEMBER_ID, ROOM_ID, {
          productId: PRODUCT_ID,
          userId: OTHER_MEMBER_ID,
          quantity: 1,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'CANNOT_REGISTER_OTHERS' },
      });
      expect(prisma.drinkRecord.create).not.toHaveBeenCalled();
    });

    it('should let OWNER register another member', async () => {
      prisma.roomMember.findUnique.mockResolvedValueOnce(makeMembership(OWNER_ID, 'OWNER'));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.roomMember.findUnique
        .mockResolvedValueOnce(makeMembership(MEMBER_ID))
        .mockResolvedValueOnce(makeMembership(MEMBER_ID));
      prisma.drinkRecord.create.mockResolvedValue(
        makeRecord({ userId: MEMBER_ID, createdBy: OWNER_ID }),
      );

      const result = await service.create(OWNER_ID, ROOM_ID, {
        productId: PRODUCT_ID,
        userId: MEMBER_ID,
        quantity: 1,
      });

      expect(result.userId).toBe(MEMBER_ID);
      const data = prisma.drinkRecord.create.mock.calls[0][0].data;
      expect(data.createdBy).toBe(OWNER_ID);
    });

    it('should reject OWNER registering a non-member', async () => {
      prisma.roomMember.findUnique
        .mockResolvedValueOnce(makeMembership(OWNER_ID, 'OWNER'))
        .mockResolvedValueOnce(null);
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.product.findUnique.mockResolvedValue(makeProduct());

      await expect(
        service.create(OWNER_ID, ROOM_ID, {
          productId: PRODUCT_ID,
          userId: OTHER_MEMBER_ID,
          quantity: 1,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: { code: 'TARGET_NOT_ROOM_MEMBER' },
      });
    });

    it('should return 404 when product does not exist', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.create(MEMBER_ID, ROOM_ID, {
          productId: PRODUCT_ID,
          userId: MEMBER_ID,
          quantity: 1,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      });
    });

    it('should return 404 for non-member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(
        service.create(MEMBER_ID, ROOM_ID, {
          productId: PRODUCT_ID,
          userId: MEMBER_ID,
          quantity: 1,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND' },
      });
    });

    it('should reject create in an ENDED room', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom({ status: 'ENDED' }));

      await expect(
        service.create(MEMBER_ID, ROOM_ID, {
          productId: PRODUCT_ID,
          userId: MEMBER_ID,
          quantity: 1,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ROOM_ENDED' },
      });
    });
  });

  describe('list', () => {
    it('should only return non-deleted records for a member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.drinkRecord.findMany.mockResolvedValue([makeRecord()]);

      const result = await service.list(MEMBER_ID, ROOM_ID);

      expect(prisma.drinkRecord.findMany).toHaveBeenCalledWith({
        where: { roomId: ROOM_ID, deletedAt: null },
        include: expect.anything(),
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for non-member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.list(MEMBER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND' },
      });
    });
  });

  describe('getOne', () => {
    it('should return a record for a member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord());

      const result = await service.getOne(MEMBER_ID, ROOM_ID, DRINK_ID);

      expect(result.id).toBe(DRINK_ID);
    });

    it('should return 404 when record does not exist', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.drinkRecord.findFirst.mockResolvedValue(null);

      await expect(service.getOne(MEMBER_ID, ROOM_ID, DRINK_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'DRINK_RECORD_NOT_FOUND' },
      });
    });
  });

  describe('update', () => {
    it('should let a MEMBER update their own quantity', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord({ userId: MEMBER_ID }));
      prisma.drinkRecord.update.mockResolvedValue(
        makeRecord({ userId: MEMBER_ID, quantity: makeDecimal(0.5) }),
      );

      const result = await service.update(MEMBER_ID, ROOM_ID, DRINK_ID, { quantity: 0.5 });

      expect(prisma.drinkRecord.update).toHaveBeenCalledWith({
        where: { id: DRINK_ID },
        data: { quantity: 0.5 },
        include: expect.anything(),
      });
      expect(result.quantity).toBe(0.5);
    });

    it('should reject a MEMBER updating another users record', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord({ userId: OTHER_MEMBER_ID }));

      await expect(
        service.update(MEMBER_ID, ROOM_ID, DRINK_ID, { quantity: 2 }),
      ).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'DRINK_NOT_OWNER' },
      });
      expect(prisma.drinkRecord.update).not.toHaveBeenCalled();
    });

    it('should let OWNER update another member record and change userId', async () => {
      prisma.roomMember.findUnique
        .mockResolvedValueOnce(makeMembership(OWNER_ID, 'OWNER'))
        .mockResolvedValueOnce(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord({ userId: MEMBER_ID }));
      prisma.drinkRecord.update.mockResolvedValue(makeRecord({ userId: OTHER_MEMBER_ID }));

      const result = await service.update(OWNER_ID, ROOM_ID, DRINK_ID, {
        userId: OTHER_MEMBER_ID,
      });

      expect(prisma.drinkRecord.update).toHaveBeenCalledWith({
        where: { id: DRINK_ID },
        data: { userId: OTHER_MEMBER_ID },
        include: expect.anything(),
      });
      expect(result.userId).toBe(OTHER_MEMBER_ID);
    });
  });

  describe('softDelete', () => {
    it('should soft delete a record setting deletedAt and deletedBy', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord({ userId: MEMBER_ID }));

      await service.softDelete(MEMBER_ID, ROOM_ID, DRINK_ID);

      expect(prisma.drinkRecord.update).toHaveBeenCalledWith({
        where: { id: DRINK_ID },
        data: expect.objectContaining({
          deletedAt: expect.any(Date),
          deletedBy: MEMBER_ID,
        }),
      });
    });

    it('should reject a MEMBER deleting another users record', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(MEMBER_ID));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord({ userId: OTHER_MEMBER_ID }));

      await expect(service.softDelete(MEMBER_ID, ROOM_ID, DRINK_ID)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'DRINK_NOT_OWNER' },
      });
    });

    it('should let OWNER delete any record', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMembership(OWNER_ID, 'OWNER'));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.drinkRecord.findFirst.mockResolvedValue(makeRecord({ userId: MEMBER_ID }));

      await service.softDelete(OWNER_ID, ROOM_ID, DRINK_ID);

      expect(prisma.drinkRecord.update).toHaveBeenCalled();
    });
  });
});
