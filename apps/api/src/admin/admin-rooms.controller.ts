import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminRoomsService } from './admin-rooms.service';

const ROOM_EXAMPLE = {
  id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  name: '周末朋友酒局',
  owner: { id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f', username: 'zhangsan', nickname: '张三' },
  memberCount: 5,
  status: 'ACTIVE',
  createdAt: '2026-08-15T04:10:20.000Z',
  endedAt: null,
};

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/rooms')
export class AdminRoomsController {
  constructor(private readonly adminRoomsService: AdminRoomsService) {}

  @Get()
  @ApiOperation({
    summary: '房间列表（管理员）',
    description: '分页返回全部房间，含房主与成员数。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: { success: true, data: { items: [ROOM_EXAMPLE], total: 1, page: 1, pageSize: 20 } },
    },
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: '无管理员权限',
    schema: { example: { success: false, error: { code: 'FORBIDDEN', message: '无管理员权限' } } },
  })
  async list(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.adminRoomsService.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({
    summary: '房间详情（管理员）',
    description: '返回房间信息、成员数量、饮酒记录数量与统计摘要。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          room: {
            ...ROOM_EXAMPLE,
            drinkRecordCount: 12,
            stats: { totalQuantity: 20, totalVolumeMl: 10000, totalAlcoholMl: 430 },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在',
    schema: {
      example: { success: false, error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' } },
    },
  })
  async getById(@Param('id') id: string) {
    const room = await this.adminRoomsService.getById(id);
    return { room };
  }
}
