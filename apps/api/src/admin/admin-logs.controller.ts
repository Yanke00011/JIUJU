import { Controller, Get, HttpStatus, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminLogsService, AdminLogQuery } from './admin-logs.service';

const LOG_EXAMPLE = {
  id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  admin: { id: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f', username: 'admin' },
  action: 'PRODUCT_UPDATE',
  targetType: 'Product',
  targetId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
  details: { fields: ['name', 'volumeMl'] },
  ip: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: '2026-08-15T05:00:00.000Z',
};

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/logs')
export class AdminLogsController {
  constructor(private readonly adminLogsService: AdminLogsService) {}

  @Get()
  @ApiOperation({
    summary: '操作日志列表（管理员）',
    description:
      '分页返回操作日志，支持按 adminUserId / action / targetType / targetId / startDate / endDate 过滤，默认 createdAt 降序。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: { success: true, data: { items: [LOG_EXAMPLE], total: 1, page: 1, pageSize: 20 } },
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
    @Query('adminUserId') adminUserId?: string,
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('targetId') targetId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const query: AdminLogQuery = {
      page: page !== undefined ? Number(page) : undefined,
      pageSize: pageSize !== undefined ? Number(pageSize) : undefined,
      adminUserId,
      action,
      targetType,
      targetId,
      startDate,
      endDate,
    };
    return this.adminLogsService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '操作日志详情（管理员）', description: '按 ID 返回完整日志。' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: { example: { success: true, data: { log: LOG_EXAMPLE } } },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '日志不存在',
    schema: {
      example: { success: false, error: { code: 'LOG_NOT_FOUND', message: '日志不存在' } },
    },
  })
  async getById(@Param('id') id: string) {
    const log = await this.adminLogsService.getById(id);
    return { log };
  }
}
