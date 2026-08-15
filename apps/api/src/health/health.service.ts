import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthResult {
  status: 'ok' | 'unhealthy';
  database: 'up' | 'down';
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(): Promise<HealthResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'unhealthy', database: 'down' };
    }
  }
}
