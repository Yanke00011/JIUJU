import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
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
    description: '分页返回全部房间，支持按名称 / 邀请码 / 房主关键词搜索，含房主与成员数。',
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
  async list(
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('keyword') keyword?: string,
  ) {
    return this.adminRoomsService.list({
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      keyword,
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
    schema: { example: { success: false, error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' } } },
  })
  async getById(@Param('id') id: string) {
    const room = await this.adminRoomsService.getById(id);
    return { room };
  }

  @Get(':id/members')
  @ApiOperation({ summary: '房间成员列表（管理员）', description: '返回房间成员，OWNER 优先。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          items: [
            { userId: 'x', nickname: '张三', avatar: null, role: 'OWNER', joinedAt: '2026-08-15T04:10:20Z' },
          ],
        },
      },
    },
  })
  async listMembers(@Param('id') id: string) {
    const items = await this.adminRoomsService.listMembers(id);
    return { items };
  }

  @Get(':id/drinks')
  @ApiOperation({
    summary: '房间饮酒记录（管理员）',
    description: '分页返回房间饮酒记录，包含已软删除记录。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: { items: [], total: 0, page: 1, pageSize: 20 },
      },
    },
  })
  async listDrinks(
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminRoomsService.listDrinks(id, {
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
    });
  }

  @Post(':id/end')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '结束房间（管理员）', description: '将 ACTIVE 房间结束为 ENDED。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '结束成功',
    schema: { example: { success: true, data: { room: { ...ROOM_EXAMPLE, status: 'ENDED' } } } },
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: '房间已结束',
    schema: {
      example: { success: false, error: { code: 'ROOM_ALREADY_ENDED', message: '房间已结束' } },
    },
  })
  async endRoom(
    @CurrentUser() admin: PublicUser,
    @Param('id') id: string,
    @Req() request: Request,
  ) {
    const room = await this.adminRoomsService.endRoom(admin.id, id, request);
    return { room };
  }

  @Get(':id/export')
  @ApiOperation({ summary: '导出房间饮酒记录 CSV（管理员）', description: '下载 CSV，包含已删除记录。' })
  async exportCsv(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const { filename, csv } = await this.adminRoomsService.exportCsv(id);
    const encoded = encodeURIComponent(filename);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);
    // BOM 便于 Excel 正确识别 UTF-8
    res.send('\uFEFF' + csv);
  }
}
