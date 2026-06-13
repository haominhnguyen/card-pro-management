import { Update, Ctx, Start, Help, Command, Action, On, InjectBot } from 'nestjs-telegraf';
import { Context, Markup, Telegraf } from 'telegraf';
import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { TransactionsService } from '../transactions/transactions.service';
import { CardsService } from '../cards/cards.service';
import { BanksService } from '../banks.service';
import { TelegramLinkService } from '../telegram/telegram-link.service';

type Step =
  | 'tx_amount'
  | 'tx_category'
  | 'tx_description'
  | 'card_bank'
  | 'card_name'
  | 'card_limit'
  | 'card_statement';

interface CardRef {
  bank: string;
  cardName: string;
  limit: number;
}

interface Session {
  flow: 'tx' | 'card';
  step: Step;
  // transaction flow
  type?: 'expense' | 'income';
  cards?: CardRef[];
  bank?: string;
  cardName?: string;
  limit?: number;
  amount?: number;
  category?: string;
  // add-card flow
  cardLines?: string[];
  creditLimit?: number;
}

const CATS = [
  { key: 'an_uong',   label: 'Ăn uống' },
  { key: 'mua_sam',   label: 'Mua sắm' },
  { key: 'y_te',      label: 'Y tế' },
  { key: 'giao_duc',  label: 'Giáo dục' },
  { key: 'di_chuyen', label: 'Vận chuyển' },
  { key: 'giai_tri',  label: 'Giải trí' },
  { key: 'dien_nuoc', label: 'Tiền điện nước' },
  { key: 'thue_nha',  label: 'Thuê nhà' },
  { key: 'khac',      label: 'Khác' },
];

const CAT_ALIAS: Record<string, string> = Object.fromEntries(CATS.map(c => [c.key, c.label]));

const MAIN_MENU = Markup.inlineKeyboard([
  [
    Markup.button.callback('💸  Chi tiêu', 'ADD_EXPENSE'),
    Markup.button.callback('💰  Thu nhập', 'ADD_INCOME'),
  ],
  [
    Markup.button.callback('💳  Thêm thẻ', 'ADD_CARD'),
    Markup.button.callback('📋  Danh sách thẻ', 'VIEW_CARDS'),
  ],
]);

// Persistent command menu — registered once so users never have to /start again.
const BOT_COMMANDS = [
  { command: 'menu', description: '🏠 Mở menu chính' },
  { command: 'spend', description: '💸 Ghi chi tiêu nhanh' },
  { command: 'income', description: '💰 Ghi thu nhập nhanh' },
  { command: 'addcard', description: '💳 Thêm thẻ tín dụng' },
  { command: 'cards', description: '📋 Xem danh sách thẻ' },
  { command: 'cancel', description: '❌ Hủy thao tác' },
  { command: 'help', description: '📖 Hướng dẫn' },
];

@Update()
export class BotUpdate implements OnApplicationBootstrap {
  private readonly logger = new Logger(BotUpdate.name);

  // Per-user conversation state (in-memory; fine for single-process personal use)
  private readonly sessions = new Map<number, Session>();

  constructor(
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly transactionsService: TransactionsService,
    private readonly cardsService: CardsService,
    private readonly banksService: BanksService,
    private readonly telegramLinkService: TelegramLinkService,
  ) {}

  /** Resolve the web account linked to this chat; prompt to link + bail if none. */
  private async requireLinkedUser(ctx: Context): Promise<string | null> {
    const userId = await this.telegramLinkService.resolveUserId(this.uid(ctx));
    if (!userId) {
      await ctx.reply(
        '🔗 *Chưa liên kết tài khoản*\n\nHãy đăng nhập web → menu tài khoản (góc trên phải) → *Liên kết Telegram* → mở liên kết để kết nối chat này với tài khoản của bạn.',
        { parse_mode: 'Markdown' },
      );
    }
    return userId;
  }

  // ── Pin the command menu once on startup ──────────────────────────────────────
  async onApplicationBootstrap() {
    try {
      await this.bot.telegram.setMyCommands(BOT_COMMANDS);
      await this.bot.telegram.setChatMenuButton({ menuButton: { type: 'commands' } });
      this.logger.log('📌 Bot command menu pinned (persistent)');
    } catch (error) {
      this.logger.warn(
        `Could not pin bot menu: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private uid(ctx: Context): number {
    return ctx.from?.id ?? 0;
  }

  private session(ctx: Context): Session | undefined {
    return this.sessions.get(this.uid(ctx));
  }

  private save(ctx: Context, s: Session) {
    this.sessions.set(this.uid(ctx), s);
  }

  private clear(ctx: Context) {
    this.sessions.delete(this.uid(ctx));
  }

  private async ack(ctx: Context) {
    try { await (ctx as any).answerCbQuery(); } catch { /* ignore */ }
  }

  private fmt(n: number) {
    return n.toLocaleString('vi-VN') + '₫';
  }

  // ── Entry points ─────────────────────────────────────────────────────────────

  @Start()
  async start(@Ctx() ctx: Context) {
    this.clear(ctx);

    // Deep link "/start <code>" → link this chat to a web account.
    const payload = (ctx as any).startPayload as string | undefined;
    if (payload) {
      const userId = await this.telegramLinkService.consumeLinkCode(
        payload,
        this.uid(ctx),
        ctx.from?.first_name,
      );
      if (userId) {
        await ctx.reply(
          '✅ *Đã liên kết tài khoản!*\n\nTừ giờ mọi giao dịch bạn ghi qua bot sẽ vào đúng tài khoản web của bạn, và đồng bộ realtime hai chiều.\n\nChọn thao tác:',
          { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
        );
      } else {
        await ctx.reply(
          '⚠️ Mã liên kết không hợp lệ hoặc đã hết hạn. Vào web tạo lại liên kết và thử lại.',
        );
      }
      return;
    }

    await ctx.reply(
      '💳 *CardPro Bot*\n\nQuản lý chi tiêu tín dụng trực tiếp từ Telegram.\n' +
      'Menu lệnh luôn sẵn ở nút ☰ bên cạnh ô nhập — bạn không cần /start lại.\n\nChọn thao tác:',
      { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
    );
  }

  @Command('menu')
  async menu(@Ctx() ctx: Context) {
    this.clear(ctx);
    await ctx.reply('Chọn thao tác:', { reply_markup: MAIN_MENU.reply_markup });
  }

  @Command('cancel')
  async cancel(@Ctx() ctx: Context) {
    this.clear(ctx);
    await ctx.reply('❌ Đã hủy.', { reply_markup: MAIN_MENU.reply_markup });
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await ctx.reply(
      '📖 *Hướng dẫn*\n\n' +
      'Dùng menu (nút ☰) hoặc các lệnh sau bất cứ lúc nào:\n' +
      '/menu — Menu chính\n' +
      '/addcard — Thêm thẻ tín dụng\n' +
      '/cards — Xem danh sách thẻ\n' +
      '/cancel — Hủy thao tác\n\n' +
      '*Lệnh nhanh (triệu ₫):*\n' +
      '`/spend 0.15 VPBank an_uong Bữa trưa`\n' +
      '`/income 5 Techcombank luong Lương tháng 6`\n\n' +
      '*Danh mục nhanh:* an\\_uong · mua\\_sam · y\\_te · giao\\_duc\n' +
      'di\\_chuyen · giai\\_tri · dien\\_nuoc · thue\\_nha · khac',
      { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
    );
  }

  // ── Menu button actions ───────────────────────────────────────────────────────

  @Action('ADD_EXPENSE')
  async addExpense(@Ctx() ctx: Context) {
    await this.ack(ctx);
    await this.startTxFlow(ctx, 'expense');
  }

  @Action('ADD_INCOME')
  async addIncome(@Ctx() ctx: Context) {
    await this.ack(ctx);
    await this.startTxFlow(ctx, 'income');
  }

  @Action('ADD_CARD')
  async addCardAction(@Ctx() ctx: Context) {
    await this.ack(ctx);
    await this.startCardFlow(ctx);
  }

  @Action('VIEW_CARDS')
  async viewCardsAction(@Ctx() ctx: Context) {
    await this.ack(ctx);
    await this.showCards(ctx);
  }

  @Action('CANCEL')
  async actionCancel(@Ctx() ctx: Context) {
    await this.ack(ctx);
    this.clear(ctx);
    await ctx.reply('❌ Đã hủy.', { reply_markup: MAIN_MENU.reply_markup });
  }

  // ══ TRANSACTION FLOW ══════════════════════════════════════════════════════════

  // Step 1 → choose a specific card
  private async startTxFlow(ctx: Context, type: 'expense' | 'income') {
    const ownerId = await this.requireLinkedUser(ctx);
    if (!ownerId) return;
    const cards = await this.cardsService.findAll(ownerId);
    if (cards.length === 0) {
      await ctx.reply(
        'Chưa có thẻ nào. Hãy thêm thẻ trước.',
        { reply_markup: Markup.inlineKeyboard([[Markup.button.callback('💳 Thêm thẻ ngay', 'ADD_CARD')]]).reply_markup },
      );
      return;
    }

    const refs: CardRef[] = cards.map((c: any) => ({
      bank: c.bank,
      cardName: c.cardName,
      limit: c.creditLimit,
    }));
    this.save(ctx, { flow: 'tx', step: 'tx_amount', type, cards: refs });

    // One card per row (cards have long names)
    const rows = refs.map((c, i) => [Markup.button.callback(`${c.bank} — ${c.cardName}`, `CARD_${i}`)]);
    rows.push([Markup.button.callback('❌ Hủy', 'CANCEL')]);

    const label = type === 'expense' ? '💸 Chi tiêu' : '💰 Thu nhập';
    await ctx.reply(
      `${label}\n\n💳 *Chọn thẻ:*`,
      { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard(rows).reply_markup },
    );
  }

  // Step 2 → card chosen, ask for amount
  @Action(/^CARD_(\d+)$/)
  async selectCard(@Ctx() ctx: Context) {
    await this.ack(ctx);
    const s = this.session(ctx);
    if (!s || s.flow !== 'tx' || !s.cards) return;

    const idx = parseInt((ctx as any).match[1]);
    const card = s.cards[idx];
    if (!card) return;

    this.save(ctx, { ...s, step: 'tx_amount', bank: card.bank, cardName: card.cardName, limit: card.limit });

    const limitNote =
      s.type === 'expense' ? `\n_Hạn mức thẻ: ${this.fmt(card.limit)}_` : '';
    await ctx.reply(
      `💳 *${card.bank} — ${card.cardName}*${limitNote}\n\n💵 *Nhập số tiền* (đơn vị: triệu ₫)\n_VD: 0.15 = 150,000₫   ·   1.5 = 1,500,000₫_\n\n/cancel để hủy`,
      { parse_mode: 'Markdown' },
    );
  }

  // Step 3 → category chosen, ask description
  @Action(/^CAT_(.+)$/)
  async selectCategory(@Ctx() ctx: Context) {
    await this.ack(ctx);
    const s = this.session(ctx);
    if (!s || s.flow !== 'tx' || s.step !== 'tx_category') return;

    const key = (ctx as any).match[1] as string;
    const cat = CATS.find(c => c.key === key);
    const label = cat?.label ?? key;

    this.save(ctx, { ...s, step: 'tx_description', category: label });
    await ctx.reply(`🏷 *${label}*\n\n📝 *Nhập mô tả giao dịch:*`, { parse_mode: 'Markdown' });
  }

  private async handleTxAmount(ctx: Context, s: Session, text: string) {
    const raw = parseFloat(text.replace(',', '.'));
    if (isNaN(raw) || raw <= 0) {
      await ctx.reply('⚠️ Số tiền không hợp lệ. Nhập số dương. VD: `0.15` hoặc `1.5`', { parse_mode: 'Markdown' });
      return;
    }
    const amountVND = Math.round(raw * 1_000_000);

    // Expense must not exceed the card credit limit.
    if (s.type === 'expense' && s.limit != null && amountVND > s.limit) {
      await ctx.reply(
        `⚠️ Số tiền ${this.fmt(amountVND)} vượt quá hạn mức thẻ ${this.fmt(s.limit)}.\nNhập số khác:`,
        { parse_mode: 'Markdown' },
      );
      return;
    }

    this.save(ctx, { ...s, step: 'tx_category', amount: amountVND });

    const rows = [];
    for (let i = 0; i < CATS.length; i += 3) {
      rows.push(CATS.slice(i, i + 3).map(c => Markup.button.callback(c.label, `CAT_${c.key}`)));
    }
    rows.push([Markup.button.callback('❌ Hủy', 'CANCEL')]);

    await ctx.reply(
      `💵 *${this.fmt(amountVND)}*\n\n🏷 *Chọn danh mục:*`,
      { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard(rows).reply_markup },
    );
  }

  private async handleTxDescription(ctx: Context, s: Session, text: string) {
    if (!s.bank || !s.amount || !s.category || !s.type) {
      this.clear(ctx);
      await ctx.reply('❌ Phiên hết hạn. Thử lại.', { reply_markup: MAIN_MENU.reply_markup });
      return;
    }
    const ownerId = await this.requireLinkedUser(ctx);
    if (!ownerId) { this.clear(ctx); return; }
    try {
      await this.transactionsService.create({
        amount: s.amount,
        bank: s.bank,
        cardName: s.cardName,
        category: s.category,
        description: text,
        type: s.type,
        date: new Date(),
      }, ownerId, { notifyTelegram: false });
      this.clear(ctx);
      const label = s.type === 'expense' ? '💸 Chi tiêu' : '💰 Thu nhập';
      await ctx.reply(
        `✅ *Đã ghi nhận!*\n\n${label}\n` +
        `💳 ${s.bank} — ${s.cardName}\n` +
        `💵 ${this.fmt(s.amount)}   🏷 ${s.category}\n📝 ${text}`,
        { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
      );
    } catch (error: any) {
      this.logger.error('Bot: failed to save transaction', error?.message);
      this.clear(ctx);
      await ctx.reply(
        `❌ ${error?.response?.message || error?.message || 'Lỗi khi lưu giao dịch.'}`,
        { reply_markup: MAIN_MENU.reply_markup },
      );
    }
  }

  // ══ ADD-CARD FLOW ═════════════════════════════════════════════════════════════

  @Command('addcard')
  async addCardCmd(@Ctx() ctx: Context) {
    await this.startCardFlow(ctx);
  }

  // Step 1 → ask for bank name
  private async startCardFlow(ctx: Context) {
    this.save(ctx, { flow: 'card', step: 'card_bank' });
    await ctx.reply(
      '💳 *Thêm thẻ tín dụng*\n\n🏦 *Nhập tên ngân hàng:*\n_VD: Techcombank, VPBank, Vietcombank..._\n\n/cancel để hủy',
      { parse_mode: 'Markdown' },
    );
  }

  // Step 2 → bank entered, suggest card lines if known
  private async handleCardBank(ctx: Context, s: Session, text: string) {
    const bank = text.trim();
    const banks = await this.banksService.findAll();
    const matched = banks.find(
      (b: any) =>
        b.name.toLowerCase() === bank.toLowerCase() ||
        b.code.toLowerCase() === bank.toLowerCase(),
    );
    const bankName = (matched as any)?.name ?? bank;
    const lines: string[] = (matched as any)?.creditCards ?? [];

    this.save(ctx, { ...s, step: 'card_name', bank: bankName, cardLines: lines });

    if (lines.length > 0) {
      const rows = lines.map((l, i) => [Markup.button.callback(l, `CARDLINE_${i}`)]);
      rows.push([Markup.button.callback('✏️ Tự nhập tên khác', 'CARDLINE_CUSTOM')]);
      await ctx.reply(
        `🏦 *${bankName}*\n\n💳 *Chọn dòng thẻ* (hoặc tự nhập):`,
        { parse_mode: 'Markdown', reply_markup: Markup.inlineKeyboard(rows).reply_markup },
      );
    } else {
      await ctx.reply(
        `🏦 *${bankName}*\n\n💳 *Nhập tên thẻ:*\n_VD: Visa Platinum, StepUp..._`,
        { parse_mode: 'Markdown' },
      );
    }
  }

  @Action('CARDLINE_CUSTOM')
  async cardLineCustom(@Ctx() ctx: Context) {
    await this.ack(ctx);
    const s = this.session(ctx);
    if (!s || s.flow !== 'card') return;
    await ctx.reply('💳 *Nhập tên thẻ:*', { parse_mode: 'Markdown' });
  }

  @Action(/^CARDLINE_(\d+)$/)
  async cardLinePick(@Ctx() ctx: Context) {
    await this.ack(ctx);
    const s = this.session(ctx);
    if (!s || s.flow !== 'card' || !s.cardLines) return;
    const idx = parseInt((ctx as any).match[1]);
    const line = s.cardLines[idx];
    if (!line) return;
    this.save(ctx, { ...s, step: 'card_limit', cardName: line });
    await ctx.reply(
      `💳 *${line}*\n\n💰 *Nhập hạn mức tín dụng* (triệu ₫):\n_VD: 50 = 50,000,000₫_`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleCardName(ctx: Context, s: Session, text: string) {
    const cardName = text.trim();
    if (!cardName) {
      await ctx.reply('⚠️ Tên thẻ không hợp lệ. Nhập lại:');
      return;
    }
    this.save(ctx, { ...s, step: 'card_limit', cardName });
    await ctx.reply(
      `💳 *${cardName}*\n\n💰 *Nhập hạn mức tín dụng* (triệu ₫):\n_VD: 50 = 50,000,000₫_`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleCardLimit(ctx: Context, s: Session, text: string) {
    const raw = parseFloat(text.replace(',', '.'));
    if (isNaN(raw) || raw <= 0) {
      await ctx.reply('⚠️ Hạn mức không hợp lệ. Nhập số dương (triệu ₫). VD: `50`', { parse_mode: 'Markdown' });
      return;
    }
    const creditLimit = Math.round(raw * 1_000_000);
    this.save(ctx, { ...s, step: 'card_statement', creditLimit });
    await ctx.reply(
      `💰 *${this.fmt(creditLimit)}*\n\n📅 *Nhập ngày chốt sao kê* (1–31):`,
      { parse_mode: 'Markdown' },
    );
  }

  private async handleCardStatement(ctx: Context, s: Session, text: string) {
    const day = parseInt(text.trim());
    if (isNaN(day) || day < 1 || day > 31) {
      await ctx.reply('⚠️ Ngày chốt phải từ 1 đến 31. Nhập lại:');
      return;
    }
    if (!s.bank || !s.cardName || !s.creditLimit) {
      this.clear(ctx);
      await ctx.reply('❌ Phiên hết hạn. Thử lại.', { reply_markup: MAIN_MENU.reply_markup });
      return;
    }
    const ownerId = await this.requireLinkedUser(ctx);
    if (!ownerId) { this.clear(ctx); return; }
    try {
      await this.cardsService.create({
        bank: s.bank,
        cardName: s.cardName,
        creditLimit: s.creditLimit,
        statementDate: day,
      }, ownerId);
      this.clear(ctx);
      await ctx.reply(
        `✅ *Đã thêm thẻ!*\n\n💳 ${s.bank} — ${s.cardName}\n` +
        `💰 Hạn mức ${this.fmt(s.creditLimit)}\n📅 Chốt ngày ${day} hàng tháng`,
        { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
      );
    } catch (error: any) {
      this.logger.error('Bot: failed to add card', error?.message);
      this.clear(ctx);
      await ctx.reply(
        `❌ ${error?.response?.message || error?.message || 'Lỗi khi thêm thẻ.'}`,
        { reply_markup: MAIN_MENU.reply_markup },
      );
    }
  }

  // ── Catch-all text router ─────────────────────────────────────────────────────

  @On('text')
  async onText(@Ctx() ctx: Context) {
    // @ts-ignore
    const text: string = ctx.message?.text ?? '';
    if (text.startsWith('/')) return; // handled by @Command decorators

    const s = this.session(ctx);
    if (!s) {
      await ctx.reply('Chọn thao tác:', { reply_markup: MAIN_MENU.reply_markup });
      return;
    }

    switch (s.step) {
      case 'tx_amount':       return this.handleTxAmount(ctx, s, text);
      case 'tx_description':  return this.handleTxDescription(ctx, s, text);
      case 'card_bank':       return this.handleCardBank(ctx, s, text);
      case 'card_name':       return this.handleCardName(ctx, s, text);
      case 'card_limit':      return this.handleCardLimit(ctx, s, text);
      case 'card_statement':  return this.handleCardStatement(ctx, s, text);
      default:
        await ctx.reply('Chọn thao tác:', { reply_markup: MAIN_MENU.reply_markup });
    }
  }

  // ── /cards command ────────────────────────────────────────────────────────────

  @Command('cards')
  async cardsCmd(@Ctx() ctx: Context) {
    await this.showCards(ctx);
  }

  private async showCards(ctx: Context) {
    try {
      const ownerId = await this.requireLinkedUser(ctx);
      if (!ownerId) return;
      const cards = await this.cardsService.findAll(ownerId);
      if (cards.length === 0) {
        await ctx.reply(
          'Chưa có thẻ nào.',
          { reply_markup: Markup.inlineKeyboard([[Markup.button.callback('💳 Thêm thẻ ngay', 'ADD_CARD')]]).reply_markup },
        );
        return;
      }
      const list = cards.map((c: any) =>
        `💳 *${c.bank}* — ${c.cardName}\n   ${this.fmt(c.creditLimit)} · Chốt ngày ${c.statementDate}`,
      ).join('\n\n');
      await ctx.reply(`*Danh sách thẻ:*\n\n${list}`, { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup });
    } catch {
      await ctx.reply('Không thể tải danh sách thẻ.');
    }
  }

  // ── Quick commands (/spend, /income) ─────────────────────────────────────────

  @Command('spend')
  async onSpend(@Ctx() ctx: Context) { await this.quickTx(ctx, 'expense'); }

  @Command('income')
  async onIncome(@Ctx() ctx: Context) { await this.quickTx(ctx, 'income'); }

  private async quickTx(ctx: Context, type: 'expense' | 'income') {
    // @ts-ignore
    const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
    const cmd = type === 'expense' ? 'spend' : 'income';

    if (parts.length < 5) {
      await ctx.reply(
        `⚠️ Dùng: \`/${cmd} <triệu> <thẻ> <danh_mục> <mô_tả>\`\nVD: \`/${cmd} 0.15 VPBank an_uong Bữa trưa\``,
        { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
      );
      return;
    }

    const raw = parseFloat(parts[1].replace(',', '.'));
    if (isNaN(raw) || raw <= 0) {
      await ctx.reply('⚠️ Số tiền không hợp lệ. Đơn vị là triệu ₫. VD: `0.15` hoặc `1.5`', { parse_mode: 'Markdown' });
      return;
    }

    const amount = Math.round(raw * 1_000_000);
    const bankArg = parts[2];
    const category = CAT_ALIAS[parts[3].toLowerCase()] ?? parts[3];
    const description = parts.slice(4).join(' ');

    const ownerId = await this.requireLinkedUser(ctx);
    if (!ownerId) return;

    // Resolve the card by bank (first match).
    const cards = await this.cardsService.findAll(ownerId);
    const card = cards.find((c: any) => c.bank.toLowerCase() === bankArg.toLowerCase());
    if (!card) {
      await ctx.reply(`⚠️ Chưa có thẻ nào của "${bankArg}". Thêm thẻ bằng /addcard.`, { reply_markup: MAIN_MENU.reply_markup });
      return;
    }
    if (type === 'expense' && amount > (card as any).creditLimit) {
      await ctx.reply(
        `⚠️ Số tiền ${this.fmt(amount)} vượt quá hạn mức thẻ ${this.fmt((card as any).creditLimit)}.`,
        { parse_mode: 'Markdown', reply_markup: MAIN_MENU.reply_markup },
      );
      return;
    }

    try {
      await this.transactionsService.create({
        amount,
        bank: (card as any).bank,
        cardName: (card as any).cardName,
        category,
        description,
        type,
        date: new Date(),
      }, ownerId, { notifyTelegram: false });
      const label = type === 'expense' ? '💸 Chi tiêu' : '💰 Thu nhập';
      await ctx.reply(
        `✅ ${label} đã ghi nhận\n💳 ${(card as any).bank} — ${(card as any).cardName}\n💵 ${this.fmt(amount)}   🏷 ${category}\n📝 ${description}`,
        { reply_markup: MAIN_MENU.reply_markup },
      );
    } catch (error: any) {
      this.logger.error('Bot: quick tx failed', error?.message);
      await ctx.reply(`❌ ${error?.response?.message || error?.message || 'Lỗi khi lưu giao dịch.'}`);
    }
  }
}
