import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Room } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoomService } from './rooms.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: '33333333-3333-4333-8333-333333333333',
  name: '周末朋友酒局',
  ownerId: USER_ID,
  inviteCode: 'A7K92P',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  endedAt: null,
  ...overrides,
});

const makeTx = () => ({
  room: { create: jest.fn() },
  roomMember: { create: jest.fn() },
});

describe('RoomService', () => {
  let service: RoomService;
  let prisma: {
    $transaction: jest.Mock;
    $executeRaw: jest.Mock;
    room: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    roomMember: { findUnique: jest.Mock; findMany: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      $executeRaw: jest.fn().mockResolvedValue(1),
      room: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      roomMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RoomService>(RoomService);
  });

  describe('generateInviteCode', () => {
    it('should generate a 6-char code', () => {
      const code = service.generateInviteCode();
      expect(code).toHaveLength(6);
    });

    it('should only contain uppercase letters and digits from the safe charset', () => {
      for (let i = 0; i < 50; i++) {
        const code = service.generateInviteCode();
        expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
      }
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 200; i++) {
        codes.add(service.generateInviteCode());
      }
      expect(codes.size).toBe(200);
    });
  });

  describe('createRoom', () => {
    it('should create room and OWNER membership in one transaction', async () => {
      const room = makeRoom();
      const tx = makeTx();
      tx.room.create.mockResolvedValue(room);
      tx.roomMember.create.mockResolvedValue({
        id: 'm1',
        roomId: room.id,
        userId: USER_ID,
        role: 'OWNER',
      });
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) =>
        cb(tx),
      );

      const result = await service.createRoom(USER_ID, { name: '  周末朋友酒局  ' });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.room.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: '周末朋友酒局',
          ownerId: USER_ID,
          inviteCode: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/),
        }),
      });
      expect(tx.roomMember.create).toHaveBeenCalledWith({
        data: { roomId: room.id, userId: USER_ID, role: 'OWNER' },
      });
      expect(result).toEqual(room);
    });

    it('should retry with a new invite code on unique conflict, then succeed', async () => {
      const room = makeRoom();
      const tx = makeTx();
      const uniqueError = {
        code: 'P2002',
        meta: { target: ['inviteCode'] },
        message: 'Unique constraint failed',
      };
      tx.room.create.mockRejectedValueOnce(uniqueError).mockResolvedValueOnce(room);
      tx.roomMember.create.mockResolvedValue({
        id: 'm1',
        roomId: room.id,
        userId: USER_ID,
        role: 'OWNER',
      });
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) =>
        cb(tx),
      );

      const result = await service.createRoom(USER_ID, { name: '周末朋友酒局' });

      expect(tx.room.create).toHaveBeenCalledTimes(2);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(result).toEqual(room);
    });

    it('should propagate transaction failure and not create orphan room', async () => {
      const tx = makeTx();
      tx.room.create.mockResolvedValue(makeRoom());
      tx.roomMember.create.mockRejectedValue(new Error('member create failed'));
      prisma.$transaction.mockImplementation(async (cb: (t: typeof tx) => Promise<unknown>) =>
        cb(tx),
      );

      await expect(service.createRoom(USER_ID, { name: '周末朋友酒局' })).rejects.toThrow(
        'member create failed',
      );
      // 事务失败时，room.create 与 roomMember.create 必须同属一次 $transaction 调用，
      // 由事务回滚保证不会产生"有房间无 Owner"的孤儿数据。
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(tx.roomMember.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('listMyRooms', () => {
    it('should only return rooms where user is a member', async () => {
      const room = makeRoom();
      prisma.roomMember.findMany.mockResolvedValue([
        { id: 'm1', roomId: room.id, userId: USER_ID, role: 'OWNER', joinedAt: new Date(), room },
      ]);

      const result = await service.listMyRooms(USER_ID);

      expect(prisma.roomMember.findMany).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        include: { room: true },
        orderBy: { joinedAt: 'desc' },
      });
      expect(result).toEqual([room]);
    });
  });

  describe('getRoomById', () => {
    it('should return room for a member', async () => {
      const room = makeRoom();
      prisma.roomMember.findUnique.mockResolvedValue({
        id: 'm1',
        roomId: room.id,
        userId: USER_ID,
        role: 'MEMBER',
        joinedAt: new Date(),
      });
      prisma.room.findUnique.mockResolvedValue(room);

      const result = await service.getRoomById(USER_ID, room.id);

      expect(result).toEqual(room);
    });

    it('should return 404 for non-member without leaking existence', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);
      prisma.room.findUnique.mockResolvedValue(makeRoom());

      await expect(service.getRoomById(OTHER_ID, makeRoom().id)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
      expect(prisma.room.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('endRoom', () => {
    it('should let owner end an ACTIVE room and set endedAt', async () => {
      const room = makeRoom();
      const ended = makeRoom({ status: 'ENDED', endedAt: new Date('2026-08-15T05:00:00.000Z') });
      prisma.room.findUnique.mockResolvedValue(room);
      prisma.room.findUniqueOrThrow.mockResolvedValue(ended);

      const result = await service.endRoom(USER_ID, room.id);

      expect(prisma.$executeRaw).toHaveBeenCalled();
      expect(result.status).toBe('ENDED');
      expect(result.endedAt).toBeInstanceOf(Date);
    });

    it('should not let a non-owner member end the room', async () => {
      const room = makeRoom();
      prisma.room.findUnique.mockResolvedValue(room);

      await expect(service.endRoom(OTHER_ID, room.id)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'ROOM_NOT_OWNER', message: '只有房主才能结束房间' },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should return 409 when room is already ended', async () => {
      const room = makeRoom({ status: 'ENDED' });
      prisma.room.findUnique.mockResolvedValue(room);

      await expect(service.endRoom(USER_ID, room.id)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ROOM_ALREADY_ENDED', message: '房间已结束' },
      });
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('should return 404 when room does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(service.endRoom(USER_ID, 'missing')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
    });
  });
});
