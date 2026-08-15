import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { applyAppConfig } from './app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  applyAppConfig(app);

  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('API_PORT') ?? 3000);

  await app.listen(port);

  Logger.log(`API server is running at http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger docs are available at http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
