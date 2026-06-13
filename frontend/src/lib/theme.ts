import type { ThemeConfig } from 'antd';

/**
 * Design tokens tập trung. Phase sau (dark mode) chỉ cần đổi/đắp thêm ở đây
 * thay vì rải rác trong các component.
 */
export const BRAND = {
  primary: '#1677ff',
  expense: '#f43f5e', // rose-500
  income: '#10b981', // emerald-500
  warning: '#f97316', // orange-500
  danger: '#ef4444', // red-500
} as const;

export const appTheme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    borderRadius: 8,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
};
