import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AdminGuard } from './admin.guard';
import { AdminDrinksService } from './admin-drinks.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/drinks')
export class AdminDrinksController {
  constructor(private readonly adminDrinksService: AdminDrinksService) {}

  @Get()
  @ApiOperation({
    summary: '饮酒记录列表（管理员）',
    description:
      '分页返回饮酒记录（包含已软删除记录），支持按房间 / 用户 / 商品 / 时间过滤。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: { success: true, data: { items: [], total: 0, page: 1, pageSize: 20 } },
    },
  })
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('roomId') roomId?: string,
    @Query('userId') userId?: string,
    @Query('productId') productId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.adminDrinksService.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      roomId,
      userId,
      productId,
      startDate,
      endDate,
    });
  }

  @Post(':id/restore')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '恢复软删除的饮酒记录（管理员）', description: '清除 deletedAt / deletedBy。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '恢复成功',
    schema: {
      example: { success: true, data: { record: { id: 'x', deletedAt: null } } },
    },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '记录未被删除',
    schema: {
      example: {
        success: false,
        error: { code: 'DRINK_RECORD_NOT_DELETED', message: '该记录未被删除' },
      },
    },
  })
  async restore(@CurrentUser() admin: PublicUser, @Param('id') id: string) {
    const record = await this.adminDrinksService.restore(admin.id, id);
    return { record };
  }
}
