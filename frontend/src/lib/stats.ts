import type { CreditCard, Stat } from '../types';

export interface CardUsage {
  exp: number;
  inc: number;
  balance: number;
  /** % hạn mức đã dùng (0–100, đã cap). */
  pct: number;
  /** true khi > 80%. */
  warn: boolean;
}

/** Tính chi/thu/khả dụng/% sử dụng cho một thẻ từ mảng stats (group theo bank). */
export function cardUsage(card: CreditCard, stats: Stat[]): CardUsage {
  const exp = stats.find(s => s.bank === card.bank && s.type === 'expense')?.total ?? 0;
  const inc = stats.find(s => s.bank === card.bank && s.type === 'income')?.total ?? 0;
  const balance = card.creditLimit + inc - exp;
  const pct = card.creditLimit > 0 ? Math.min((exp / card.creditLimit) * 100, 100) : 0;
  return { exp, inc, balance, pct, warn: pct > 80 };
}

export interface Totals {
  totalLimit: number;
  totalExpense: number;
  totalIncome: number;
  balance: number;
  /** % tổng hạn mức đã dùng (0–100, đã cap). */
  usedPct: number;
}

/** Tổng hợp toàn bộ thẻ + stats cho dashboard. */
export function totals(cards: CreditCard[], stats: Stat[]): Totals {
  const totalLimit = cards.reduce((s, c) => s + c.creditLimit, 0);
  const totalExpense = stats.filter(s => s.type === 'expense').reduce((s, i) => s + i.total, 0);
  const totalIncome = stats.filter(s => s.type === 'income').reduce((s, i) => s + i.total, 0);
  const balance = totalLimit + totalIncome - totalExpense;
  const usedPct = totalLimit > 0 ? Math.min((totalExpense / totalLimit) * 100, 100) : 0;
  return { totalLimit, totalExpense, totalIncome, balance, usedPct };
}
