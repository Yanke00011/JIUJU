import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService, HealthResult } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '健康检查', description: '返回服务与数据库状态。' })
  @ApiOkResponse({
    description: '服务与数据库正常',
    schema: {
      example: {
        success: true,
        data: { status: 'ok', database: 'up' },
      },
    },
  })
  @ApiOkResponse({
    description: '数据库不可用时',
    schema: {
      example: {
        success: true,
        data: { status: 'unhealthy', database: 'down' },
      },
    },
  })
  async getHealth(): Promise<HealthResult> {
    return this.healthService.getHealth();
  }
}
