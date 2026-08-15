import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();
    const requestId = randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    res.on('finish', () => {
      const duration = Date.now() - start;
      const entry = {
        requestId,
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
      };
      const message = JSON.stringify(entry);
      if (res.statusCode >= 500) {
        this.logger.error(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
