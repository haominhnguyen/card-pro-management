import type { CreditCard, Stat, Transaction } from '../types';

export interface CardUsage {
  exp: number;
  inc: number;
  balance: number;
  /** % hạn mức đã dùng (0–100, đã cap). */
  pct: number;
  /** true khi > 80%. */
  warn: boolean;
}

/**
 * Does a transaction belong to THIS specific card?
 * Prefer the explicit cardId link; fall back to (bank + cardName) for legacy/bot rows
 * that predate the cardId backfill. This is what makes per-card stats correct when a
 * bank holds several cards (the old bank-only match double-counted every card).
 */
function txBelongsToCard(t: Transaction, card: CreditCard): boolean {
  if (t.cardId) return t.cardId === card._id;
  return t.bank === card.bank && t.cardName === card.cardName;
}

/** Chi/thu/khả dụng/% sử dụng cho một thẻ, tính trực tiếp từ giao dịch của thẻ đó. */
export function cardUsage(card: CreditCard, transactions: Transaction[]): CardUsage {
  let exp = 0;
  let inc = 0;
  for (const t of transactions) {
    if (!txBelongsToCard(t, card)) continue;
    if (t.type === 'expense') exp += t.amount;
    else inc += t.amount;
  }
  const balance = card.creditLimit + inc - exp;
  const pct = card.creditLimit > 0 ? Math.min((exp / card.creditLimit) * 100, 100) : 0;
  return { exp, inc, balance, pct, warn: pct > 80 };
}

/**
 * Start of the card's CURRENT statement cycle. A statement closes on `statementDate`
 * each month; the open cycle began on the most recent close date (clamped to the
 * month length for e.g. day 31 in February).
 */
export function currentCycleStart(statementDate: number, now: Date = new Date()): Date {
  const clampDay = (y: number, m: number) => Math.min(statementDate, new Date(y, m + 1, 0).getDate());
  let year = now.getFullYear();
  let month = now.getMonth();
  const closeThisMonth = clampDay(year, month);
  if (now.getDate() > closeThisMonth) {
    return new Date(year, month, closeThisMonth);
  }
  month -= 1;
  if (month < 0) {
    month = 11;
    year -= 1;
  }
  return new Date(year, month, clampDay(year, month));
}

/** Tổng chi tiêu của thẻ trong kỳ sao kê hiện tại (từ ngày chốt gần nhất tới nay). */
export function cardCycleSpend(card: CreditCard, transactions: Transaction[], now: Date = new Date()): number {
  const start = currentCycleStart(card.statementDate, now);
  let exp = 0;
  for (const t of transactions) {
    if (t.type !== 'expense') continue;
    if (!txBelongsToCard(t, card)) continue;
    if (new Date(t.date) >= start) exp += t.amount;
  }
  return exp;
}

export interface Totals {
  totalLimit: number;
  totalExpense: number;
  totalIncome: number;
  balance: number;
  /** % tổng hạn mức đã dùng (0–100, đã cap). */
  usedPct: number;
}

/** Tổng hợp toàn bộ thẻ + stats cho dashboard (tổng chi/thu toàn tài khoản). */
export function totals(cards: CreditCard[], stats: Stat[]): Totals {
  const totalLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalExpense = stats.filter(s => s.type === 'expense').reduce((s, i) => s + i.total, 0);
  const totalIncome = stats.filter(s => s.type === 'income').reduce((s, i) => s + i.total, 0);
  const balance = totalLimit + totalIncome - totalExpense;
  const usedPct = totalLimit > 0 ? Math.min((totalExpense / totalLimit) * 100, 100) : 0;
  return { totalLimit, totalExpense, totalIncome, balance, usedPct };
}
