import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLogsService } from './admin-logs.service';

const LOG_ID = '11111111-1111-4111-8111-111111111111';

const makeLog = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: LOG_ID,
  adminUserId: '22222222-2222-4222-8222-222222222222',
  action: 'PRODUCT_UPDATE',
  targetType: 'Product',
  targetId: '33333333-3333-4333-8333-333333333333',
  details: JSON.stringify({ fields: ['name'] }),
  ip: '127.0.0.1',
  userAgent: 'test-agent',
  createdAt: new Date('2026-08-15T05:00:00.000Z'),
  admin: { id: '22222222-2222-4222-8222-222222222222', username: 'admin' },
  ...overrides,
});

describe('AdminLogsService', () => {
  let service: AdminLogsService;
  let prisma: {
    operationLog: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      operationLog: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AdminLogsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<AdminLogsService>(AdminLogsService);
  });

  describe('list', () => {
    it('should paginate logs sorted by createdAt DESC and parse details JSON', async () => {
      prisma.operationLog.findMany.mockResolvedValue([makeLog()]);
      prisma.operationLog.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(prisma.operationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(result.items[0]).toMatchObject({
        id: LOG_ID,
        action: 'PRODUCT_UPDATE',
        admin: { id: '22222222-2222-4222-8222-222222222222', username: 'admin' },
        details: { fields: ['name'] },
        ip: '127.0.0.1',
      });
      expect(result.items[0]).not.toHaveProperty('passwordHash');
    });

    it('should filter by action', async () => {
      prisma.operationLog.findMany.mockResolvedValue([]);
      prisma.operationLog.count.mockResolvedValue(0);

      await service.list({ action: 'PRODUCT_UPDATE' });

      expect(prisma.operationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'PRODUCT_UPDATE' }),
        }),
      );
    });

    it('should filter by targetType and targetId', async () => {
      prisma.operationLog.findMany.mockResolvedValue([]);
      prisma.operationLog.count.mockResolvedValue(0);

      await service.list({ targetType: 'User', targetId: 'x' });

      expect(prisma.operationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ targetType: 'User', targetId: 'x' }),
        }),
      );
    });

    it('should filter by time range', async () => {
      prisma.operationLog.findMany.mockResolvedValue([]);
      prisma.operationLog.count.mockResolvedValue(0);

      await service.list({ startDate: '2026-08-01T00:00:00Z', endDate: '2026-08-31T00:00:00Z' });

      const where = prisma.operationLog.findMany.mock.calls[0][0].where;
      expect(where.createdAt.gte).toBeInstanceOf(Date);
      expect(where.createdAt.lte).toBeInstanceOf(Date);
    });

    it('should parse invalid details JSON to null', async () => {
      prisma.operationLog.findMany.mockResolvedValue([makeLog({ details: 'not-json' })]);
      prisma.operationLog.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(result.items[0].details).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return a log with parsed details', async () => {
      prisma.operationLog.findUnique.mockResolvedValue(makeLog());

      const result = await service.getById(LOG_ID);

      expect(prisma.operationLog.findUnique).toHaveBeenCalledWith({
        where: { id: LOG_ID },
        include: expect.anything(),
      });
      expect(result.id).toBe(LOG_ID);
      expect(result.details).toEqual({ fields: ['name'] });
    });

    it('should return 404 when log does not exist', async () => {
      prisma.operationLog.findUnique.mockResolvedValue(null);

      await expect(service.getById(LOG_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'LOG_NOT_FOUND', message: '日志不存在' },
      });
    });
  });
});
