import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOperation({ summary: '健康检查', description: '返回服务运行状态。' })
  @ApiOkResponse({
    description: '服务正常',
    schema: {
      example: {
        success: true,
        data: { status: 'ok' },
      },
    },
  })
  getHealth(): ReturnType<HealthService['getHealth']> {
    return this.healthService.getHealth();
  }
}
