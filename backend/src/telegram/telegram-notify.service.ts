import { Injectable, Logger } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { TelegramLinkService } from './telegram-link.service';

/** Pushes web-originated changes to a user's linked Telegram chat(s). */
@Injectable()
export class TelegramNotifyService {
  private readonly logger = new Logger(TelegramNotifyService.name);

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly linkService: TelegramLinkService,
  ) {}

  async notify(userId: string, message: string): Promise<void> {
    const chatIds = await this.linkService.chatIdsForUser(userId);
    await Promise.all(
      chatIds.map((id) =>
        this.bot.telegram
          .sendMessage(id, message, { parse_mode: 'Markdown' })
          .catch((err) =>
            this.logger.warn(`Notify ${id} failed: ${err instanceof Error ? err.message : String(err)}`),
          ),
      ),
    );
  }
}
