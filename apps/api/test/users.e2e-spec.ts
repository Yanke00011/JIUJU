import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';

describe('Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const username = `e2e_user_${Date.now()}`;
  const password = 'Password123';
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_user_' } } });

    const reg = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ username, password, nickname: '初始昵称' })
      .expect(201);
    expect(reg.body.data.user.id).toBeTruthy();

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password })
      .expect(201);
    accessToken = login.body.data.accessToken;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { username: { startsWith: 'e2e_user_' } } });
    await app.close();
  });

  describe('GET /api/v1/users/me', () => {
    it('should return current user profile without passwordHash', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        username,
        nickname: '初始昵称',
        role: 'USER',
        status: 'ACTIVE',
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user).not.toHaveProperty('password');
      expect(res.body.data.user.id).toBeTruthy();
      expect(res.body.data.user.createdAt).toBeTruthy();
      expect(res.body.data.user.updatedAt).toBeTruthy();
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('PATCH /api/v1/users/me', () => {
    it('should update nickname', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nickname: '新昵称' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.nickname).toBe('新昵称');
      expect(res.body.data.user.username).toBe(username);
      expect(res.body.data.user.role).toBe('USER');
      expect(res.body.data.user.status).toBe('ACTIVE');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should update avatar', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatar: 'https://example.com/avatar.jpg' })
        .expect(200);

      expect(res.body.data.user.avatar).toBe('https://example.com/avatar.jpg');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should reject invalid nickname (too long)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ nickname: 'x'.repeat(51) })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject invalid avatar URL', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ avatar: 'not-a-valid-url' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject role field (cannot change role)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ role: 'ADMIN' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject status field (cannot change status)', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ status: 'DISABLED' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/users/me')
        .send({ nickname: 'x' })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
