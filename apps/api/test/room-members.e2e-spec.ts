import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Room Members (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userA = `e2e_rm_a_${Date.now()}`;
  const userB = `e2e_rm_b_${Date.now()}`;
  const userC = `e2e_rm_c_${Date.now()}`;
  const userD = `e2e_rm_d_${Date.now()}`; // 永不加入房间，用于非成员断言
  const password = 'Password123';

  let tokenA: string;
  let tokenB: string;
  let tokenC: string;
  let tokenD: string;
  let roomId: string;
  let inviteCode: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_rm_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_rm_' } } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_rm_' } } });

    const register = async (username: string) => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username, password, nickname: username })
        .expect(201);
    };
    await register(userA);
    await register(userB);
    await register(userC);
    await register(userD);

    const login = async (username: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password })
        .expect(201);
      return res.body.data.accessToken as string;
    };
    tokenA = await login(userA);
    tokenB = await login(userB);
    tokenC = await login(userC);
    tokenD = await login(userD);
  });

  afterAll(async () => {
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_rm_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_rm_' } } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_rm_' } } });
    await app.close();
  });

  describe('POST /api/v1/rooms/join', () => {
    it('should join a room by invite code', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '成员测试酒局' })
        .expect(201);
      roomId = create.body.data.room.id;
      inviteCode = create.body.data.room.inviteCode;

      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ inviteCode })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.room).toMatchObject({ id: roomId, inviteCode });
      expect(res.body.data.member).toMatchObject({ role: 'MEMBER' });
      expect(res.body.data.member.userId).toBeTruthy();
    });

    it('should accept lowercase invite code (case-insensitive)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ inviteCode: inviteCode.toLowerCase() })
        .expect(201);

      expect(res.body.data.member.role).toBe('MEMBER');
    });

    it('should return 404 for an invalid invite code', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenC}`)
        .send({ inviteCode: 'ZZZZZZ' })
        .expect(404);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      });
    });

    it('should return 409 when already a member', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ inviteCode })
        .expect(409);

      expect(res.body.error.code).toBe('ALREADY_MEMBER');
    });

    it('should return 401 when no token is provided', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .send({ inviteCode })
        .expect(401);
    });
  });

  describe('GET /api/v1/rooms/:id/members', () => {
    it('should list members with OWNER first', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: userA } });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/members`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      expect(res.body.data.items[0].role).toBe('OWNER');
      expect(res.body.data.items[0].userId).toBe(owner.id);
      for (const m of res.body.data.items) {
        expect(m).not.toHaveProperty('passwordHash');
        expect(m).not.toHaveProperty('password');
      }
    });

    it('should return 404 for a non-member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/members`)
        .set('Authorization', `Bearer ${tokenD}`)
        .expect(404);

      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('GET /api/v1/rooms/:id/members/me', () => {
    it('should return my membership for a member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/members/me`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body.data.member).toMatchObject({ role: 'MEMBER' });
      expect(res.body.data.member.userId).toBeTruthy();
    });

    it('should return 404 for a non-member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/members/me`)
        .set('Authorization', `Bearer ${tokenD}`)
        .expect(404);

      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('POST /api/v1/rooms/:id/members/leave', () => {
    it('should let a MEMBER leave', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/members/leave`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(200);

      expect(res.body).toEqual({ success: true, data: {} });
    });

    it('should reject OWNER leave with 409', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/members/leave`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);

      expect(res.body.error.code).toBe('OWNER_CANNOT_LEAVE');
    });
  });

  describe('rejoin after leave', () => {
    it('should let B rejoin the room', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ inviteCode })
        .expect(201);

      expect(res.body.data.member.role).toBe('MEMBER');
    });
  });

  describe('DELETE /api/v1/rooms/:id/members/:userId', () => {
    it('should let owner remove a MEMBER', async () => {
      const bUser = await prisma.user.findUniqueOrThrow({ where: { username: userB } });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/rooms/${roomId}/members/${bUser.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toEqual({ success: true, data: {} });
    });

    it('should return 404 for the removed member accessing members', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/members`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);

      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });

    it('should reject a MEMBER removing a member with 403', async () => {
      // B 已被移除，用 C 作为普通成员测试（C 也加入了）
      const aUser = await prisma.user.findUniqueOrThrow({ where: { username: userA } });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/rooms/${roomId}/members/${aUser.id}`)
        .set('Authorization', `Bearer ${tokenC}`)
        .expect(403);

      expect(res.body.error.code).toBe('ROOM_NOT_OWNER');
    });

    it('should reject removing the OWNER with 409', async () => {
      const aUser = await prisma.user.findUniqueOrThrow({ where: { username: userA } });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/rooms/${roomId}/members/${aUser.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(409);

      expect(res.body.error.code).toBe('CANNOT_REMOVE_OWNER');
    });
  });

  describe('ENDED room rules', () => {
    let endedRoomId: string;
    let endedInvite: string;

    it('should block join after room is ended', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '已结束酒局' })
        .expect(201);
      endedRoomId = create.body.data.room.id;
      endedInvite = create.body.data.room.inviteCode;

      await request(app.getHttpServer())
        .post(`/api/v1/rooms/${endedRoomId}/end`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);
      // 模拟冷静期结束：直接置为 ENDED
      await prisma.room.update({
        where: { id: endedRoomId },
        data: { status: 'ENDED', finalizedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ inviteCode: endedInvite })
        .expect(409);

      expect(res.body.error.code).toBe('ROOM_ENDED');
    });

    it('should reject joining an ENDING room with 409 ROOM_ENDING', async () => {
      const create = await request(app.getHttpServer())
        .post('/api/v1/rooms')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ name: '冷静期加入房间' })
        .expect(201);
      const roomId = create.body.data.room.id;

      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'ENDING', endedAt: new Date() },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/rooms/join')
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ inviteCode: create.body.data.room.inviteCode })
        .expect(409);

      expect(res.body.error.code).toBe('ROOM_ENDING');
    });
  });
});
