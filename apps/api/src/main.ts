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
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const jwtSecret = configService.get<string>('JWT_SECRET') ?? '';

  // 生产安全：JWT_SECRET 不能为空。
  if (jwtSecret.trim().length === 0) {
    Logger.error('JWT_SECRET 未配置，拒绝启动。请在环境变量中设置 JWT_SECRET。', 'Bootstrap');
    Logger.flush();
    process.exit(1);
  }

  const port = Number(configService.get<string>('API_PORT') ?? 3000);

  await app.listen(port);

  Logger.log(`API server is running at http://localhost:${port}/api/v1`, 'Bootstrap');
  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED') === 'true';
  if (nodeEnv !== 'production' || swaggerEnabled) {
    Logger.log(`Swagger docs are available at http://localhost:${port}/api/docs`, 'Bootstrap');
  }
}

void bootstrap();
