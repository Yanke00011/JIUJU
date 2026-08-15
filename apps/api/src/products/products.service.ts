import { BadRequestException, HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, type Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import {
  PageResult,
  PaginationQuery,
  parsePagination,
} from '../common/utils/pagination';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { toProductDto, ProductDto } from './product.dto';

const BARCODE_REGEX = /^\d{8,14}$/;

interface PrismaUniqueError {
  code?: string;
  meta?: { target?: unknown };
}

function isBarcodeUniqueError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as PrismaUniqueError;
  if (err.code !== 'P2002') {
    return false;
  }
  const target = err.meta?.target;
  if (typeof target === 'string') {
    return target === 'barcode';
  }
  if (Array.isArray(target)) {
    return target.includes('barcode');
  }
  return false;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByBarcode(barcode: string): Promise<Product> {
    const normalized = this.normalizeBarcode(barcode);
    const product = await this.prisma.product.findUnique({
      where: { barcode: normalized },
    });
    if (!product) {
      throw new BusinessException('PRODUCT_NOT_FOUND', '酒品不存在', HttpStatus.NOT_FOUND);
    }
    return product;
  }

  async findById(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new BusinessException('PRODUCT_NOT_FOUND', '酒品不存在', HttpStatus.NOT_FOUND);
    }
    return product;
  }

  /** 分页搜索商品（登录用户可用），支持按 barcode / name / brand 关键词搜索 */
  async list(query: PaginationQuery & { keyword?: string }): Promise<PageResult<ProductDto>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.buildWhere(query.keyword);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);

    return { items: products.map(toProductDto), total, page, pageSize };
  }

  private buildWhere(keyword?: string): Prisma.ProductWhereInput {
    if (!keyword || keyword.trim() === '') {
      return {};
    }
    const kw = keyword.trim();
    return {
      OR: [
        { barcode: { contains: kw, mode: 'insensitive' } },
        { name: { contains: kw, mode: 'insensitive' } },
        { brand: { contains: kw, mode: 'insensitive' } },
      ],
    };
  }

  async create(dto: CreateProductDto): Promise<Product> {
    const data = this.toCreateData(dto);
    try {
      return await this.prisma.product.create({ data });
    } catch (error) {
      if (isBarcodeUniqueError(error)) {
        throw new BusinessException(
          'PRODUCT_ALREADY_EXISTS',
          '该条形码对应的酒品已存在',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException('PRODUCT_NOT_FOUND', '酒品不存在', HttpStatus.NOT_FOUND);
    }

    const data: {
      name?: string;
      brand?: string | null;
      category?: Product['category'];
      volumeMl?: number;
      alcoholPercent?: number;
    } = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.brand !== undefined) data.brand = dto.brand || null;
    if (dto.category !== undefined) data.category = dto.category;
    if (dto.volumeMl !== undefined) data.volumeMl = dto.volumeMl;
    if (dto.alcoholPercent !== undefined) data.alcoholPercent = dto.alcoholPercent;

    return this.prisma.product.update({ where: { id }, data });
  }

  private toCreateData(dto: CreateProductDto) {
    return {
      barcode: dto.barcode.trim(),
      name: dto.name.trim(),
      brand: dto.brand?.trim() || null,
      category: dto.category,
      volumeMl: dto.volumeMl,
      alcoholPercent: dto.alcoholPercent ?? null,
    };
  }

  private normalizeBarcode(barcode: string): string {
    const normalized = barcode.trim();
    if (!BARCODE_REGEX.test(normalized)) {
      throw new BadRequestException('条形码必须是 8-14 位数字');
    }
    return normalized;
  }
}
