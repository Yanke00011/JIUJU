import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';

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

describe('ProductsService', () => {
  let service: ProductsService;
  let prisma: {
    product: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      product: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  describe('findByBarcode', () => {
    it('should find a product by barcode', async () => {
      const product = makeProduct();
      prisma.product.findUnique.mockResolvedValue(product);

      const result = await service.findByBarcode('6901234567890');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { barcode: '6901234567890' },
      });
      expect(result).toEqual(product);
    });

    it('should return 404 when barcode does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findByBarcode('6901234567890')).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      });
    });

    it('should trim the barcode before lookup', async () => {
      const product = makeProduct();
      prisma.product.findUnique.mockResolvedValue(product);

      await service.findByBarcode('  6901234567890  ');

      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { barcode: '6901234567890' },
      });
    });

    it('should reject non-digit barcode with 400', async () => {
      await expect(service.findByBarcode('690ABC')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });

    it('should reject invalid barcode length with 400', async () => {
      await expect(service.findByBarcode('123')).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
      await expect(service.findByBarcode('1'.repeat(15))).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
      });
    });
  });

  describe('findById', () => {
    it('should find a product by id', async () => {
      const product = makeProduct();
      prisma.product.findUnique.mockResolvedValue(product);

      const result = await service.findById(PRODUCT_ID);

      expect(prisma.product.findUnique).toHaveBeenCalledWith({ where: { id: PRODUCT_ID } });
      expect(result).toEqual(product);
    });

    it('should return 404 when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findById(PRODUCT_ID)).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      });
    });
  });

  describe('create', () => {
    it('should create a product', async () => {
      const product = makeProduct();
      prisma.product.create.mockResolvedValue(product);

      const result = await service.create({
        barcode: ' 6901234567890 ',
        name: ' XX啤酒 ',
        brand: ' XX ',
        category: 'BEER',
        volumeMl: 500,
        alcoholPercent: 4.3,
      });

      expect(prisma.product.create).toHaveBeenCalledWith({
        data: {
          barcode: '6901234567890',
          name: 'XX啤酒',
          brand: 'XX',
          category: 'BEER',
          volumeMl: 500,
          alcoholPercent: 4.3,
        },
      });
      expect(result).toEqual(product);
    });

    it('should return 409 PRODUCT_ALREADY_EXISTS when barcode already exists', async () => {
      prisma.product.create.mockRejectedValue(p2002Error(['barcode']));

      await expect(
        service.create({
          barcode: '6901234567890',
          name: 'XX啤酒',
          category: 'BEER',
          volumeMl: 500,
        }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'PRODUCT_ALREADY_EXISTS', message: '该条形码对应的酒品已存在' },
      });
    });

    it('should convert concurrent duplicate create P2002 into PRODUCT_ALREADY_EXISTS', async () => {
      prisma.product.create.mockRejectedValue(p2002Error(['barcode']));

      await expect(
        service.create({ barcode: '6901234567890', name: 'X', category: 'OTHER', volumeMl: 1 }),
      ).rejects.toMatchObject({
        status: HttpStatus.CONFLICT,
        response: { code: 'PRODUCT_ALREADY_EXISTS' },
      });
    });
  });

  describe('update', () => {
    it('should update mutable fields but not barcode', async () => {
      const product = makeProduct();
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.product.update.mockResolvedValue({ ...product, name: 'XX精酿', volumeMl: 650 });

      const result = await service.update(PRODUCT_ID, { name: 'XX精酿', volumeMl: 650 });

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        data: { name: 'XX精酿', volumeMl: 650 },
      });
      expect(prisma.product.update.mock.calls[0][0].data).not.toHaveProperty('barcode');
      expect(result.name).toBe('XX精酿');
    });

    it('should clear brand to null when brand is empty string', async () => {
      const product = makeProduct();
      prisma.product.findUnique.mockResolvedValue(product);
      prisma.product.update.mockResolvedValue(product);

      await service.update(PRODUCT_ID, { brand: '' });

      expect(prisma.product.update.mock.calls[0][0].data).toEqual({ brand: null });
    });

    it('should return 404 when product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.update(PRODUCT_ID, { name: 'X' })).rejects.toMatchObject({
        status: HttpStatus.NOT_FOUND,
        response: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' },
      });
      expect(prisma.product.update).not.toHaveBeenCalled();
    });
  });
});
