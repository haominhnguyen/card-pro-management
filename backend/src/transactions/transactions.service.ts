import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { EventsGateway } from '../events/events.gateway';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { CardsService } from '../cards/cards.service';
import { TelegramNotifyService } from '../telegram/telegram-notify.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';

const vnd = (n: number) => n.toLocaleString('vi-VN') + '₫';

/** Options shared by mutating ops. notifyTelegram defaults true (web origin); the bot
 * passes false so it doesn't message the very chat that triggered the change. */
interface MutateOpts {
  notifyTelegram?: boolean;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<TransactionDocument>,
    private readonly eventsGateway: EventsGateway,
    private readonly googleSheetsService: GoogleSheetsService,
    private readonly cardsService: CardsService,
    // Optional: TelegramModule only loads when TELEGRAM_BOT_TOKEN is set.
    @Optional() private readonly telegramNotify?: TelegramNotifyService,
  ) {}

  private notifyTelegram(userId: string, message: string) {
    this.telegramNotify
      ?.notify(userId, message)
      .catch((e) => this.logger.warn(`Telegram notify failed: ${e?.message ?? e}`));
  }

  /** Một khoản chi không được vượt hạn mức của thẻ tương ứng (trong phạm vi user). */
  private async assertWithinLimit(
    userId: string,
    bank: string,
    cardName: string | undefined,
    amount: number,
  ) {
    const allCards = await this.cardsService.findAll(userId);
    const matching = allCards.filter(
      (c) => c.bank === bank && (!cardName || c.cardName === cardName),
    );
    if (matching.length > 0) {
      const limit = Math.max(...matching.map((c) => c.creditLimit));
      if (amount > limit) {
        throw new BadRequestException(
          `Số tiền ${vnd(amount)} vượt quá hạn mức thẻ ${vnd(limit)}`,
        );
      }
    }
  }

  async create(
    createTransactionDto: CreateTransactionDto,
    userId: string,
    opts: MutateOpts = {},
  ): Promise<Transaction> {
    if (createTransactionDto.type === 'expense') {
      await this.assertWithinLimit(
        userId,
        createTransactionDto.bank,
        createTransactionDto.cardName,
        createTransactionDto.amount,
      );
    }

    const createdTransaction = new this.transactionModel({ ...createTransactionDto, userId });
    const saved = await createdTransaction.save();

    this.eventsGateway.emitNewTransaction(saved);
    await this.googleSheetsService.appendRow(saved);

    if (opts.notifyTelegram !== false) {
      const icon = saved.type === 'expense' ? '💸' : '💰';
      this.notifyTelegram(
        userId,
        `${icon} *Giao dịch mới* (web)\n💳 ${saved.bank}${saved.cardName ? ' — ' + saved.cardName : ''}\n💵 ${vnd(saved.amount)}   🏷 ${saved.category}\n📝 ${saved.description}`,
      );
    }

    return saved;
  }

  async update(
    id: string,
    dto: UpdateTransactionDto,
    userId: string,
    opts: MutateOpts = {},
  ): Promise<Transaction> {
    const existing = await this.transactionModel.findOne({ _id: id, userId }).exec();
    if (!existing) throw new NotFoundException('Không tìm thấy giao dịch');

    // Validate hạn mức dựa trên giá trị sau cập nhật.
    const type = dto.type ?? existing.type;
    const bank = dto.bank ?? existing.bank;
    const cardName = dto.cardName ?? existing.cardName;
    const amount = dto.amount ?? existing.amount;
    if (type === 'expense') {
      await this.assertWithinLimit(userId, bank, cardName, amount);
    }

    const updated = await this.transactionModel
      .findOneAndUpdate({ _id: id, userId }, dto, { new: true })
      .exec();

    this.eventsGateway.emitTransactionUpdated(updated);

    if (opts.notifyTelegram !== false && updated) {
      this.notifyTelegram(
        userId,
        `✏️ *Giao dịch đã cập nhật* (web)\n💳 ${updated.bank}${updated.cardName ? ' — ' + updated.cardName : ''}\n💵 ${vnd(updated.amount)}   🏷 ${updated.category}\n📝 ${updated.description}`,
      );
    }
    return updated as Transaction;
  }

  async remove(id: string, userId: string, opts: MutateOpts = {}): Promise<{ _id: string }> {
    const deleted = await this.transactionModel.findOneAndDelete({ _id: id, userId }).exec();
    if (!deleted) throw new NotFoundException('Không tìm thấy giao dịch');

    this.eventsGateway.emitTransactionDeleted(id, userId);

    if (opts.notifyTelegram !== false) {
      this.notifyTelegram(
        userId,
        `🗑 *Giao dịch đã xóa* (web)\n💳 ${deleted.bank}   💵 ${vnd(deleted.amount)}\n📝 ${deleted.description}`,
      );
    }
    return { _id: id };
  }

  async findAll(userId: string, bank?: string): Promise<Transaction[]> {
    const query: Record<string, unknown> = { userId };
    if (bank) query.bank = bank;
    return this.transactionModel.find(query).sort({ date: -1 }).exec();
  }

  async getStats(userId: string, bank?: string): Promise<any> {
    const matchStage = { $match: bank ? { userId, bank } : { userId } };

    const stats = await this.transactionModel.aggregate([
      matchStage,
      {
        $group: {
          _id: { bank: '$bank', type: '$type' },
          total: { $sum: '$amount' },
        },
      },
      {
        $project: {
          _id: 0,
          bank: '$_id.bank',
          type: '$_id.type',
          total: 1,
        },
      },
    ]);
    return stats;
  }

  /** Tổng chi tiêu theo danh mục (chỉ expense), sắp xếp giảm dần. */
  async getByCategory(userId: string): Promise<{ category: string; total: number }[]> {
    return this.transactionModel.aggregate([
      { $match: { userId, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $project: { _id: 0, category: '$_id', total: 1 } },
      { $sort: { total: -1 } },
    ]);
  }

  /** Chi/thu theo tháng cho `months` tháng gần nhất (cũ → mới). */
  async getMonthly(userId: string, months = 6): Promise<{ month: string; expense: number; income: number }[]> {
    const from = new Date();
    from.setMonth(from.getMonth() - (months - 1));
    from.setDate(1);
    from.setHours(0, 0, 0, 0);

    const rows = await this.transactionModel.aggregate([
      { $match: { userId, date: { $gte: from } } },
      {
        $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$date' } }, type: '$type' },
          total: { $sum: '$amount' },
        },
      },
    ]);

    // Khởi tạo đủ các tháng (kể cả tháng không có giao dịch).
    const buckets = new Map<string, { month: string; expense: number; income: number }>();
    for (let i = 0; i < months; i++) {
      const d = new Date(from);
      d.setMonth(from.getMonth() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      buckets.set(key, { month: key, expense: 0, income: 0 });
    }
    for (const r of rows) {
      const b = buckets.get(r._id.month);
      if (!b) continue;
      if (r._id.type === 'expense') b.expense = r.total;
      else b.income = r.total;
    }
    return Array.from(buckets.values());
  }
}
