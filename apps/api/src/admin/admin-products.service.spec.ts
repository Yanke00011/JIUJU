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

const p2002Error = (target: string[]) => ({
  code: 'P2002',
  meta: { target },
  message: 'Unique constraint failed',
});

describe('AdminProductsService', () => {
  let service: AdminProductsService;
  let prisma: {
    product: { findMany: jest.Mock; count: jest.Mock; findUnique: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    drinkRecord: { count: jest.Mock };
    operationLog: { create: jest.Mock };
  };
  let logService: OperationLogService;
  const request = { ip: '127.0.0.1', headers: { 'user-agent': 'test' } } as never;

  beforeEach(async () => {
    prisma = {
      product: {
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      drinkRecord: { count: jest.fn().mockResolvedValue(0) },
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
    it('should pass keyword filter for barcode/name/brand search', async () => {
      prisma.product.findMany.mockResolvedValue([]);
      prisma.product.count.mockResolvedValue(0);

      await service.list({ keyword: '啤酒' });

      const where = prisma.product.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
    });
  });

  describe('create', () => {
    it('should create a product and log', async () => {
      prisma.product.create.mockResolvedValue(makeProduct());

      const result = await service.create(
        ADMIN_ID,
        { barcode: '6901234567890', name: 'XX啤酒', category: 'BEER', volumeMl: 500 },
        request,
      );

      expect(prisma.product.create).toHaveBeenCalled();
      expect(result.name).toBe('XX啤酒');
      expect(logService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_CREATE' }),
      );
    });

    it('should return 409 on duplicate barcode', async () => {
      prisma.product.create.mockRejectedValue(p2002Error(['barcode']));

      await expect(
        service.create(ADMIN_ID, { barcode: '6901234567890', name: 'X', category: 'OTHER', volumeMl: 1 }, request),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'PRODUCT_ALREADY_EXISTS' },
      });
    });
  });

  describe('delete', () => {
    it('should delete a product with no drink records', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.drinkRecord.count.mockResolvedValue(0);

      await service.delete(ADMIN_ID, PRODUCT_ID, request);

      expect(prisma.product.delete).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } });
    });

    it('should reject deleting a product in use', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.drinkRecord.count.mockResolvedValue(3);

      await expect(service.delete(ADMIN_ID, PRODUCT_ID, request)).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'PRODUCT_IN_USE' },
      });
      expect(prisma.product.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.delete(ADMIN_ID, PRODUCT_ID, request)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
      });
    });
  });

  describe('batchDelete', () => {
    it('should delete unreferenced products and report failures for referenced ones', async () => {
      prisma.product.findUnique
        .mockResolvedValueOnce(makeProduct({ id: 'p1' }))
        .mockResolvedValueOnce(makeProduct({ id: 'p2' }))
        .mockResolvedValueOnce(makeProduct({ id: 'p3' }));
      prisma.drinkRecord.count
        .mockResolvedValueOnce(0) // p1 可删
        .mockResolvedValueOnce(3) // p2 被引用
        .mockResolvedValueOnce(0); // p3 可删

      const result = await service.batchDelete(ADMIN_ID, ['p1', 'p2', 'p3'], request);

      expect(result.successCount).toBe(2);
      expect(result.failCount).toBe(1);
      expect(result.failed[0]).toMatchObject({ id: 'p2', code: 'PRODUCT_IN_USE' });
      expect(prisma.product.delete).toHaveBeenCalledTimes(2);
      expect(logService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'PRODUCT_BATCH_DELETE' }),
      );
    });

    it('should report PRODUCT_NOT_FOUND for missing ids', async () => {
      prisma.product.findUnique.mockResolvedValueOnce(null);

      const result = await service.batchDelete(ADMIN_ID, ['missing'], request);

      expect(result).toEqual({
        successCount: 0,
        failCount: 1,
        failed: [{ id: 'missing', code: 'PRODUCT_NOT_FOUND', message: '商品不存在' }],
      });
    });

    it('should dedupe ids', async () => {
      prisma.product.findUnique.mockResolvedValue(makeProduct());
      prisma.drinkRecord.count.mockResolvedValue(0);

      const result = await service.batchDelete(ADMIN_ID, ['p1', 'p1'], request);

      expect(result.successCount).toBe(1);
      expect(prisma.product.delete).toHaveBeenCalledTimes(1);
    });
  });
});
