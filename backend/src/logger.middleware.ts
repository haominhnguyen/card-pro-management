import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from './logger.service';
import { v4 as uuidv4 } from 'uuid';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private logger: CustomLoggerService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const requestId = req.headers['x-request-id'] as string || uuidv4();
    req.id = requestId;
    this.logger.setRequestId(requestId);

    const { method, originalUrl, ip } = req;
    const startTime = Date.now();

    // Log incoming request
    this.logger.log(`→ ${method} ${originalUrl}`, 'HTTP', {
      requestId,
      method,
      path: originalUrl,
      ip,
      userAgent: req.get('user-agent'),
    });

    // Capture response - properly bind res context
    const originalJson = res.json.bind(res);
    const logger = this.logger;

    res.json = function (data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      logger.log(`← ${statusCode} ${method} ${originalUrl}`, 'HTTP', {
        requestId,
        method,
        path: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        contentLength: JSON.stringify(data).length,
      });

      return originalJson(data);
    };

    // Log errors
    res.on('finish', () => {
      if (res.statusCode >= 400) {
        const duration = Date.now() - startTime;
        this.logger.warn(`✗ ${res.statusCode} ${method} ${originalUrl}`, 'HTTP', {
          requestId,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
        });
      }
    });

    next();
  }
}
