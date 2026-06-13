import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CustomLoggerService } from './logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private logger: CustomLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // Only meaningful for HTTP requests — skip WS & Telegraf contexts.
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap((data) => {
        const duration = Date.now() - startTime;
        this.logger.debug(`✓ Completed: ${method} ${originalUrl}`, 'Controller', {
          duration: `${duration}ms`,
          dataSize: JSON.stringify(data).length,
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `✗ Error in ${method} ${originalUrl}`,
          error.stack,
          'Controller',
          {
            duration: `${duration}ms`,
            errorMessage: error.message,
            errorCode: error.code,
          },
        );
        return throwError(() => error);
      }),
    );
  }
}
