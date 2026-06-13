import { Module } from '@nestjs/common';
import { BotUpdate } from './bot.update';
import { BotLauncherService } from './bot-launcher.service';
import { TransactionsModule } from '../transactions/transactions.module';
import { CardsModule } from '../cards/cards.module';
import { BanksModule } from '../banks.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [TransactionsModule, CardsModule, BanksModule, TelegramModule],
  providers: [BotUpdate, BotLauncherService],
})
export class BotModule {}
