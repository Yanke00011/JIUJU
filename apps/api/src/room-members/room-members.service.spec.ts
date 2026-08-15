import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { RoomMembersService } from './room-members.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';
const ROOM_ID = '33333333-3333-4333-8333-333333333333';

const makeRoom = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: ROOM_ID,
  name: '周末朋友酒局',
  ownerId: USER_ID,
  inviteCode: 'A7K92P',
  status: 'ACTIVE',
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  endedAt: null,
  ...overrides,
});

const makeMember = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: '44444444-4444-4444-8444-444444444444',
  roomId: ROOM_ID,
  userId: USER_ID,
  role: 'MEMBER',
  joinedAt: new Date('2026-08-15T05:00:00.000Z'),
  ...overrides,
});

const p2002Error = (target: string[]) => ({
  code: 'P2002',
  meta: { target },
  message: 'Unique constraint failed',
});

describe('RoomMembersService', () => {
  let service: RoomMembersService;
  let prisma: {
    room: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    roomMember: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      room: {
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      roomMember: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [RoomMembersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<RoomMembersService>(RoomMembersService);
  });

  describe('joinRoom', () => {
    it('should join an ACTIVE room as MEMBER', async () => {
      const room = makeRoom();
      const member = makeMember();
      prisma.room.findUnique.mockResolvedValue(room);
      prisma.roomMember.create.mockResolvedValue(member);

      const result = await service.joinRoom(OTHER_ID, 'A7K92P');

      expect(prisma.room.findUnique).toHaveBeenCalledWith({
        where: { inviteCode: 'A7K92P' },
      });
      expect(prisma.roomMember.create).toHaveBeenCalledWith({
        data: { roomId: ROOM_ID, userId: OTHER_ID, role: 'MEMBER' },
      });
      expect(result).toEqual({ room, member });
    });

    it('should return 404 ROOM_NOT_FOUND when inviteCode does not exist', async () => {
      prisma.room.findUnique.mockResolvedValue(null);

      await expect(service.joinRoom(OTHER_ID, 'ZZZZZZ')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
    });

    it('should return 409 ROOM_ENDED when room is ended', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom({ status: 'ENDED' }));

      await expect(service.joinRoom(OTHER_ID, 'A7K92P')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ROOM_ENDED', message: '房间已结束，无法加入' },
      });
      expect(prisma.roomMember.create).not.toHaveBeenCalled();
    });

    it('should return 409 ALREADY_MEMBER on concurrent duplicate join (P2002)', async () => {
      prisma.room.findUnique.mockResolvedValue(makeRoom());
      prisma.roomMember.create.mockRejectedValue(p2002Error(['roomId', 'userId']));

      await expect(service.joinRoom(OTHER_ID, 'A7K92P')).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ALREADY_MEMBER', message: '你已在该房间中' },
      });
    });
  });

  describe('listMembers', () => {
    it('should return members sorted with OWNER first then joinedAt ASC', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMember({ role: 'MEMBER' }));
      const owner = {
        ...makeMember({
          id: 'm1',
          userId: USER_ID,
          role: 'OWNER',
          joinedAt: new Date('2026-08-15T05:00:00Z'),
        }),
        user: { nickname: '张三', avatar: null },
      };
      const late = {
        ...makeMember({
          id: 'm2',
          userId: OTHER_ID,
          role: 'MEMBER',
          joinedAt: new Date('2026-08-15T07:00:00Z'),
        }),
        user: { nickname: '李四', avatar: null },
      };
      const early = {
        ...makeMember({
          id: 'm3',
          userId: '55555555-5555-4555-8555-555555555555',
          role: 'MEMBER',
          joinedAt: new Date('2026-08-15T06:00:00Z'),
        }),
        user: { nickname: '王五', avatar: null },
      };
      prisma.roomMember.findMany.mockResolvedValue([late, early, owner]);

      const result = await service.listMembers(USER_ID, ROOM_ID);

      expect(result.map((m) => m.userId)).toEqual([
        USER_ID,
        '55555555-5555-4555-8555-555555555555',
        OTHER_ID,
      ]);
      expect(result[0]).toMatchObject({ role: 'OWNER' });
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0]).not.toHaveProperty('password');
    });

    it('should return 404 for non-member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.listMembers(OTHER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
      expect(prisma.roomMember.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getMyMembership', () => {
    it('should return my membership for a member', async () => {
      const member = makeMember();
      prisma.roomMember.findUnique.mockResolvedValue(member);

      const result = await service.getMyMembership(USER_ID, ROOM_ID);

      expect(prisma.roomMember.findUnique).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: ROOM_ID, userId: USER_ID } },
      });
      expect(result).toEqual(member);
    });

    it('should return 404 for non-member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.getMyMembership(OTHER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('leaveRoom', () => {
    it('should let a MEMBER leave by deleting only RoomMember', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMember({ role: 'MEMBER' }));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.roomMember.delete.mockResolvedValue(makeMember());

      await service.leaveRoom(OTHER_ID, ROOM_ID);

      expect(prisma.roomMember.delete).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: ROOM_ID, userId: OTHER_ID } },
      });
    });

    it('should reject OWNER leave with 409 OWNER_CANNOT_LEAVE', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMember({ role: 'OWNER' }));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());

      await expect(service.leaveRoom(USER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'OWNER_CANNOT_LEAVE' },
      });
      expect(prisma.roomMember.delete).not.toHaveBeenCalled();
    });

    it('should reject leave when room is ENDED with 409 ROOM_ENDED', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(makeMember({ role: 'MEMBER' }));
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom({ status: 'ENDED' }));

      await expect(service.leaveRoom(OTHER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ROOM_ENDED' },
      });
      expect(prisma.roomMember.delete).not.toHaveBeenCalled();
    });

    it('should return 404 for non-member', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.leaveRoom(OTHER_ID, ROOM_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND' },
      });
    });
  });

  describe('removeMember', () => {
    it('should let owner remove a MEMBER', async () => {
      prisma.roomMember.findUnique
        .mockResolvedValueOnce(makeMember({ userId: USER_ID, role: 'OWNER' })) // owner membership
        .mockResolvedValueOnce(makeMember({ userId: OTHER_ID, role: 'MEMBER' })); // target
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());
      prisma.roomMember.delete.mockResolvedValue(makeMember());

      await service.removeMember(USER_ID, ROOM_ID, OTHER_ID);

      expect(prisma.roomMember.delete).toHaveBeenCalledWith({
        where: { roomId_userId: { roomId: ROOM_ID, userId: OTHER_ID } },
      });
    });

    it('should reject a MEMBER remove with 403 ROOM_NOT_OWNER', async () => {
      prisma.roomMember.findUnique.mockResolvedValueOnce(
        makeMember({ userId: OTHER_ID, role: 'MEMBER' }),
      );
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());

      await expect(service.removeMember(OTHER_ID, ROOM_ID, USER_ID)).rejects.toMatchObject({
        status: HttpStatus.FORBIDDEN,
        response: { code: 'ROOM_NOT_OWNER' },
      });
      expect(prisma.roomMember.delete).not.toHaveBeenCalled();
    });

    it('should reject removing the OWNER with 409 CANNOT_REMOVE_OWNER', async () => {
      prisma.roomMember.findUnique
        .mockResolvedValueOnce(makeMember({ userId: USER_ID, role: 'OWNER' })) // owner membership
        .mockResolvedValueOnce(makeMember({ userId: OTHER_ID, role: 'OWNER' })); // target is another owner
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());

      await expect(service.removeMember(USER_ID, ROOM_ID, OTHER_ID)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'CANNOT_REMOVE_OWNER' },
      });
      expect(prisma.roomMember.delete).not.toHaveBeenCalled();
    });

    it('should reject remove when room is ENDED with 409 ROOM_ENDED', async () => {
      prisma.roomMember.findUnique.mockResolvedValueOnce(
        makeMember({ userId: USER_ID, role: 'OWNER' }),
      );
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom({ status: 'ENDED' }));

      await expect(service.removeMember(USER_ID, ROOM_ID, OTHER_ID)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'ROOM_ENDED' },
      });
    });

    it('should return 404 for non-member operator', async () => {
      prisma.roomMember.findUnique.mockResolvedValue(null);

      await expect(service.removeMember(OTHER_ID, ROOM_ID, USER_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND' },
      });
    });

    it('should return 404 when target is not a member', async () => {
      prisma.roomMember.findUnique
        .mockResolvedValueOnce(makeMember({ userId: USER_ID, role: 'OWNER' }))
        .mockResolvedValueOnce(null);
      prisma.room.findUniqueOrThrow.mockResolvedValue(makeRoom());

      await expect(service.removeMember(USER_ID, ROOM_ID, OTHER_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'ROOM_NOT_FOUND' },
      });
    });
  });
});
