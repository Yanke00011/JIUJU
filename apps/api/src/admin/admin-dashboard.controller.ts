import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @ApiOperation({
    summary: '后台仪表盘数据（管理员）',
    description: '返回统计卡片数据、最近酒局与最近操作日志。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          stats: {
            totalUsers: 100,
            activeUsers: 90,
            totalRooms: 30,
            activeRooms: 20,
            totalDrinkRecords: 500,
            totalProducts: 120,
          },
          recentRooms: [],
          recentLogs: [],
        },
      },
    },
  })
  async getDashboard() {
    return this.adminDashboardService.getDashboard();
  }
}
