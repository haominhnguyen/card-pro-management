import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { qk } from './queryClient';
import { cardsApi } from '../api/cardsApi';
import { transactionsApi, type TransactionInput } from '../api/transactionsApi';
import { banksApi } from '../api/banksApi';
import { isDemo } from '../demo/demoMode';
import { demoStore } from '../demo/demoStore';

// In trial mode every query/mutation is served from the in-memory demo store
// instead of the REST API, so the whole app works without a backend session.

// ── Queries ──────────────────────────────────────────────────────────────
export const useCards = () =>
  useQuery({ queryKey: qk.cards, queryFn: () => (isDemo() ? demoStore.getCards() : cardsApi.getAll()) });

export const useTransactions = () =>
  useQuery({ queryKey: qk.transactions, queryFn: () => (isDemo() ? demoStore.getTransactions() : transactionsApi.getAll()) });

export const useStats = () =>
  useQuery({ queryKey: qk.stats, queryFn: () => (isDemo() ? demoStore.getStats() : transactionsApi.getStats()) });

export const useBanks = () =>
  useQuery({ queryKey: qk.banks, queryFn: () => (isDemo() ? demoStore.getBanks() : banksApi.getAll()) });

export const useCategoryStats = () =>
  useQuery({ queryKey: qk.statsByCategory, queryFn: () => (isDemo() ? demoStore.getByCategory() : transactionsApi.getByCategory()) });

export const useMonthlyStats = (months = 6) =>
  useQuery({ queryKey: qk.statsMonthly(months), queryFn: () => (isDemo() ? demoStore.getMonthly(months) : transactionsApi.getMonthly(months)) });

// ── Mutations ────────────────────────────────────────────────────────────
/** Sau mọi thay đổi giao dịch/thẻ, làm mới list + stats. */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.transactions });
    qc.invalidateQueries({ queryKey: qk.stats });
    qc.invalidateQueries({ queryKey: ['stats'] });
    qc.invalidateQueries({ queryKey: qk.cards });
  };
}

export function useCreateTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: TransactionInput) =>
      isDemo() ? Promise.resolve(demoStore.createTransaction(data)) : transactionsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useUpdateTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TransactionInput> }) =>
      isDemo() ? Promise.resolve(demoStore.updateTransaction(id, data)) : transactionsApi.update(id, data),
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      isDemo() ? Promise.resolve(demoStore.deleteTransaction(id)) : transactionsApi.remove(id),
    onSuccess: invalidate,
  });
}

export function useCreateCard() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (data: Parameters<typeof cardsApi.create>[0]) =>
      isDemo() ? Promise.resolve(demoStore.createCard(data)) : cardsApi.create(data),
    onSuccess: invalidate,
  });
}

export function useDeleteCard() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) =>
      isDemo() ? Promise.resolve(demoStore.deleteCard(id)) : cardsApi.delete(id),
    onSuccess: invalidate,
  });
}
