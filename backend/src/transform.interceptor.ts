import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    // Only HTTP responses carry headers / get wrapped — skip WS & Telegraf contexts.
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const res = context.switchToHttp().getResponse();
    res.setHeader('Cache-Control', 'no-store');
    res.removeHeader('ETag');
    return next.handle().pipe(map((data) => ({ data })));
  }
}
