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
 * 生产环境（NODE_ENV=production）：
 * - CORS_ORIGINS 不能为空或包含 *（严格白名单）。
 * - Swagger 默认关闭，仅当 SWAGGER_ENABLED=true 时开启。
 */
export function applyAppConfig(app: INestApplication): void {
  const logger = new Logger('AppConfig');
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';

  app.setGlobalPrefix(API_PREFIX);

  app.use(helmet());

  const corsOrigins = (configService.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (isProduction) {
    if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
      throw new Error('生产环境 CORS_ORIGINS 不能为空或包含 *，必须显式配置允许的来源列表');
    }
    app.enableCors({
      origin: corsOrigins,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  } else {
    if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
      logger.warn('CORS_ORIGINS 未配置或为 *，当前允许所有来源（仅建议用于开发环境）');
    }
    app.enableCors({
      origin: corsOrigins.length === 0 || corsOrigins.includes('*') ? true : corsOrigins,
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const swaggerEnabled = configService.get<string>('SWAGGER_ENABLED') === 'true';
  if (!isProduction || swaggerEnabled) {
    setupSwagger(app);
  } else {
    logger.warn('生产环境默认关闭 Swagger（如需开启请设置 SWAGGER_ENABLED=true）');
  }
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
