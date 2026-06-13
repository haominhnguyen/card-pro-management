import dayjs from 'dayjs';

/** Compact money display: 50M ₫ / 500K ₫ / 900 ₫ (giữ dấu âm). */
export const fmtM = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ₫`;
  if (abs >= 1_000) return `${Math.round(n / 1_000)}K ₫`;
  return `${n.toLocaleString('vi-VN')} ₫`;
};

/** Full money display with thousand separators: "150.000 ₫". */
export const fmtVnd = (n: number): string => `${(n ?? 0).toLocaleString('vi-VN')} ₫`;

/** Date display. withTime=true → "DD/MM/YYYY HH:mm", false → "DD/MM/YYYY". */
export const fmtDate = (d: string | Date, withTime = false): string =>
  dayjs(d).format(withTime ? 'DD/MM/YYYY HH:mm' : 'DD/MM/YYYY');

/** Short date for compact tables: "DD/MM HH:mm". */
export const fmtDateShort = (d: string | Date): string => dayjs(d).format('DD/MM HH:mm');

/**
 * AntD InputNumber formatter/parser cho ô nhập tiền VND có dấu phân cách nghìn.
 * Dùng: <InputNumber formatter={vndFormatter} parser={vndParser} addonAfter="₫" />
 */
export const vndFormatter = (value: string | number | undefined): string =>
  value === undefined || value === '' ? '' : `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const vndParser = (display: string | undefined): string =>
  (display ?? '').replace(/\./g, '').replace(/[^\d]/g, '');
