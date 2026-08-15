import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Drink Records (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerName = `e2e_drink_owner_${Date.now()}`;
  const memberName = `e2e_drink_member_${Date.now()}`;
  const outsiderName = `e2e_drink_outsider_${Date.now()}`;
  const password = 'Password123';

  let ownerToken: string;
  let memberToken: string;
  let outsiderToken: string;
  let roomId: string;
  let productId: string;
  let ownerUserId: string;
  let memberUserId: string;
  const createdDrinkIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_drink_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_drink_' } } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_drink_' } } });

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
      .send({ name: '饮酒测试酒局' })
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
        barcode: `69${String(Date.now()).slice(-10)}`,
        name: '测试啤酒',
        brand: 'TEST',
        category: 'BEER',
        volumeMl: 500,
        alcoholPercent: 4.3,
      })
      .expect(201);
    productId = productRes.body.data.product.id;
  });

  afterAll(async () => {
    if (createdDrinkIds.length > 0) {
      await prisma.drinkRecord.deleteMany({ where: { id: { in: createdDrinkIds } } });
    }
    await prisma.roomMember.deleteMany({
      where: { user: { username: { startsWith: 'e2e_drink_' } } },
    });
    await prisma.room.deleteMany({
      where: { owner: { username: { startsWith: 'e2e_drink_' } } },
    });
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_drink_' } } });
    await app.close();
  });

  describe('POST /api/v1/rooms/:id/drinks', () => {
    it('should let a MEMBER register themselves', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ productId, userId: memberUserId, quantity: 1 })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.record).toMatchObject({
        roomId,
        productId,
        userId: memberUserId,
        quantity: 1,
        volumeMlSnapshot: 500,
        alcoholPercentSnapshot: 4.3,
      });
      expect(res.body.data.record.product.name).toBe('测试啤酒');
      createdDrinkIds.push(res.body.data.record.id);
    });

    it('should reject MEMBER registering another user with 403', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ productId, userId: ownerUserId, quantity: 1 })
        .expect(403);

      expect(res.body.error.code).toBe('CANNOT_REGISTER_OTHERS');
    });

    it('should let OWNER register another member', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ productId, userId: memberUserId, quantity: 0.5 })
        .expect(201);

      expect(res.body.data.record.quantity).toBe(0.5);
      expect(res.body.data.record.userId).toBe(memberUserId);
      createdDrinkIds.push(res.body.data.record.id);
    });

    it('should return 404 for non-existent product', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          productId: '99999999-9999-4999-8999-999999999999',
          userId: memberUserId,
          quantity: 1,
        })
        .expect(404);

      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should reject invalid quantity with 400', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ productId, userId: memberUserId, quantity: 0 })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .send({ productId, userId: memberUserId, quantity: 1 })
        .expect(401);
    });

    it('should return 404 for a non-member', async () => {
      const outsider = await prisma.user.findUniqueOrThrow({ where: { username: outsiderName } });
      const res = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .send({ productId, userId: outsider.id, quantity: 1 })
        .expect(404);

      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('GET /api/v1/rooms/:id/drinks', () => {
    it('should list non-deleted records for a member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
      for (const item of res.body.data.items) {
        expect(item).not.toHaveProperty('passwordHash');
        expect(item.user.nickname).toBeTruthy();
        expect(item.product.name).toBeTruthy();
      }
    });

    it('should return 404 for non-member', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('ROOM_NOT_FOUND');
    });
  });

  describe('GET /api/v1/rooms/:id/drinks/:drinkId', () => {
    it('should return a single record', async () => {
      const id = createdDrinkIds[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/drinks/${id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body.data.record.id).toBe(id);
    });

    it('should return 404 for unknown record', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/drinks/99999999-9999-4999-8999-999999999999`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(404);

      expect(res.body.error.code).toBe('DRINK_RECORD_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/rooms/:id/drinks/:drinkId', () => {
    it('should let a MEMBER update their own quantity', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/rooms/${roomId}/drinks/${createdDrinkIds[0]}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ quantity: 2 })
        .expect(200);

      expect(res.body.data.record.quantity).toBe(2);
    });

    it('should reject a MEMBER updating the OWNER record', async () => {
      const ownerDrink = await request(app.getHttpServer())
        .post(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ productId, userId: ownerUserId, quantity: 1 })
        .expect(201);
      createdDrinkIds.push(ownerDrink.body.data.record.id);

      const res = await request(app.getHttpServer())
        .patch(`/api/v1/rooms/${roomId}/drinks/${ownerDrink.body.data.record.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ quantity: 5 })
        .expect(403);

      expect(res.body.error.code).toBe('DRINK_NOT_OWNER');
    });
  });

  describe('DELETE /api/v1/rooms/:id/drinks/:drinkId', () => {
    it('should soft delete a record and hide it from the list', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/rooms/${roomId}/drinks/${createdDrinkIds[0]}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      expect(res.body).toEqual({ success: true, data: {} });

      // 验证记录仍在数据库但被软删除
      const db = await prisma.drinkRecord.findUnique({
        where: { id: createdDrinkIds[0] },
      });
      expect(db).not.toBeNull();
      expect(db!.deletedAt).not.toBeNull();
      expect(db!.deletedBy).toBe(memberUserId);

      // 列表不再包含
      const list = await request(app.getHttpServer())
        .get(`/api/v1/rooms/${roomId}/drinks`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(list.body.data.items.some((r: { id: string }) => r.id === createdDrinkIds[0])).toBe(
        false,
      );
    });
  });
});
