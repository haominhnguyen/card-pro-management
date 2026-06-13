/**
 * In-memory data store powering "trial / experience" mode (no backend, no login).
 *
 * Mirrors the shape the real REST API returns so every view, component and feature
 * works unchanged — including create/update/delete, which mutate these arrays.
 * State is module-scoped: it persists while navigating, and resets on a full reload
 * or whenever trial mode is (re)entered via `reset()`.
 */
import type { Bank, CreditCard, Transaction, Stat } from '../types';
import type { CategoryStat, MonthlyStat } from '../api/transactionsApi';

// ── id helpers ─────────────────────────────────────────────────────────────
let idCounter = 1000;
const nextId = (prefix: string) => `demo_${prefix}_${++idCounter}`;

// ── Seed: banks ──────────────────────────────────────────────────────────────
// No logo URLs on purpose — BankLogo degrades to a coloured initials avatar.
const SEED_BANKS: Bank[] = [
  {
    _id: 'demo_bank_vpb', code: 'VPB', name: 'VPBank', fullName: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    color: '#00a651', cardBrands: ['Visa', 'Mastercard'],
    creditCards: ['StepUp Mastercard', 'Lady Mastercard', 'Shopee Platinum'], isActive: true,
  },
  {
    _id: 'demo_bank_tcb', code: 'TCB', name: 'Techcombank', fullName: 'Ngân hàng TMCP Kỹ Thương Việt Nam',
    color: '#ec1c24', cardBrands: ['Visa'],
    creditCards: ['Visa Signature', 'Visa Classic', 'Spark'], isActive: true,
  },
  {
    _id: 'demo_bank_vib', code: 'VIB', name: 'VIB', fullName: 'Ngân hàng TMCP Quốc Tế Việt Nam',
    color: '#0046ad', cardBrands: ['Visa', 'Mastercard'],
    creditCards: ['Cash Back', 'Online Plus', 'Travel Élite'], isActive: true,
  },
  {
    _id: 'demo_bank_tpb', code: 'TPB', name: 'TPBank', fullName: 'Ngân hàng TMCP Tiên Phong',
    color: '#6a1b9a', cardBrands: ['Visa', 'Mastercard'],
    creditCards: ['Visa FreeGo', 'EVO'], isActive: true,
  },
  {
    _id: 'demo_bank_stb', code: 'STB', name: 'Sacombank', fullName: 'Ngân hàng TMCP Sài Gòn Thương Tín',
    color: '#0072bc', cardBrands: ['Visa', 'Mastercard', 'JCB'],
    creditCards: ['Visa Platinum', 'JCB Ultimate'], isActive: true,
  },
  {
    _id: 'demo_bank_hsbc', code: 'HSBC', name: 'HSBC', fullName: 'Ngân hàng HSBC Việt Nam',
    color: '#db0011', cardBrands: ['Visa'],
    creditCards: ['Visa Cash Back', 'Live+'], isActive: true,
  },
];

// ── Seed: cards ──────────────────────────────────────────────────────────────
const seedCards = (): CreditCard[] => [
  { _id: 'demo_card_1', bank: 'VPBank', cardName: 'StepUp Mastercard', creditLimit: 60_000_000, statementDate: 5 },
  { _id: 'demo_card_2', bank: 'Techcombank', cardName: 'Visa Signature', creditLimit: 120_000_000, statementDate: 12 },
  { _id: 'demo_card_3', bank: 'VIB', cardName: 'Cash Back', creditLimit: 40_000_000, statementDate: 18 },
  { _id: 'demo_card_4', bank: 'TPBank', cardName: 'Visa FreeGo', creditLimit: 25_000_000, statementDate: 25 },
  { _id: 'demo_card_5', bank: 'Sacombank', cardName: 'Visa Platinum', creditLimit: 80_000_000, statementDate: 8 },
];

// ── Seed: transactions ─────────────────────────────────────────────────────────
// Spread across the last 6 months so analytics (by category / monthly trend) is rich.
interface TxSeed {
  bank: string; card: string; amount: number; category: string;
  type: 'expense' | 'income'; desc: string;
}

// Per-month templates — duplicated across months with small offsets for variety.
const MONTHLY_TEMPLATE: TxSeed[] = [
  { bank: 'Techcombank', card: 'Visa Signature', amount: 28_000_000, category: 'Khác', type: 'income', desc: 'Lương tháng' },
  { bank: 'VPBank', card: 'StepUp Mastercard', amount: 3_200_000, category: 'Ăn uống', type: 'expense', desc: 'Nhà hàng & cà phê' },
  { bank: 'VPBank', card: 'StepUp Mastercard', amount: 1_850_000, category: 'Ăn uống', type: 'expense', desc: 'Đi chợ / siêu thị' },
  { bank: 'VIB', card: 'Cash Back', amount: 4_500_000, category: 'Mua sắm', type: 'expense', desc: 'Mua sắm Shopee/Lazada' },
  { bank: 'Sacombank', card: 'Visa Platinum', amount: 6_800_000, category: 'Thuê nhà', type: 'expense', desc: 'Tiền thuê căn hộ' },
  { bank: 'TPBank', card: 'Visa FreeGo', amount: 1_250_000, category: 'Tiền điện nước', type: 'expense', desc: 'Điện, nước, internet' },
  { bank: 'Techcombank', card: 'Visa Signature', amount: 2_400_000, category: 'Vận chuyển', type: 'expense', desc: 'Grab & xăng xe' },
  { bank: 'VIB', card: 'Cash Back', amount: 1_650_000, category: 'Giải trí', type: 'expense', desc: 'Netflix, Spotify, xem phim' },
  { bank: 'Sacombank', card: 'Visa Platinum', amount: 3_900_000, category: 'Y tế', type: 'expense', desc: 'Khám sức khỏe & thuốc' },
  { bank: 'VPBank', card: 'StepUp Mastercard', amount: 550_000, category: 'Khác', type: 'income', desc: 'Hoàn tiền (cashback)' },
];

// Extra one-off transactions for the current month to make recent activity dense.
const CURRENT_MONTH_EXTRA: TxSeed[] = [
  { bank: 'TPBank', card: 'Visa FreeGo', amount: 12_500_000, category: 'Giáo dục', type: 'expense', desc: 'Học phí khóa học online' },
  { bank: 'Techcombank', card: 'Visa Signature', amount: 8_900_000, category: 'Mua sắm', type: 'expense', desc: 'iPhone phụ kiện & đồ công nghệ' },
  { bank: 'VIB', card: 'Cash Back', amount: 2_100_000, category: 'Ăn uống', type: 'expense', desc: 'Đặt tiệc cuối tuần' },
  { bank: 'Sacombank', card: 'Visa Platinum', amount: 15_000_000, category: 'Vận chuyển', type: 'expense', desc: 'Vé máy bay du lịch' },
];

function buildTransactions(): Transaction[] {
  const out: Transaction[] = [];
  const now = new Date();

  for (let m = 5; m >= 0; m--) {
    const base = new Date(now.getFullYear(), now.getMonth() - m, 1);
    MONTHLY_TEMPLATE.forEach((t, i) => {
      // Spread within the month: day 2..27, slight per-item jitter.
      const day = Math.min(27, 2 + ((i * 3 + m) % 25));
      const date = new Date(base.getFullYear(), base.getMonth(), day, 9 + (i % 10), (i * 7) % 60);
      // Gentle variation so monthly bars aren't perfectly flat.
      const factor = 1 + (((i + m) % 5) - 2) * 0.08;
      out.push({
        _id: nextId('tx'),
        bank: t.bank,
        cardName: t.card,
        amount: Math.round((t.amount * factor) / 1000) * 1000,
        category: t.category,
        type: t.type,
        description: t.desc,
        date: date.toISOString(),
      });
    });
  }

  CURRENT_MONTH_EXTRA.forEach((t, i) => {
    const date = new Date(now.getFullYear(), now.getMonth(), Math.min(28, now.getDate() - i), 14, i * 11);
    out.push({
      _id: nextId('tx'),
      bank: t.bank, cardName: t.card, amount: t.amount,
      category: t.category, type: t.type, description: t.desc,
      date: date.toISOString(),
    });
  });

  // Newest first (matches API ordering expectations across the app).
  return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

// ── Mutable state ──────────────────────────────────────────────────────────────
let banks: Bank[] = [];
let cards: CreditCard[] = [];
let transactions: Transaction[] = [];

function reset(): void {
  banks = SEED_BANKS.map(b => ({ ...b }));
  cards = seedCards();
  transactions = buildTransactions();
}
reset(); // seed on import

// ── Derived stats ──────────────────────────────────────────────────────────────
function getStats(): Stat[] {
  const map = new Map<string, Stat>();
  for (const t of transactions) {
    const key = `${t.bank}|${t.type}`;
    const cur = map.get(key) ?? { bank: t.bank, type: t.type, total: 0 };
    cur.total += t.amount;
    map.set(key, cur);
  }
  return [...map.values()];
}

function getByCategory(): CategoryStat[] {
  const map = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    map.set(t.category, (map.get(t.category) ?? 0) + t.amount);
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function getMonthly(months = 6): MonthlyStat[] {
  const now = new Date();
  const buckets: MonthlyStat[] = [];
  const index = new Map<string, MonthlyStat>();
  for (let m = months - 1; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = { month: key, expense: 0, income: 0 };
    buckets.push(bucket);
    index.set(key, bucket);
  }
  for (const t of transactions) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = index.get(key);
    if (!bucket) continue;
    if (t.type === 'expense') bucket.expense += t.amount;
    else bucket.income += t.amount;
  }
  return buckets;
}

// ── CRUD (signatures mirror the real api modules) ───────────────────────────────
type CardInput = Omit<CreditCard, '_id' | 'createdAt' | 'updatedAt'>;
type TxInput = Omit<Transaction, '_id' | 'createdAt' | 'updatedAt'>;

function getCards(): CreditCard[] { return cards.map(c => ({ ...c })); }
function getBanks(): Bank[] { return banks.map(b => ({ ...b })); }
function getTransactions(): Transaction[] { return transactions.map(t => ({ ...t })); }

function createCard(data: CardInput): CreditCard {
  const card: CreditCard = { ...data, _id: nextId('card'), createdAt: new Date().toISOString() };
  cards = [...cards, card];
  return { ...card };
}

function deleteCard(id: string): void {
  cards = cards.filter(c => c._id !== id);
}

function createTransaction(data: TxInput): Transaction {
  const tx: Transaction = { ...data, _id: nextId('tx'), createdAt: new Date().toISOString() };
  transactions = [tx, ...transactions].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return { ...tx };
}

function updateTransaction(id: string, data: Partial<TxInput>): Transaction {
  let updated: Transaction | undefined;
  transactions = transactions
    .map(t => (t._id === id ? (updated = { ...t, ...data, updatedAt: new Date().toISOString() }) : t))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
  if (!updated) throw new Error('Không tìm thấy giao dịch');
  return { ...updated };
}

function deleteTransaction(id: string): void {
  transactions = transactions.filter(t => t._id !== id);
}

export const demoStore = {
  reset,
  getBanks,
  getCards,
  getTransactions,
  getStats,
  getByCategory,
  getMonthly,
  createCard,
  deleteCard,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
