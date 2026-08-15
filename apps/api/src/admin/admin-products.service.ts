import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Product } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination, PaginationQuery } from '../common/utils/pagination';
import { OperationLogService } from './operation-logs.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { toProductDto, ProductDto } from '../products/product.dto';

export interface AdminProductQuery extends PaginationQuery {
  keyword?: string;
}

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
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
  ) {}

  async list(query: AdminProductQuery): Promise<PageResult<ProductDto>> {
    const { skip, take, page, pageSize } = parsePagination(query);
    const where = this.buildWhere(query.keyword);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
      this.prisma.product.count({ where }),
    ]);

    return { items: products.map(toProductDto), total, page, pageSize };
  }

  async create(adminUserId: string, dto: CreateProductDto, request: Request): Promise<ProductDto> {
    try {
      const product = await this.prisma.product.create({
        data: {
          barcode: dto.barcode.trim(),
          name: dto.name.trim(),
          brand: dto.brand?.trim() || null,
          category: dto.category,
          volumeMl: dto.volumeMl,
          alcoholPercent: dto.alcoholPercent ?? null,
        },
      });

      await this.operationLog.log({
        adminUserId,
        action: 'PRODUCT_CREATE',
        targetType: 'Product',
        targetId: product.id,
        metadata: { barcode: product.barcode },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      return toProductDto(product);
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

  async update(
    adminUserId: string,
    id: string,
    dto: UpdateProductDto,
    request: Request,
  ): Promise<ProductDto> {
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

    const updated = await this.prisma.product.update({ where: { id }, data });

    await this.operationLog.log({
      adminUserId,
      action: 'PRODUCT_UPDATE',
      targetType: 'Product',
      targetId: id,
      metadata: { fields: Object.keys(data) },
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    return toProductDto(updated);
  }

  /**
   * 删除商品（仅 SUPER_ADMIN）：
   * - 若商品已被 DrinkRecord 引用 → 禁止删除，返回 PRODUCT_IN_USE。
   */
  async delete(adminUserId: string, id: string, request: Request): Promise<void> {
    const existing = await this.prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new BusinessException('PRODUCT_NOT_FOUND', '酒品不存在', HttpStatus.NOT_FOUND);
    }

    const drinkCount = await this.prisma.drinkRecord.count({ where: { productId: id } });
    if (drinkCount > 0) {
      throw new BusinessException(
        'PRODUCT_IN_USE',
        '该商品已被饮酒记录引用，无法删除',
        HttpStatus.CONFLICT,
      );
    }

    await this.prisma.product.delete({ where: { id } });

    await this.operationLog.log({
      adminUserId,
      action: 'PRODUCT_DELETE',
      targetType: 'Product',
      targetId: id,
      metadata: {},
      ip: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });
  }

  /**
   * 批量删除商品（仅 SUPER_ADMIN）。
   * 逐个检查引用关系：未引用则删除；被引用则记为失败（PRODUCT_IN_USE）。
   * 返回成功/失败汇总与失败商品列表。
   */
  async batchDelete(
    adminUserId: string,
    ids: string[],
    request: Request,
  ): Promise<{
    successCount: number;
    failCount: number;
    failed: Array<{ id: string; code: string; message: string }>;
  }> {
    const uniqueIds = Array.from(new Set(ids));
    const failed: Array<{ id: string; code: string; message: string }> = [];
    let successCount = 0;

    for (const id of uniqueIds) {
      const existing = await this.prisma.product.findUnique({ where: { id } });
      if (!existing) {
        failed.push({ id, code: 'PRODUCT_NOT_FOUND', message: '商品不存在' });
        continue;
      }
      const drinkCount = await this.prisma.drinkRecord.count({ where: { productId: id } });
      if (drinkCount > 0) {
        failed.push({
          id,
          code: 'PRODUCT_IN_USE',
          message: '该商品已被饮酒记录引用，无法删除',
        });
        continue;
      }
      await this.prisma.product.delete({ where: { id } });
      successCount += 1;
    }

    if (successCount > 0) {
      await this.operationLog.log({
        adminUserId,
        action: 'PRODUCT_BATCH_DELETE',
        targetType: 'Product',
        targetId: uniqueIds.join(',').slice(0, 100),
        metadata: {
          successCount,
          failCount: failed.length,
          failedIds: failed.map((f) => ({ id: f.id, code: f.code })),
        },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });
    }

    return { successCount, failCount: failed.length, failed };
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
}
