import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Statistics (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerName = `e2e_stat_owner_${Date.now()}`;
  const memberName = `e2e_stat_member_${Date.now()}`;
  const outsiderName = `e2e_stat_outsider_${Date.now()}`;
  const password = 'Password123';

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let roomId: string;
  let productId: string;
  let ownerUserId: string;
  let memberUserId: string;
  let createdDrinkId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_stat_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_stat_' } } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_stat_' } } });

    const register = async (username: string) => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username, password, nickname: username })
        .expect(201);
    };
    await register(ownerName);
    await register(memberName);
    await register(outsiderName);

    const login = async (username: string) => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password })
        .expect(201);
      return res.body.data.accessToken as string;
    };
    ownerToken = await login(ownerName);
    memberToken = await login(memberName);
    outsiderToken = await login(outsiderName);

    ownerUserId = (await prisma.user.findUniqueOrThrow({ where: { username: ownerName } })).id;
    memberUserId = (await prisma.user.findUniqueOrThrow({ where: { username: memberName } })).id;

    const roomRes = await request(app.getHttpServer())
      .post('/api/v1/rooms')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: '统计测试酒局' })
      .expect(201);
    roomId = roomRes.body.data.room.id;

    await request(app.getHttpServer())
      .post('/api/v1/rooms/join')
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ inviteCode: roomRes.body.data.room.inviteCode })
      .expect(201);

    const productRes = await request(app.getHttpServer())
      .post('/api/v1/products')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        barcode: `67${String(Date.now()).slice(-10)}`,
        name: '统计啤酒',
        brand: 'TEST',
        category: 'BEER',
        volumeMl: 500,
        alcoholPercent: 4,
      })
      .expect(201);
    productId = productRes.body.data.product.id;
  });

  afterAll(async () => {
    await prisma.drinkRecord.deleteMany({
      where: { room: { owner: { username: { startsWith: 'e2e_stat_' } } } },
    });
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_stat_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_stat_' } } },
    });
    await prisma.product.deleteMany({ where: { name: '统计啤酒' } });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_stat_' } } });
    await app.close();
  });

  describe('GET /api/v1/rooms/:id/statistics', () => {
    it('should return empty statistics before any drinks', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/statistics`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toEqual({
        records: 0,
        totalQuantity: 0,
        totalVolumeMl: 0,
        totalAlcoholMl: 0,
      });
      expect(res.body.data.users).toEqual([]);
      expect(res.body.data.products).toEqual([]);
    });

    it('should compute totals, user ranking, and product ranking after creating drinks', async () => {
      // OWNER 给自己登记 2 瓶 500ml/4%
      await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ productId, userId: ownerUserId, quantity: 2 })
        .expect(201);

      // OWNER 给 member 登记 1 瓶 500ml/4%
      const res2 = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ productId, userId: memberUserId, quantity: 1 })
        .expect(201);
      createdDrinkId = res2.body.data.record.id;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/statistics`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      // 总记录 2，总数量 3，总容量 1500ml，酒精 3*500*4/100 = 60ml
      expect(res.body.data.total).toEqual({
        records: 2,
        totalQuantity: 3,
        totalVolumeMl: 1500,
        totalAlcoholMl: 60,
      });

      // 用户排行按酒精量降序：OWNER(2瓶=40ml) 在前
      const users = res.body.data.users as Array<{
        userId: string;
        quantity: number;
        alcoholMl: number;
      }>;
      expect(users).toHaveLength(2);
      expect(users[0].userId).toBe(ownerUserId);
      expect(users[0].quantity).toBe(2);
      expect(users[0].alcoholMl).toBe(40);
      expect(users[1].userId).toBe(memberUserId);
      expect(users[1].quantity).toBe(1);
      expect(users[1].alcoholMl).toBe(20);

      const products = res.body.data.products as Array<{
        productId: string;
        quantity: number;
        volumeMl: number;
      }>;
      expect(products).toHaveLength(1);
      expect(products[0].productId).toBe(productId);
      expect(products[0].quantity).toBe(3);
      expect(products[0].volumeMl).toBe(1500);
    });

    it('should exclude soft-deleted records from statistics', async () => {
      // 软删除 member 的那条记录
      await request(app.getHttpServer())
        .delete(`/api/v1/rooms/${roomId}/drinks/${createdDrinkId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/statistics`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(res.body.data.total).toEqual({
        records: 1,
        totalQuantity: 2,
        totalVolumeMl: 1000,
        totalAlcoholMl: 40,
      });
      expect(res.body.data.users).toHaveLength(1);
      expect(res.body.data.users[0].userId).toBe(ownerUserId);
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get(`/api/v1/rooms/${roomId}/statistics`).expect(401);
    });

    it('should return 404 for a non-member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/statistics`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });
});
