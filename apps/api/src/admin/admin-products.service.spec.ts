import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { OperationLogService } from './operation-logs.service';
import { AdminProductsService } from './admin-products.service';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';

const makeProduct = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: PRODUCT_ID,
  barcode: '6901234567890',
  name: 'XX啤酒',
  brand: 'XX',
  category: 'BEER',
  volumeMl: 500,
  alcoholPercent: { toNumber: () => 4.3, toString: () => '4.3' },
  createdAt: new Date('2026-08-15T04:10:20.000Z'),
  updatedAt: new Date('2026-08-15T04:10:20.000Z'),
  ...overrides,
});

describe('AdminProductsService', () => {
  let service: AdminProductsService;
  let prisma: {
    product: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    operationLog: { create: jest.Mock };
  };
  let logService: OperationLogService;
  const request = {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'test-agent' },
  } as never;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      operationLog: { create: jest.fn() },
    };
    const logPrisma = { operationLog: prisma.operationLog };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: OperationLogService, useValue: new OperationLogService(logPrisma as never) },
      ],
    }).compile();

    service = module.get<AdminProductsService>(AdminProductsService);
    logService = module.get<OperationLogService>(OperationLogService);
    jest.spyOn(logService, 'log').mockResolvedValue(undefined);
  });

  describe('list', () => {
    it('should paginate and convert alcoholPercent to number', async () => {
      prisma.product.findMany.mockResolvedValue([makeProduct()]);
      prisma.product.count.mockResolvedValue(1);

      const result = await service.list({});

      expect(result).toMatchObject({ total: 1, page: 1, pageSize: 20 });
      expect(result.items[0].alcoholPercent).toBe(4.3);
      expect(result.items[0]).not.toHaveProperty('passwordHash');
    });
  });

  describe('update', () => {
    it('should update mutable fields but never barcode, and write log', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.product.update.mockResolvedValue(makeProduct({ name: 'XX精酿', volumeMl: 650 }));

      const result = await service.update(
        ADMIN_ID,
        PRODUCT_ID,
        { name: 'XX精酿', volumeMl: 650 },
        request,
      );

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { name: 'XX精酿', volumeMl: 650 },
      });
      expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('barcode');
      expect(logService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          adminUserId: ADMIN_ID,
          action: 'PRODUCT_UPDATE',
          targetType: 'Product',
          targetId: PRODUCT_ID,
        }),
      );
      expect(result.name).toBe('XX精酿');
    });

    it('should return 404 when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(
        service.update(ADMIN_ID, PRODUCT_ID, { name: 'X' }, request),
      ).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      });
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });
});
