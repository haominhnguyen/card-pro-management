import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TelegramController } from './telegram.controller';
import { TelegramLinkService } from './telegram-link.service';
import { TelegramNotifyService } from './telegram-notify.service';
import { TelegramLink, TelegramLinkSchema } from './schemas/telegram-link.schema';
import { TelegramLinkCode, TelegramLinkCodeSchema } from './schemas/telegram-link-code.schema';

// @Global so TransactionsService can @Optional()-inject TelegramNotifyService without a
// hard import (this module is only loaded when TELEGRAM_BOT_TOKEN is set).
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TelegramLink.name, schema: TelegramLinkSchema },
      { name: TelegramLinkCode.name, schema: TelegramLinkCodeSchema },
    ]),
  ],
  controllers: [TelegramController],
  providers: [TelegramLinkService, TelegramNotifyService],
  exports: [TelegramLinkService, TelegramNotifyService],
})
export class TelegramModule {}
