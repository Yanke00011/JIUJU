import { Injectable } from '@nestjs/common';

export interface HealthResult {
  status: 'ok';
}

@Injectable()
export class HealthService {
  getHealth(): HealthResult {
    return { status: 'ok' };
  }
}
