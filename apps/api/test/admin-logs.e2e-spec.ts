import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';
import { ARGON2_OPTIONS } from './../src/auth/auth.constants';

describe('Admin Logs (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const adminName = `e2e_logs_admin_${Date.now()}`;
  const userName = `e2e_logs_user_${Date.now()}`;
  const password = 'Password123';

  let adminToken: string;
  let userToken: string;
  let targetUserId: string;
  let productId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.operationLog.deleteMany({
      where: { admin: { username: { startsWith: 'e2e_logs_' } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_logs_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_logs_' } } },
    });
    await prisma.product.deleteMany({ where: { name: '日志啤酒' } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_logs_' } } });

    const passwordHash = await hash(password, ARGON2_OPTIONS);
    await prisma.user.create({
      data: { username: adminName, nickname: '管理员', passwordHash, role: 'ADMIN' },
    });
    const normalUser = await prisma.user.create({
      data: { username: userName, nickname: '普通用户', passwordHash, role: 'USER' },
    });
    targetUserId = normalUser.id;

    const product = await prisma.product.create({
      data: {
        barcode: `64${String(Date.now()).slice(-10)}`,
        name: '日志啤酒',
        brand: 'LOG',
        category: 'BEER',
        volumeMl: 500,
        alcoholPercent: 4.3,
      },
    });
    productId = product.id;

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
      where: { admin: { username: { startsWith: 'e2e_logs_' } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_logs_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_logs_' } } },
    });
    await prisma.product.deleteMany({ where: { name: '日志啤酒' } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_logs_' } } });
    await app.close();
  });

  it('should reject a USER token with 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/logs')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should write logs from admin actions and let admin query them', async () => {
    // 修改用户状态
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/users/${targetUserId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'DISABLED' })
      .expect(200);
    // 修改商品
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/products/${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: '日志精酿', volumeMl: 650 })
      .expect(200);

    // 查询日志
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ page: 1, pageSize: 20 })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    const actions = res.body.data.items.map((l: { action: string }) => l.action);
    expect(actions).toContain('USER_STATUS_UPDATE');
    expect(actions).toContain('PRODUCT_UPDATE');
    for (const item of res.body.data.items) {
      expect(item).not.toHaveProperty('passwordHash');
      expect(item.admin.username).toBeTruthy();
    }
  });

  it('should filter logs by action', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'PRODUCT_UPDATE' })
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    for (const item of res.body.data.items) {
      expect(item.action).toBe('PRODUCT_UPDATE');
      expect(item.details).toEqual({ fields: ['name', 'volumeMl'] });
    }
  });

  it('should filter logs by targetType', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ targetType: 'User' })
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(1);
    for (const item of res.body.data.items) {
      expect(item.targetType).toBe('User');
    }
  });

  it('should filter logs by time range', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ startDate: '2026-01-01T00:00:00Z', endDate: '2030-01-01T00:00:00Z' })
      .expect(200);

    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
  });

  it('should return log detail by id', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/admin/logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'PRODUCT_UPDATE' })
      .expect(200);
    const logId = list.body.data.items[0].id;

    const res = await request(app.getHttpServer())
      .get(`/api/v1/admin/logs/${logId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(res.body.data.log.id).toBe(logId);
    expect(res.body.data.log.action).toBe('PRODUCT_UPDATE');
  });

  it('should return 404 for unknown log', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/logs/99999999-9999-4999-8999-999999999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);

    expect(res.body.error.code).toBe('LOG_NOT_FOUND');
  });
});
