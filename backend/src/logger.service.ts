import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { v4 as uuidv4 } from 'uuid';

const colors = {
  info: '\x1b[36m', // Cyan
  error: '\x1b[31m', // Red
  warn: '\x1b[33m', // Yellow
  debug: '\x1b[35m', // Magenta
  verbose: '\x1b[34m', // Blue
  reset: '\x1b[0m', // Reset
};

@Injectable()
export class CustomLoggerService implements LoggerService {
  private logger: winston.Logger;
  private requestId: string;

  constructor() {
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const format = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
    );

    const consoleFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.printf(({ level, message, timestamp, context, requestId, ...meta }) => {
        // NestJS color scheme
        const levelColorMap: { [key: string]: { color: string; badge: string } } = {
          error: { color: '\x1b[31m', badge: '✗' },      // Red
          warn: { color: '\x1b[33m', badge: '⚠' },       // Yellow
          info: { color: '\x1b[32m', badge: '✓' },       // Green
          debug: { color: '\x1b[36m', badge: '◆' },      // Cyan
          verbose: { color: '\x1b[34m', badge: '◇' },    // Blue
        };

        const { color, badge } = levelColorMap[level] || { color: '\x1b[0m', badge: '•' };
        const reset = '\x1b[0m';

        const contextStr = context ? ` [${context}]` : '';
        const requestIdStr = requestId ? ` {${requestId}}` : '';
        
        // Build metadata string more compact
        let metaStr = '';
        if (Object.keys(meta).length > 0) {
          const filtered = Object.entries(meta)
            .filter(([k, v]) => k !== 'service' && k !== 'environment')
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
          
          if (Object.keys(filtered).length > 0) {
            metaStr = ` ${JSON.stringify(filtered)}`;
          }
        }

        // Format like NestJS: [timestamp] LEVEL [context] message
        return `${color}${timestamp} ${badge} ${level.toUpperCase().padEnd(7)}${contextStr}${requestIdStr} ${message}${metaStr}${reset}`;
      }),
    );

    const transports: any[] = [
      // Console output with NestJS-style colors
      new winston.transports.Console({
        format: consoleFormat,
      }),

      // Combined logs file (no colors)
      new DailyRotateFile({
        dirname: 'logs',
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format,
      }),

      // Error logs file (no colors)
      new DailyRotateFile({
        dirname: 'logs',
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '14d',
        format,
      }),
    ];

    return winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format,
      transports,
      defaultMeta: {
        service: 'credit-card-api',
        environment: process.env.NODE_ENV || 'development',
      },
    });
  }

  setRequestId(id: string = uuidv4()): string {
    this.requestId = id;
    return id;
  }

  getRequestId(): string {
    return this.requestId || uuidv4();
  }

  log(message: string, context?: string, meta?: any) {
    this.logger.info(message, {
      context,
      requestId: this.requestId,
      ...meta,
    });
  }

  error(message: string, trace?: string, context?: string, meta?: any) {
    this.logger.error(message, {
      context,
      trace,
      requestId: this.requestId,
      ...meta,
    });
  }

  warn(message: string, context?: string, meta?: any) {
    this.logger.warn(message, {
      context,
      requestId: this.requestId,
      ...meta,
    });
  }

  debug(message: string, context?: string, meta?: any) {
    this.logger.debug(message, {
      context,
      requestId: this.requestId,
      ...meta,
    });
  }

  verbose(message: string, context?: string, meta?: any) {
    this.logger.verbose(message, {
      context,
      requestId: this.requestId,
      ...meta,
    });
  }
}
