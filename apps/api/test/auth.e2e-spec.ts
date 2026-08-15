import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { hash } from '@node-rs/argon2';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';
import { PrismaService } from './../src/prisma/prisma.service';
import { ARGON2_OPTIONS } from './../src/auth/auth.constants';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  const username = `e2e_auth_${Date.now()}`;
  const password = 'Password123';
  const nickname = '端到端用户';

  const USERNAME_TAKEN = `e2e_auth_taken_${Date.now()}`;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();

    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    const config = app.get(ConfigService);
    expect(config.get('JWT_SECRET')).toBeTruthy();

    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e_auth_' } },
    });
    await prisma.user.create({
      data: {
        username: USERNAME_TAKEN,
        nickname: '已占用',
        passwordHash: await hash('Password123', ARGON2_OPTIONS),
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { username: { startsWith: 'e2e_auth_' } },
    });
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should register a user and return public user (no passwordHash)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username, password, nickname })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toMatchObject({
        username,
        nickname,
        role: 'USER',
        status: 'ACTIVE',
      });
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user.id).toBeTruthy();
    });

    it('should return 409 when username is already taken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ username: USERNAME_TAKEN, password, nickname })
        .expect(409);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'USERNAME_TAKEN', message: '用户名已被占用' },
      });
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should login and return accessToken + user, update lastLoginAt', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeTruthy();
      expect(res.body.data.tokenType).toBe('Bearer');
      expect(res.body.data.user.username).toBe(username);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
      expect(res.body.data.user.lastLoginAt).toBeTruthy();
    });

    it('should return 401 INVALID_CREDENTIALS on wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password: 'WrongPass123' })
        .expect(401);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'UNAUTHORIZED', message: '用户名或密码错误' },
      });
    });

    it('should return 401 INVALID_CREDENTIALS for nonexistent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: `e2e_auth_nobody_${Date.now()}`, password })
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
      expect(res.body.error.message).toBe('用户名或密码错误');
    });

    it('should return 401 INVALID_CREDENTIALS for disabled user', async () => {
      const disabledUsername = `e2e_auth_disabled_${Date.now()}`;
      await prisma.user.create({
        data: {
          username: disabledUsername,
          nickname: '禁用',
          passwordHash: await hash(password, ARGON2_OPTIONS),
          status: 'DISABLED',
        },
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username: disabledUsername, password })
        .expect(401);

      expect(res.body.error.message).toBe('用户名或密码错误');
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return current user with valid token', async () => {
      const login = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ username, password })
        .expect(201);
      const token = login.body.data.accessToken;

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.user.username).toBe(username);
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 when no token is provided', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token is invalid', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.value')
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when token is expired', async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { username } });
      const expired = await jwtService.signAsync(
        { sub: user.id, role: user.role },
        { expiresIn: -1 },
      );

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expired}`)
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 401 when user is disabled', async () => {
      const disabledUsername = `e2e_auth_me_disabled_${Date.now()}`;
      const disabled = await prisma.user.create({
        data: {
          username: disabledUsername,
          nickname: '禁用',
          passwordHash: await hash(password, ARGON2_OPTIONS),
          status: 'DISABLED',
        },
      });
      const token = await jwtService.signAsync({ sub: disabled.id, role: disabled.role });

      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
