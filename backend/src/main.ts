import { NestFactory } from '@nestjs/core';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformInterceptor } from './transform.interceptor';
import { HttpExceptionFilter } from './http-exception.filter';
import { CustomLoggerService } from './logger.service';
import { LoggingInterceptor } from './logging.interceptor';

async function bootstrap() {
  const customLogger = new CustomLoggerService();

  // The Telegram bot polls getUpdates; if another instance is already polling, Telegraf
  // throws a 409 from its detached polling loop. That's an OPTIONAL subsystem — don't let
  // it crash the whole backend (which also serves auth/API). Log Telegram errors and keep
  // running; re-throw anything else so genuine bugs still surface.
  process.on('unhandledRejection', (reason: any) => {
    const tgCode = reason?.response?.error_code ?? (reason?.name === 'TelegramError' ? reason?.code : undefined);
    // node-fetch network failures hitting the Telegram API (e.g. a transient TLS reset
    // on the very first getMe at startup) arrive as FetchError, not TelegramError.
    const isTelegramFetchError =
      reason?.name === 'FetchError' && /api\.telegram\.org/.test(String(reason?.message ?? ''));
    if (tgCode != null || reason?.name === 'TelegramError' || isTelegramFetchError) {
      customLogger.warn(
        `Telegram bot issue (${tgCode ?? reason?.name}): ${reason?.response?.description ?? reason?.message}. ` +
          'Đảm bảo chỉ chạy MỘT instance backend với cùng bot token. API/Auth vẫn hoạt động bình thường.',
        'Telegram',
      );
      return;
    }
    customLogger.error(
      'Unhandled promise rejection',
      reason instanceof Error ? reason.stack : String(reason),
      'Process',
    );
  });

  try {
    const app = await NestFactory.create(AppModule, {
      logger: customLogger,
    });

    // Set global prefix for all routes
    app.setGlobalPrefix('api');

    app.use(cookieParser());

    // Credentials (httpOnly refresh cookie) require explicit origins, not '*'.
    const origins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173,http://localhost:80')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    app.enableCors({ origin: origins, credentials: true });

    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Apply Global Interceptors and Filters
    app.useGlobalInterceptors(
      new LoggingInterceptor(customLogger),
      new TransformInterceptor(),
    );
    app.useGlobalFilters(new HttpExceptionFilter());

    // Add health check middleware (outside of /api prefix)
    app.use('/health', (req: any, res: any, next: any) => {
      if (req.method === 'GET') {
        return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
      }
      if (typeof next === 'function') next();
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port);

    customLogger.log(`✅ Application running on port ${port}`, 'Bootstrap', {
      health: `http://localhost:${port}/health`,
      api: `http://localhost:${port}/api`,
      cards: `http://localhost:${port}/api/cards`,
      transactions: `http://localhost:${port}/api/transactions`,
      mongodb: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/credit-card-db',
    });
  } catch (error) {
    customLogger.error(
      'Failed to start application',
      error instanceof Error ? error.stack : String(error),
      'Bootstrap',
    );
    process.exit(1);
  }
}

bootstrap();
