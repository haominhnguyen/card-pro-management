import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dữ liệu tài chính thay đổi qua thao tác người dùng / socket → giữ tươi vừa phải.
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const qk = {
  cards: ['cards'] as const,
  transactions: ['transactions'] as const,
  stats: ['stats'] as const,
  banks: ['banks'] as const,
  statsByCategory: ['stats', 'by-category'] as const,
  statsMonthly: (months: number) => ['stats', 'monthly', months] as const,
};
