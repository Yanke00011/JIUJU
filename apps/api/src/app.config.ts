import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

const API_PREFIX = 'api/v1';
const SWAGGER_PATH = 'api/docs';

/**
 * 对应用统一应用基础配置：
 * 全局前缀、Helmet、CORS、ValidationPipe、全局异常过滤、响应包装与 Swagger。
 */
export function applyAppConfig(app: INestApplication): void {
  const logger = new Logger('AppConfig');
  const configService = app.get(ConfigService);

  app.setGlobalPrefix(API_PREFIX);

  app.use(helmet());

  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    logger.warn('CORS_ORIGINS 未配置或为 *，当前允许所有来源（仅建议用于开发环境）');
  }
  app.enableCors({
    origin: corsOrigins.length === 0 || corsOrigins.includes('*') ? true : corsOrigins,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  setupSwagger(app);
}

function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('酒局管家 JIUJU API')
    .setDescription(
      '酒局管家后端 API 文档。统一返回格式：成功 { success: true, data }，失败 { success: false, error: { code, message } }。',
    )
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_PATH, app, document, {
    swaggerOptions: { persistAuthorization: true },
    customSiteTitle: 'JIUJU API Docs',
  });
}
