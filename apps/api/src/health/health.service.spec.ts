import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prisma: { $queryRaw: jest.Mock };

  beforeEach(async () => {
    prisma = { $queryRaw: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return ok when database is reachable', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await service.getHealth();
    expect(result).toEqual({ status: 'ok', database: 'up' });
  });

  it('should return unhealthy when database is down', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    const result = await service.getHealth();
    expect(result).toEqual({ status: 'unhealthy', database: 'down' });
  });
});
