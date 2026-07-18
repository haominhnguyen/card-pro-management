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
    // Roomier "large" controls give forms a more polished, professional feel.
    controlHeightLG: 44,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  components: {
    Button: {
      // Weightier label + rounder corners; drop the flat default box-shadow so
      // primary buttons read as crisp, modern CTAs.
      fontWeight: 600,
      borderRadius: 10,
      borderRadiusLG: 10,
      controlHeightLG: 44,
      primaryShadow: '0 2px 8px rgba(22, 119, 255, 0.28)',
      defaultShadow: 'none',
    },
    Input: {
      borderRadius: 10,
      borderRadiusLG: 10,
      controlHeightLG: 44,
      activeShadow: '0 0 0 3px rgba(22, 119, 255, 0.12)',
    },
    Form: {
      labelColor: '#374151',
      verticalLabelPadding: '0 0 6px',
      itemMarginBottom: 20,
    },
  },
};
