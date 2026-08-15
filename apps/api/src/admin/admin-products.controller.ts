import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminProductsService } from './admin-products.service';
import { UpdateProductDto } from '../products/dto/update-product.dto';

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
  @ApiOperation({ summary: '商品列表（管理员）', description: '分页返回全部商品。' })
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
  async list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.adminProductsService.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
    });
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
}
