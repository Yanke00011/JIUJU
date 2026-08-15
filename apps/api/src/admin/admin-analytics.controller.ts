import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from './admin.guard';
import { AdminAnalyticsService } from './admin-analytics.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/analytics')
export class AdminAnalyticsController {
  constructor(private readonly adminAnalyticsService: AdminAnalyticsService) {}

  @Get()
  @ApiOperation({
    summary: '运营分析（管理员）',
    description: '返回酒局趋势、饮酒趋势、热门酒品 Top10、用户饮酒排行与活跃酒局。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          roomTrends: [{ date: '2026-08-15', count: 3 }],
          drinkTrends: [{ date: '2026-08-15', count: 12 }],
          topProducts: [{ productId: 'x', name: 'XX啤酒', barcode: '690...', quantity: 10 }],
          userRanking: [
            {
              userId: 'x',
              username: 'a',
              nickname: 'A',
              quantity: 5,
              volumeMl: 2500,
              alcoholMl: 120,
            },
          ],
          activeRooms: [
            { id: 'x', name: '酒局', inviteCode: 'A7K92P', createdAt: '...', owner: null },
          ],
        },
      },
    },
  })
  async getAnalytics(@Query('days') days?: string) {
    return this.adminAnalyticsService.getAnalytics(days !== undefined ? Number(days) : undefined);
  }
}
