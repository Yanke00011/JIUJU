import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const username = `e2e_prod_${Date.now()}`;
  const password = 'Password123';
  let token: string;

  const barcode = `69${String(Date.now()).slice(-10)}`;
  const createdIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_prod_' } } });

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username, password, nickname: username })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(201);
    token = login.body.data.accessToken;
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.product.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_prod_' } } });
    await app.close();
  });

  describe('POST /api/v1/products', () => {
    it('should create a product', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          barcode,
          name: 'XX啤酒',
          brand: 'XX',
          category: 'BEER',
          volumeMl: 500,
          alcoholPercent: 4.3,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.product).toMatchObject({
        barcode,
        name: 'XX啤酒',
        brand: 'XX',
        category: 'BEER',
        volumeMl: 500,
        alcoholPercent: 4.3,
      });
      expect(res.body.data.product).not.toHaveProperty('passwordHash');
      createdIds.push(res.body.data.product.id);
    });

    it('should return 409 on duplicate barcode', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({ barcode, name: '另一个', category: 'OTHER', volumeMl: 100 })
        .expect(409);

      expect(res.body.error.code).toBe('PRODUCT_ALREADY_EXISTS');
    });

    it('should return 400 on invalid category', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          barcode: `69${String(Date.now()).slice(-9)}1`,
          name: 'X',
          category: 'FOO',
          volumeMl: 100,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 on invalid alcoholPercent', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          barcode: `69${String(Date.now()).slice(-9)}2`,
          name: 'X',
          category: 'OTHER',
          volumeMl: 100,
          alcoholPercent: 150,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 on invalid volumeMl', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${token}`)
        .send({
          barcode: `69${String(Date.now()).slice(-9)}3`,
          name: 'X',
          category: 'OTHER',
          volumeMl: 0,
        })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          barcode: `69${String(Date.now()).slice(-9)}4`,
          name: 'X',
          category: 'OTHER',
          volumeMl: 100,
        })
        .expect(401);
    });
  });

  describe('GET /api/v1/products/barcode/:barcode', () => {
    it('should find a product by barcode', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/barcode/${barcode}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.product).toMatchObject({
        barcode,
        name: 'XX啤酒',
        category: 'BEER',
      });
      expect(res.body.data.product.alcoholPercent).toBe(4.3);
    });

    it('should return 404 for unknown barcode', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/barcode/9999999999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });

    it('should return 400 for invalid barcode format', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/barcode/12AB')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/products/:id', () => {
    it('should find a product by id', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.data.product.id).toBe(id);
    });

    it('should return 404 for unknown id', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/99999999-9999-4999-8999-999999999999')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/products/:id', () => {
    it('should update mutable fields and reflect in barcode lookup', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'XX精酿啤酒', volumeMl: 650, alcoholPercent: 5.2 })
        .expect(200);

      expect(res.body.data.product.name).toBe('XX精酿啤酒');
      expect(res.body.data.product.volumeMl).toBe(650);
      expect(res.body.data.product.alcoholPercent).toBe(5.2);
      expect(res.body.data.product.barcode).toBe(barcode);

      const lookup = await request(app.getHttpServer())
        .get(`/api/v1/products/barcode/${barcode}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(lookup.body.data.product.name).toBe('XX精酿啤酒');
    });

    it('should return 400 when trying to modify barcode', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .patch(`/api/v1/products/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ barcode: '1111111111111' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/products/:id', () => {
    it('should not allow deleting a product (404)', async () => {
      const id = createdIds[0];
      const res = await request(app.getHttpServer())
        .delete(`/api/v1/products/${id}`)
        .set('Authorization', `Bearer ${token}`);

      expect([404, 405]).toContain(res.status);
    });
  });
});
