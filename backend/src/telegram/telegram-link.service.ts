import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import { TelegramLink, TelegramLinkDocument } from './schemas/telegram-link.schema';
import { TelegramLinkCode, TelegramLinkCodeDocument } from './schemas/telegram-link-code.schema';
import { EventsGateway } from '../events/events.gateway';

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface LinkStatus {
  linked: boolean;
  chats: { telegramId: number; telegramName?: string }[];
}

@Injectable()
export class TelegramLinkService {
  private readonly logger = new Logger(TelegramLinkService.name);
  private cachedUsername: string | null = null;

  constructor(
    @InjectModel(TelegramLink.name) private linkModel: Model<TelegramLinkDocument>,
    @InjectModel(TelegramLinkCode.name) private codeModel: Model<TelegramLinkCodeDocument>,
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly events: EventsGateway,
    private readonly config: ConfigService,
  ) {}

  /** Generate a one-time link code + the t.me deep link the web UI opens. */
  async createLinkCode(userId: string): Promise<{ code: string; deepLink: string }> {
    const code = randomBytes(24).toString('base64url');
    await this.codeModel.create({
      code,
      userId,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    const username = await this.getBotUsername();
    return { code, deepLink: `https://t.me/${username}?start=${code}` };
  }

  /**
   * Bot side: redeem a code for a chat. Validates expiry, links telegramId↔userId,
   * removes the code, and notifies the web session via socket.
   */
  async consumeLinkCode(code: string, telegramId: number, telegramName?: string): Promise<string | null> {
    const doc = await this.codeModel.findOne({ code }).exec();
    if (!doc || doc.expiresAt.getTime() < Date.now()) {
      if (doc) await this.codeModel.deleteOne({ _id: doc._id }).exec();
      return null;
    }

    const userId = doc.userId;
    await this.linkModel.updateOne(
      { telegramId },
      { $set: { telegramId, userId, telegramName } },
      { upsert: true },
    ).exec();
    await this.codeModel.deleteOne({ _id: doc._id }).exec();

    this.events.emitTo(userId, 'telegram_linked', { telegramId, telegramName });
    this.logger.log(`Telegram ${telegramId} linked to user ${userId}`);
    return userId;
  }

  /** Bot side: which web user owns this chat (null if unlinked). */
  async resolveUserId(telegramId: number): Promise<string | null> {
    const link = await this.linkModel.findOne({ telegramId }).exec();
    return link ? link.userId : null;
  }

  async getStatus(userId: string): Promise<LinkStatus> {
    const links = await this.linkModel.find({ userId }).exec();
    return {
      linked: links.length > 0,
      chats: links.map((l) => ({ telegramId: l.telegramId, telegramName: l.telegramName })),
    };
  }

  /** Unlink one chat (telegramId given) or all chats of the user. */
  async unlink(userId: string, telegramId?: number): Promise<void> {
    const filter = telegramId ? { userId, telegramId } : { userId };
    await this.linkModel.deleteMany(filter).exec();
  }

  /** All chats linked to a user (used by the notify service). */
  async chatIdsForUser(userId: string): Promise<number[]> {
    const links = await this.linkModel.find({ userId }, { telegramId: 1 }).exec();
    return links.map((l) => l.telegramId);
  }

  private async getBotUsername(): Promise<string> {
    if (this.cachedUsername) return this.cachedUsername;
    const fromEnv = this.config.get<string>('TELEGRAM_BOT_USERNAME');
    if (fromEnv) {
      this.cachedUsername = fromEnv.replace(/^@/, '');
      return this.cachedUsername;
    }
    const me = await this.bot.telegram.getMe();
    this.cachedUsername = me.username;
    return this.cachedUsername;
  }
}
