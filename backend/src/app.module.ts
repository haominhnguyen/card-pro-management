import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegrafModule as TelegramModule } from 'nestjs-telegraf';
import { TransactionsModule } from './transactions/transactions.module';
import { BotModule } from './bot/bot.module';
import { EventsModule } from './events/events.module';
import { GoogleSheetsModule } from './google-sheets/google-sheets.module';
import { CardsModule } from './cards/cards.module';
import { BanksModule } from './banks.module';
import { AuthModule } from './auth/auth.module';
import { TelegramModule as TelegramLinkModule } from './telegram/telegram.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { AppController } from './app.controller';
import { CustomLoggerService } from './logger.service';
import { LoggerMiddleware } from './logger.middleware';
import { LoggingInterceptor } from './logging.interceptor';

// Load .env before @Module decorator runs so conditional modules resolve correctly.
// In CommonJS output all require() calls (imports) are hoisted, then module body
// statements execute in order — so dotenvConfig() runs before isTelegramEnabled.
dotenvConfig({ path: resolve(process.cwd(), '.env') });
dotenvConfig({ path: resolve(process.cwd(), '../.env') });

const isTelegramEnabled = !!process.env.TELEGRAM_BOT_TOKEN;

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('MONGODB_URI'),
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    BanksModule,
    CardsModule,
    TransactionsModule,
    EventsModule,
    GoogleSheetsModule,
    ...(isTelegramEnabled
      ? [
          TelegramModule.forRootAsync({
            imports: [ConfigModule],
            useFactory: (configService: ConfigService) => ({
              token: configService.get<string>('TELEGRAM_BOT_TOKEN')!,
              // Skip updates queued while the bot was offline → fewer startup conflicts.
              launchOptions: { dropPendingUpdates: true },
            }),
            inject: [ConfigService],
          }),
          TelegramLinkModule,
          BotModule,
        ]
      : []),
  ],
  controllers: [AppController],
  providers: [
    CustomLoggerService,
    // Protect every route by default; opt out per-route with @Public().
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {
  constructor(private logger: CustomLoggerService) {
    this.logger.log('✅ Application Module initialized', 'AppModule');
  }

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes('*');
  }
}
