import { HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException } from '../common/exceptions/business.exception';
import { PageResult, parsePagination, PaginationQuery } from '../common/utils/pagination';
import { OperationLogService } from './operation-logs.service';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { toProductDto, ProductDto } from '../products/product.dto';

@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly operationLog: OperationLogService,
  ) {}

  async list(query: PaginationQuery): Promise<PageResult<ProductDto>> {
    const { skip, take, page, pageSize } = parsePagination(query);

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count(),
    ]);

    return { items: products.map(toProductDto), total, page, pageSize };
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
}
