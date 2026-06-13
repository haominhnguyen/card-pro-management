import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resilient bot launcher.
 *
 * nestjs-telegraf auto-launches the bot the instant the app boots, and that very
 * first outbound call (getMe) often fails on a cold container network with an empty
 * FetchError. When it does, telegraf's launch() rejects BEFORE startPolling(), so the
 * bot never starts receiving updates — even though the network is fine a second later.
 *
 * This probes Telegram until it's reachable, then starts polling. It no-ops if the
 * auto-launch already succeeded (bot.botInfo is set), so there's no double-launch.
 */
@Injectable()
export class BotLauncherService implements OnApplicationBootstrap {
  private readonly logger = new Logger('Telegram');

  constructor(@InjectBot() private readonly bot: Telegraf) {}

  async onApplicationBootstrap(): Promise<void> {
    for (let attempt = 1; attempt <= 6; attempt++) {
      await sleep(attempt * 2000); // 2s, 4s, 6s … back off as we retry

      // Auto-launch (or a previous attempt) already brought the bot up → done.
      if ((this.bot as unknown as { botInfo?: unknown }).botInfo) {
        return;
      }

      try {
        await this.bot.telegram.getMe(); // probe: succeeds once the network is warm
      } catch (err) {
        this.logger.warn(
          `Telegram chưa kết nối được (lần ${attempt}): ${(err as Error)?.message}`,
        );
        continue;
      }

      // Network is up — start polling. Don't await the long-running loop; surface
      // any error from it as a warning.
      void this.bot
        .launch({ dropPendingUpdates: true })
        .catch((err) => this.logger.warn(`Bot polling dừng: ${(err as Error)?.message}`));
      this.logger.log(`✅ Telegram bot đã khởi động (lần ${attempt})`);
      return;
    }

    this.logger.warn('Không khởi động được Telegram bot sau nhiều lần thử; app vẫn chạy bình thường.');
  }
}
