import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { applyAppConfig } from './../src/app.config';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyAppConfig(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('should return ok with unified success envelope and database status', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(res.body).toEqual({
        success: true,
        data: { status: 'ok', database: 'up' },
      });
    });
  });

  describe('GET /api/docs', () => {
    it('should expose swagger UI', async () => {
      await request(app.getHttpServer()).get('/api/docs').expect(200);
    });

    it('should expose openapi json', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

      expect(res.body).toMatchObject({
        openapi: expect.any(String),
        info: expect.any(Object),
        paths: expect.objectContaining({
          '/api/v1/health': expect.any(Object),
        }),
      });
    });
  });

  describe('unknown route', () => {
    it('should return unified error envelope with 404', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/not-exist').expect(404);

      expect(res.body).toEqual({
        success: false,
        error: { code: 'NOT_FOUND', message: '资源不存在' },
      });
    });
  });
});
