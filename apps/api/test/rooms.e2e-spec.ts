import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Rooms (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerUsername = `e2e_room_owner_${Date.now()}`;
  const memberUsername = `e2e_room_member_${Date.now()}`;
  const outsiderUsername = `e2e_room_outsider_${Date.now()}`;
  const password = 'Password123';

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_room_' } } });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_room_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_room_' } } },
    });

    for (const username of [ownerUsername, memberUsername, outsiderUsername]) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username, password, nickname: username })
        .expect(201);
    }

    const login = async (username: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password })
        .expect(201);
      return res.body.data.accessToken as string;
    };

    ownerToken = await login(ownerUsername);
    memberToken = await login(memberUsername);
    outsiderToken = await login(outsiderUsername);
  });

  afterAll(async () => {
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_room_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_room_' } } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_room_' } } });
    await app.close();
  });

  describe('POST /api/v1/rooms', () => {
    it('should create a room with owner as OWNER member and return inviteCode', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: '周末朋友酒局' })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.room).toMatchObject({
        name: '周末朋友酒局',
        status: 'ACTIVE',
        inviteCode: expect.stringMatching(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/),
      });
      expect(res.body.data.room.endedAt).toBeNull();

      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const membership = await prisma.roomMember.findUnique({
        where: {
          roomId_userId: { roomId: res.body.data.room.id, userId: owner.id },
        },
      });
      expect(membership).not.toBeNull();
      expect(membership!.role).toBe('OWNER');
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer()).post('/api/v1/rooms').send({ name: '未登录' }).expect(401);
    });
  });

  describe('GET /api/v1/rooms', () => {
    it('should only return rooms where the current user is a member', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const member = await prisma.user.findUniqueOrThrow({ where: { username: memberUsername } });

      const ownerRoom = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });

      // member 加入 owner 的房间
      await prisma.roomMember.create({
        data: { roomId: ownerRoom.id, userId: member.id, role: 'MEMBER' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/rooms')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items.some((r: { id: string }) => r.id === ownerRoom.id)).toBe(true);
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer()).get('/api/v1/rooms').expect(401);
    });
  });

  describe('GET /api/v1/rooms/:id', () => {
    it('should return room detail for a member', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${room.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.room.id).toBe(room.id);
    });

    it('should return 404 for a non-member without leaking existence', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${room.id}`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
    });
  });

  describe('POST /api/v1/rooms/:id/end', () => {
    it('should let owner move an ACTIVE room to ENDING (cooling period)', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.create({
        data: { name: '结束冷静期房间', ownerId: owner.id, inviteCode: 'ENDG01' },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: owner.id, role: 'OWNER' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/end`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.room.status).toBe('ENDING');
      expect(res.body.data.room.endedAt).toBeTruthy();
      expect(res.body.data.room.finalizedAt).toBeNull();
    });

    it('should return 409 ROOM_ALREADY_ENDING when already in ENDING', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.create({
        data: { name: '重复结束房间', ownerId: owner.id, inviteCode: 'ENDG02', status: 'ENDING', endedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/end`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);

      expect(res.body.error.code).toBe('ROOM_ALREADY_ENDING');
    });

    it('should return 409 ROOM_ALREADY_ENDED when room is already ended', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.create({
        data: { name: '已结束房间', ownerId: owner.id, inviteCode: 'ENDG03', status: 'ENDED', endedAt: new Date(), finalizedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/end`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);

      expect(res.body.error.code).toBe('ROOM_ALREADY_ENDED');
    });

    it('should not let a non-owner member end the room', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const member = await prisma.user.findUniqueOrThrow({ where: { username: memberUsername } });

      const room = await prisma.room.create({
        data: { name: '成员测试房间', ownerId: owner.id, inviteCode: 'B7K93Q' },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: member.id, role: 'MEMBER' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/end`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('ROOM_NOT_OWNER');
    });
  });

  describe('POST /api/v1/rooms/:id/cancel-end', () => {
    it('should let owner cancel an ENDING room back to ACTIVE', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.create({
        data: { name: '撤销结束房间', ownerId: owner.id, inviteCode: 'CANC01', status: 'ENDING', endedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/cancel-end`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.room.status).toBe('ACTIVE');
      expect(res.body.data.room.endedAt).toBeNull();
    });

    it('should not let a non-owner cancel the ending', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const member = await prisma.user.findUniqueOrThrow({ where: { username: memberUsername } });
      const room = await prisma.room.create({
        data: { name: '成员撤销房间', ownerId: owner.id, inviteCode: 'CANC02', status: 'ENDING', endedAt: new Date() },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: member.id, role: 'MEMBER' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/cancel-end`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(403);

      expect(res.body.error.code).toBe('ROOM_NOT_OWNER');
    });

    it('should return 409 when room is not ENDING', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.create({
        data: { name: '非结束房间', ownerId: owner.id, inviteCode: 'CANC03' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${room.id}/cancel-end`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(409);

      expect(res.body.error.code).toBe('ROOM_NOT_ENDING');
    });
  });

  describe('lazy finalize (cooling period expiry)', () => {
    it('should auto-finalize an expired ENDING room to ENDED on GET', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: ownerUsername } });
      const room = await prisma.room.create({
        data: {
          name: '自动归档房间',
          ownerId: owner.id,
          inviteCode: 'FINL01',
          status: 'ENDING',
          endedAt: new Date(Date.now() - 16 * 60 * 1000),
        },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: owner.id, role: 'OWNER' },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${room.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.room.status).toBe('ENDED');
      expect(res.body.data.room.finalizedAt).toBeTruthy();
    });
  });
});
