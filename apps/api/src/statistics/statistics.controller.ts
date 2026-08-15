import { Controller, Get, HttpStatus, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PublicUser } from '../common/utils/public-user';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@ApiBearerAuth()
@Controller('rooms/:id/statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @ApiOperation({
    summary: '酒局统计',
    description: '返回当前酒局的实时统计（总量、用户排行、商品排行）。仅房间成员可查看。',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '获取成功',
    schema: {
      example: {
        success: true,
        data: {
          total: {
            records: 100,
            totalQuantity: 20,
            totalVolumeMl: 10000,
            totalAlcoholMl: 430,
          },
          users: [
            {
              userId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
              nickname: '张三',
              avatar: null,
              quantity: 5,
              volumeMl: 2500,
              alcoholMl: 120,
            },
          ],
          products: [
            {
              productId: 'b6c8f2b0-4c3e-4a5b-9f8e-1a2b3c4d5e6f',
              name: 'XX啤酒',
              barcode: '6901234567890',
              quantity: 10,
              volumeMl: 5000,
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '房间不存在或非成员',
    schema: {
      example: {
        success: false,
        error: { code: 'ROOM_NOT_FOUND', message: '房间不存在' },
      },
    },
  })
  async getRoomStatistics(@CurrentUser() user: PublicUser, @Param('id') roomId: string) {
    return this.statisticsService.getRoomStatistics(user.id, roomId);
  }
}
