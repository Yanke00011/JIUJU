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
  let superAdminToken: string;
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
    await prisma.drinkRecord.deleteMany({
      where: { room: { owner: { username: { startsWith: 'e2e_admin' } } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.product.deleteMany({
      where: {
        OR: [
          { name: '后台啤酒' },
          { name: '软删啤酒' },
          { name: '待删除啤酒' },
          { name: '引用中啤酒' },
          { name: '恢复啤酒' },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e_admin' } },
    });
    await prisma.operationLog.deleteMany({
      where: { admin: { username: { startsWith: 'e2e_admin' } } },
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
    superAdminToken = await login(superAdminName);
    userToken = await login(userName);
  });

  afterAll(async () => {
    await prisma.drinkRecord.deleteMany({
      where: { room: { owner: { username: { startsWith: 'e2e_admin' } } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_admin' } } },
    });
    await prisma.product.deleteMany({
      where: {
        OR: [
          { name: '后台啤酒' },
          { name: '软删啤酒' },
          { name: '待删除啤酒' },
          { name: '引用中啤酒' },
          { name: '恢复啤酒' },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e_admin' } },
    });
    await prisma.operationLog.deleteMany({
      where: { admin: { username: { startsWith: 'e2e_admin' } } },
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

  describe('Admin search', () => {
    it('should search users by keyword', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ keyword: userName })
        .expect(200);

      expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data.items[0].username).toBe(userName);
    });

    it('should search rooms by keyword', async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.create({
        data: { name: '搜索测试房间', ownerId: adminUser.id, inviteCode: 'SRCH01' },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: adminUser.id, role: 'OWNER' },
      });

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/rooms')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ keyword: '搜索测试' })
        .expect(200);

      expect(res.body.data.items.some((r: { name: string }) => r.name === '搜索测试房间')).toBe(true);

      await prisma.roomMember.deleteMany({ where: { roomId: room.id } });
      await prisma.room.deleteMany({ where: { id: room.id } });
    });

    it('should search products by keyword', async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const prod = await prisma.product.create({
        data: {
          barcode: `64${String(Date.now()).slice(-10)}`,
          name: '搜索专用啤酒',
          category: 'BEER',
          volumeMl: 500,
        },
      });
      void adminUser;

      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ keyword: '搜索专用' })
        .expect(200);

      expect(res.body.data.items.some((p: { name: string }) => p.name === '搜索专用啤酒')).toBe(true);

      await prisma.product.deleteMany({ where: { id: prod.id } });
    });
  });

  describe('Admin user delete', () => {
    it('should reject ADMIN deleting a user (403)', async () => {
      const victim = await prisma.user.create({
        data: {
          username: `e2e_admin_victim_${Date.now()}`,
          nickname: '受害者',
          passwordHash: await hash(password, ARGON2_OPTIONS),
        },
      });
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${victim.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
      expect(res.body.error.code).toBe('SUPER_ADMIN_REQUIRED');
    });

    it('should let SUPER_ADMIN physically delete a user without history', async () => {
      const victim = await prisma.user.create({
        data: {
          username: `e2e_admin_victim2_${Date.now()}`,
          nickname: '受害者2',
          passwordHash: await hash(password, ARGON2_OPTIONS),
        },
      });
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${victim.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.data).toEqual({ deleted: true, softDeleted: false });
      const gone = await prisma.user.findUnique({ where: { id: victim.id } });
      expect(gone).toBeNull();
    });

    it('should soft delete a user with drink history', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });
      const victim = await prisma.user.create({
        data: {
          username: `e2e_admin_victim3_${Date.now()}`,
          nickname: '受害者3',
          passwordHash: await hash(password, ARGON2_OPTIONS),
        },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: victim.id, role: 'MEMBER' },
      });
      const product = await prisma.product.create({
        data: {
          barcode: `63${String(Date.now()).slice(-10)}`,
          name: '软删啤酒',
          category: 'BEER',
          volumeMl: 500,
        },
      });
      await prisma.drinkRecord.create({
        data: {
          roomId: room.id,
          productId: product.id,
          userId: victim.id,
          createdBy: owner.id,
          barcode: product.barcode,
          volumeMlSnapshot: 500,
          quantity: 1,
          clientRequestId: `00000000-0000-4000-8000-${String(Date.now()).slice(-12)}`,
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${victim.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(res.body.data).toEqual({ deleted: false, softDeleted: true });
      const kept = await prisma.user.findUnique({ where: { id: victim.id } });
      expect(kept).not.toBeNull();
      expect(kept!.deletedAt).not.toBeNull();
      expect(kept!.status).toBe('DISABLED');
    });

    it('should reject deleting self', async () => {
      const superUser = await prisma.user.findUniqueOrThrow({ where: { username: superAdminName } });
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${superUser.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(403);
      expect(res.body.error.code).toBe('CANNOT_DELETE_SELF');
    });

    it('should reject deleting a SUPER_ADMIN', async () => {
      const otherSuper = await prisma.user.create({
        data: {
          username: `e2e_admin_othersuper_${Date.now()}`,
          nickname: '其他超管',
          passwordHash: await hash(password, ARGON2_OPTIONS),
          role: 'SUPER_ADMIN',
        },
      });
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/users/${otherSuper.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(403);
      expect(res.body.error.code).toBe('CANNOT_DELETE_SUPER_ADMIN');

      await prisma.user.deleteMany({ where: { id: otherSuper.id } });
    });
  });

  describe('Admin product delete', () => {
    it('should let SUPER_ADMIN delete a product with no references', async () => {
      const product = await prisma.product.create({
        data: {
          barcode: `62${String(Date.now()).slice(-10)}`,
          name: '待删除啤酒',
          category: 'BEER',
          volumeMl: 500,
        },
      });
      await request(app.getHttpServer())
        .delete(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      const gone = await prisma.product.findUnique({ where: { id: product.id } });
      expect(gone).toBeNull();
    });

    it('should reject deleting a product in use', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });
      const product = await prisma.product.create({
        data: {
          barcode: `61${String(Date.now()).slice(-10)}`,
          name: '引用中啤酒',
          category: 'BEER',
          volumeMl: 500,
        },
      });
      await prisma.drinkRecord.create({
        data: {
          roomId: room.id,
          productId: product.id,
          userId: owner.id,
          createdBy: owner.id,
          barcode: product.barcode,
          volumeMlSnapshot: 500,
          quantity: 1,
          clientRequestId: `00000000-0000-4000-8001-${String(Date.now()).slice(-12)}`,
        },
      });

      const res = await request(app.getHttpServer())
        .delete(`/api/v1/admin/products/${product.id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(409);

      expect(res.body.error.code).toBe('PRODUCT_IN_USE');
      const still = await prisma.product.findUnique({ where: { id: product.id } });
      expect(still).not.toBeNull();
    });
  });

  describe('Admin room end & drinks', () => {
    it('should end a room', async () => {
      const adminUser = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.create({
        data: { name: '结束测试房间', ownerId: adminUser.id, inviteCode: 'ENDT01' },
      });
      await prisma.roomMember.create({
        data: { roomId: room.id, userId: adminUser.id, role: 'OWNER' },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/rooms/${room.id}/end`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.room.status).toBe('ENDED');
    });

    it('should export room drinks as CSV', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/admin/rooms/${room.id}/export`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('用户');
      expect(res.text).toContain('酒品');
    });

    it('should restore a soft-deleted drink record', async () => {
      const owner = await prisma.user.findUniqueOrThrow({ where: { username: adminName } });
      const room = await prisma.room.findFirstOrThrow({ where: { ownerId: owner.id } });
      const product = await prisma.product.create({
        data: {
          barcode: `60${String(Date.now()).slice(-10)}`,
          name: '恢复啤酒',
          category: 'BEER',
          volumeMl: 500,
        },
      });
      const drink = await prisma.drinkRecord.create({
        data: {
          roomId: room.id,
          productId: product.id,
          userId: owner.id,
          createdBy: owner.id,
          barcode: product.barcode,
          volumeMlSnapshot: 500,
          quantity: 1,
          deletedAt: new Date(),
          deletedBy: owner.id,
          clientRequestId: `00000000-0000-4000-8002-${String(Date.now()).slice(-12)}`,
        },
      });

      const res = await request(app.getHttpServer())
        .post(`/api/v1/admin/drinks/${drink.id}/restore`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.record.deletedAt).toBeNull();
    });

    it('should list admin drinks including deleted', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/drinks')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, pageSize: 20 })
        .expect(200);

      expect(res.body.data.total).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });
  });

  describe('Admin dashboard', () => {
    it('should return stats and recent lists', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/admin/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data.stats).toHaveProperty('totalUsers');
      expect(res.body.data.stats).toHaveProperty('activeUsers');
      expect(res.body.data.stats).toHaveProperty('totalRooms');
      expect(res.body.data.stats).toHaveProperty('activeRooms');
      expect(res.body.data.stats).toHaveProperty('totalDrinkRecords');
      expect(res.body.data.stats).toHaveProperty('totalProducts');
      expect(Array.isArray(res.body.data.recentRooms)).toBe(true);
      expect(Array.isArray(res.body.data.recentLogs)).toBe(true);
    });
  });
});
