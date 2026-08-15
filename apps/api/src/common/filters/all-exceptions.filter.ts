import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import type { BusinessErrorBody } from '../exceptions/business.exception';

interface PrismaErrorLike {
  code?: string;
}

const PRISMA_ERROR_CODE_MAP: Record<string, { code: string; message: string; status: HttpStatus }> =
  {
    P2002: { code: 'DUPLICATE_RESOURCE', message: '资源已存在', status: HttpStatus.CONFLICT },
    P2003: {
      code: 'RESOURCE_REFERENCE_INVALID',
      message: '资源引用无效',
      status: HttpStatus.BAD_REQUEST,
    },
    P2025: { code: 'RESOURCE_NOT_FOUND', message: '资源不存在', status: HttpStatus.NOT_FOUND },
  };

function isPrismaError(exception: unknown): exception is PrismaErrorLike {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }
  const code = (exception as PrismaErrorLike).code;
  return typeof code === 'string' && /^P\d{4}$/.test(code);
}

function hasStack(exception: unknown): exception is { stack?: string } {
  return typeof exception === 'object' && exception !== null;
}

/**
 * 全局异常过滤器：统一输出 { success: false, error: { code, message } }。
 * 禁止向客户端泄露 Prisma/SQL/stack trace 等内部细节。
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error: BusinessErrorBody = { code: 'INTERNAL_ERROR', message: '服务器内部错误' };

    if (exception instanceof HttpException) {
      const exceptionStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (this.isBusinessErrorResponse(exceptionResponse)) {
        status = exceptionStatus;
        error = { code: exceptionResponse.code, message: exceptionResponse.message };
      } else if (exceptionStatus === HttpStatus.NOT_FOUND) {
        status = exceptionStatus;
        error = { code: 'NOT_FOUND', message: '资源不存在' };
      } else if (
        exception instanceof BadRequestException &&
        this.isValidationResponse(exceptionResponse)
      ) {
        status = exceptionStatus;
        error = {
          code: 'VALIDATION_ERROR',
          message: this.joinValidationMessages(exceptionResponse.message),
        };
      } else {
        status = exceptionStatus;
        error = {
          code: this.statusToCode(exceptionStatus),
          message: this.extractMessage(exception, exceptionStatus),
        };
      }
    } else if (isPrismaError(exception)) {
      const mapped = PRISMA_ERROR_CODE_MAP[exception.code ?? ''];
      if (mapped) {
        status = mapped.status;
        error = { code: mapped.code, message: mapped.message };
      } else {
        status = HttpStatus.BAD_REQUEST;
        error = { code: 'DATABASE_ERROR', message: '数据库操作失败' };
      }
      this.logger.error(
        `Database error on ${request.method} ${request.url}: Prisma ${exception.code}`,
        hasStack(exception) ? exception.stack : undefined,
      );
    } else {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        hasStack(exception) ? exception.stack : undefined,
      );
    }

    response.status(status).json({ success: false, error });
  }

  private isBusinessErrorResponse(value: unknown): value is BusinessErrorBody {
    return (
      typeof value === 'object' &&
      value !== null &&
      typeof (value as BusinessErrorBody).code === 'string' &&
      typeof (value as BusinessErrorBody).message === 'string'
    );
  }

  private isValidationResponse(value: unknown): value is { message: string | string[] } {
    return (
      typeof value === 'object' &&
      value !== null &&
      (typeof (value as { message?: unknown }).message === 'string' ||
        Array.isArray((value as { message?: unknown }).message))
    );
  }

  private joinValidationMessages(message: string | string[]): string {
    if (Array.isArray(message)) {
      return message.join('; ');
    }
    return message;
  }

  private extractMessage(exception: HttpException, status: number): string {
    const response = exception.getResponse();
    if (typeof response === 'string') {
      return response;
    }
    if (
      typeof response === 'object' &&
      response !== null &&
      typeof (response as { message?: string }).message === 'string'
    ) {
      return (response as { message: string }).message;
    }
    return this.statusToMessage(status);
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMITED';
      default:
        return 'HTTP_ERROR';
    }
  }

  private statusToMessage(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return '请求参数错误';
      case HttpStatus.UNAUTHORIZED:
        return '未认证';
      case HttpStatus.FORBIDDEN:
        return '无权限访问';
      case HttpStatus.NOT_FOUND:
        return '资源不存在';
      case HttpStatus.CONFLICT:
        return '资源冲突';
      case HttpStatus.TOO_MANY_REQUESTS:
        return '请求过于频繁';
      default:
        return '请求失败';
    }
  }
}
