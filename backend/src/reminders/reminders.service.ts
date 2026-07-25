import { Injectable, Logger, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Card, CardDocument } from '../cards/schemas/card.schema';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { MailService } from '../mail/mail.service';
import { TelegramNotifyService } from '../telegram/telegram-notify.service';

// Remind when the payment is this many days away (and again on the due day, 0).
const REMIND_DAYS = [3, 0];
const HIGH_UTIL_PCT = 90;

const vnd = (n: number) => n.toLocaleString('vi-VN') + '₫';

/** Whole days from today until the next occurrence of `dueDay` (clamped to month length). */
function daysUntilDue(dueDay: number, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const clamp = (y: number, m: number) => Math.min(dueDay, new Date(y, m + 1, 0).getDate());
  let y = today.getFullYear();
  let m = today.getMonth();
  let due = new Date(y, m, clamp(y, m));
  if (due < today) {
    m += 1;
    if (m > 11) { m = 0; y += 1; }
    due = new Date(y, m, clamp(y, m));
  }
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

/** Start of the card's current statement cycle (most recent close date). */
function currentCycleStart(statementDate: number, now = new Date()): Date {
  const clamp = (y: number, m: number) => Math.min(statementDate, new Date(y, m + 1, 0).getDate());
  let y = now.getFullYear();
  let m = now.getMonth();
  if (now.getDate() > clamp(y, m)) return new Date(y, m, clamp(y, m));
  m -= 1;
  if (m < 0) { m = 11; y -= 1; }
  return new Date(y, m, clamp(y, m));
}

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectModel(Card.name) private cardModel: Model<CardDocument>,
    @InjectModel(Transaction.name) private txModel: Model<TransactionDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly mailService: MailService,
    @Optional() private readonly telegramNotify?: TelegramNotifyService,
  ) {}

  // Every day at 08:00 Vietnam time.
  @Cron('0 8 * * *', { timeZone: 'Asia/Ho_Chi_Minh' })
  async dailyReminders(): Promise<void> {
    await this.runDueReminders();
  }

  /** Find cards due in REMIND_DAYS, group by user, and notify via email + Telegram. */
  async runDueReminders(now = new Date()): Promise<number> {
    const cards = await this.cardModel.find({ paymentDueDate: { $ne: null } }).exec();

    // Group the cards that are due today/in 3 days by their owner.
    const byUser = new Map<string, CardDocument[]>();
    for (const c of cards) {
      if (!c.paymentDueDate) continue;
      if (!REMIND_DAYS.includes(daysUntilDue(c.paymentDueDate, now))) continue;
      const list = byUser.get(c.userId) ?? [];
      list.push(c);
      byUser.set(c.userId, list);
    }

    let sent = 0;
    for (const [userId, userCards] of byUser) {
      try {
        const user = await this.userModel.findById(userId).exec();
        if (!user || !user.isActive) continue;

        const items: { title: string; detail: string }[] = [];
        const tgLines: string[] = [];
        for (const card of userCards) {
          const days = daysUntilDue(card.paymentDueDate as number, now);
          const { pct, cycleSpend } = await this.cardUtil(userId, card, now);
          const when = days === 0 ? 'hôm nay' : `sau ${days} ngày`;
          const util = pct >= HIGH_UTIL_PCT ? ` ⚠️ đã dùng ${Math.round(pct)}% hạn mức.` : '';
          items.push({
            title: `${card.cardName} (${card.bank})`,
            detail: `Đến hạn thanh toán ${when} (ngày ${card.paymentDueDate}). Đã chi kỳ này: ${vnd(cycleSpend)}.${util}`,
          });
          tgLines.push(
            `💳 *${card.cardName}* (${card.bank})\n⏰ Đến hạn ${when} (ngày ${card.paymentDueDate})\n💵 Đã chi kỳ này: ${vnd(cycleSpend)}${util}`,
          );
        }

        await this.mailService.sendPaymentReminder(user.email, user.name, items);
        if (this.telegramNotify) {
          await this.telegramNotify
            .notify(userId, `🔔 *Nhắc thanh toán thẻ*\n\n${tgLines.join('\n\n')}`)
            .catch((e) => this.logger.warn(`Telegram reminder failed: ${e?.message ?? e}`));
        }
        sent++;
      } catch (e) {
        this.logger.warn(
          `Reminder for user ${userId} failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    if (sent > 0) this.logger.log(`Sent payment reminders to ${sent} user(s)`);
    return sent;
  }

  /** Utilization % (all-time expense / limit) and current-cycle spend for a card. */
  private async cardUtil(
    userId: string,
    card: CardDocument,
    now: Date,
  ): Promise<{ pct: number; cycleSpend: number }> {
    const txns = await this.txModel
      .find({
        userId,
        $or: [
          { cardId: String(card._id) },
          { cardId: null, bank: card.bank, cardName: card.cardName },
        ],
      })
      .exec();

    const cycleStart = currentCycleStart(card.statementDate, now);
    let exp = 0;
    let cycle = 0;
    for (const t of txns) {
      if (t.type !== 'expense') continue;
      exp += t.amount;
      if (new Date(t.date) >= cycleStart) cycle += t.amount;
    }
    const pct = card.creditLimit > 0 ? Math.min((exp / card.creditLimit) * 100, 100) : 0;
    return { pct, cycleSpend: cycle };
  }
}
