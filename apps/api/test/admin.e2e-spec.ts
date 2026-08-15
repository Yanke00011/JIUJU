import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';
import { ARGON2_OPTIONS } from './../src/auth/auth.constants';

describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminName = `e2e_admin_${Date.now()}`;
  const superAdminName = `e2e_superadmin_${Date.now()}`;
  const userName = `e2e_admin_user_${Date.now()}`;
  const password = 'Password123';

  let adminToken: string;
  let userToken: string;
  let targetUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.operationLog.deleteMany({
      where: { admin: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e_admin' } },
    });

    const passwordHash = await hash(password, ARGON2_OPTIONS);
    await prisma.user.create({
      data: { username: adminName, nickname: '管理员', passwordHash, role: 'ADMIN' },
    });
    await prisma.user.create({
      data: { username: superAdminName, nickname: '超级管理员', passwordHash, role: 'SUPER_ADMIN' },
    });
    const normalUser = await prisma.user.create({
      data: { username: userName, nickname: '普通用户', passwordHash, role: 'USER' },
    });
    targetUserId = normalUser.id;

    const login = async (username: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password })
        .expect(201);
      return res.body.data.accessToken as string;
    };
    adminToken = await login(adminName);
    userToken = await login(userName);
  });

  afterAll(async () => {
    await prisma.operationLog.deleteMany({
      where: { admin: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e_admin' } },
    });
    await app.close();
  });

  describe('Admin Guard', () => {
    it('should reject a USER token with 403 on all admin endpoints', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/admin/rooms')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
    });
  });

  describe('Admin users', () => {
    it('should list users with pagination and no passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, pageSize: 10 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(3);
      expect(res.body.data.total).toBeGreaterThanOrEqual(3);
      expect(res.body.data.page).toBe(1);
      expect(res.body.data.pageSize).toBe(10);
      for (const item of res.body.data.items) {
        expect(item).not.toHaveProperty('passwordHash');
      }
    });

    it('should return a user detail without passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/users/${targetUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.user.id).toBe(targetUserId);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should update a user status and write an operation log', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' })
        .expect(200);

      expect(res.body.data.user.status).toBe('DISABLED');

      const log = await prisma.operationLog.findFirst({
        where: { action: 'USER_STATUS_UPDATE', targetType: 'User', targetId: targetUserId },
      });
      expect(log).not.toBeNull();
      expect(JSON.parse(log!.details!)).toEqual({ from: 'ACTIVE', to: 'DISABLED' });

      // 恢复为 ACTIVE 以便后续不干扰
      await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${targetUserId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' })
        .expect(200);
    });

    it('should forbid disabling self', async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/users/${adminUser.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DISABLED' })
        .expect(403);

      expect(res.body.error.code).toBe('CANNOT_DISABLE_SELF');
    });
  });

  describe('Admin rooms', () => {
    it('should list rooms with owner and memberCount', async () => {
      // 创建一个房间供 admin 列表使用
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      await prisma.room.create({
        data: {
          name: '后台房间',
          ownerId: adminUser.id,
          inviteCode: 'ADMIN6',
        },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, pageSize: 20 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.some((r: { name: string }) => r.name === '后台房间')).toBe(true);
      for (const r of res.body.data.items) {
        expect(r).toHaveProperty('memberCount');
        expect(r).toHaveProperty('owner');
      }
    });

    it('should return room detail with member count and stats', async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.findFirstOrThrow({ where: { name: '后台房间' } });
      // 房间创建后通常带有 OWNER 成员；这里直接补上成员关系
      await prisma.roomMember.upsert({
        where: { roomId_userId: { roomId: room.id, userId: adminUser.id } },
        update: {},
        create: { roomId: room.id, userId: adminUser.id, role: 'OWNER' },
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/rooms/${room.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.room).toMatchObject({
        id: room.id,
        memberCount: 1,
        drinkRecordCount: 0,
      });
      expect(res.body.data.room.stats).toMatchObject({
        totalQuantity: 0,
        totalVolumeMl: 0,
        totalAlcoholMl: 0,
      });
      expect(adminUser.id).toBe(room.ownerId);
    });
  });

  describe('Admin products', () => {
    let productId: string;

    beforeAll(async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const adminUserId = adminUser.id;
      // 直接创建商品
      const product = await prisma.product.create({
        data: {
          barcode: `65${String(Date.now()).slice(-10)}`,
          name: '后台啤酒',
          brand: 'ADMIN',
          category: 'BEER',
          volumeMl: 500,
          alcoholPercent: 4.3,
        },
      });
      productId = product.id;
      void adminUserId;
    });

    afterAll(async () => {
      await prisma.product.deleteMany({ where: { name: '后台啤酒' } });
    });

    it('should list products with pagination', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, pageSize: 20 })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.items.some((p: { id: string }) => p.id === productId)).toBe(true);
    });

    it('should update a product and write an operation log', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '后台精酿', volumeMl: 650 })
        .expect(200);

      expect(res.body.data.product.name).toBe('后台精酿');
      expect(res.body.data.product.barcode).toBeTruthy();

      const log = await prisma.operationLog.findFirst({
        where: { action: 'PRODUCT_UPDATE', targetType: 'Product', targetId: productId },
      });
      expect(log).not.toBeNull();
    });

    it('should reject modifying barcode with 400', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/admin/products/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ barcode: '1111111111111' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
