import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { SuperAdminGuard } from './super-admin.guard';
import { AdminProductsService } from './admin-products.service';
import { CreateProductDto } from '../products/dto/create-product.dto';
import { UpdateProductDto } from '../products/dto/update-product.dto';
import { BatchDeleteProductsDto } from './dto/batch-delete-products.dto';

const PRODUCT_EXAMPLE = {
  id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  barcode: '6901234567890',
  name: 'XX啤酒',
  brand: 'XX',
  category: 'BEER',
  volumeMl: 500,
  alcoholPercent: 4.3,
};

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly adminProductsService: AdminProductsService) {}

  @Get()
  @ApiOperation({
    summary: '商品列表（管理员）',
    description: '分页返回商品，支持按 barcode / name / brand 关键词搜索。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: { items: [PRODUCT_EXAMPLE], total: 1, page: 1, pageSize: 20 },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '无管理员权限',
    schema: { example: { success: false, error: { code: 'FORBIDDEN', message: '无管理员权限' } } },
  })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminProductsService.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      keyword,
    });
  }

  @Post()
  @ApiOperation({ summary: '新增商品（管理员）', description: '创建商品，barcode 唯一。' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '创建成功',
    schema: { example: { success: true, data: { product: PRODUCT_EXAMPLE } } },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '条形码已存在',
    schema: {
      example: {
        success: false,
        error: { code: 'PRODUCT_ALREADY_EXISTS', message: '该条形码对应的酒品已存在' },
      },
    },
  })
  async create(
    @CurrentUser() admin: PublicUser,
    @Body() dto: CreateProductDto,
    @Req() request: Request,
  ) {
    const product = await this.adminProductsService.create(admin.id, dto, request);
    return { product };
  }

  @Patch(':id')
  @ApiOperation({
    summary: '修改商品（管理员）',
    description: '可修改 name/brand/category/volumeMl/alcoholPercent；不允许修改 barcode。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '修改成功',
    schema: { example: { success: true, data: { product: PRODUCT_EXAMPLE } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '酒品不存在',
    schema: {
      example: { success: false, error: { code: 'PRODUCT_NOT_FOUND', message: '酒品不存在' } },
    },
  })
  async update(
    @CurrentUser() admin: PublicUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() request: Request,
  ) {
    const product = await this.adminProductsService.update(admin.id, id, dto, request);
    return { product };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: '删除商品（仅超级管理员）',
    description: '若商品已被 DrinkRecord 引用则禁止删除（PRODUCT_IN_USE）。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '删除成功',
    schema: { example: { success: true, data: {} } },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '商品已被引用，无法删除',
    schema: {
      example: {
        success: false,
        error: { code: 'PRODUCT_IN_USE', message: '该商品已被饮酒记录引用，无法删除' },
      },
    },
  })
  async delete(
    @CurrentUser() admin: PublicUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    await this.adminProductsService.delete(admin.id, id, request);
    return {};
  }

  @Post('batch-delete')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SuperAdminGuard)
  @ApiOperation({
    summary: '批量删除商品（仅超级管理员）',
    description:
      '逐个检查引用关系：未引用则删除，被 DrinkRecord 引用则记为失败（PRODUCT_IN_USE）。返回成功/失败数量与失败列表。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '批量删除完成',
    schema: {
      example: {
        success: true,
        data: {
          successCount: 1,
          failCount: 1,
          failed: [
            { id: 'x', code: 'PRODUCT_IN_USE', message: '该商品已被饮酒记录引用，无法删除' },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'ids 校验失败',
    schema: {
      example: { success: false, error: { code: 'VALIDATION_ERROR', message: 'ids 不能为空' } },
    },
  })
  async batchDelete(
    @CurrentUser() admin: PublicUser,
    @Body() dto: BatchDeleteProductsDto,
    @Req() request: Request,
  ) {
    return this.adminProductsService.batchDelete(admin.id, dto.ids, request);
  }
}
