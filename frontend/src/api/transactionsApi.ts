import axiosClient from './axiosClient';
import type { Transaction, Stat } from '../types';

export type TransactionInput = Omit<Transaction, '_id' | 'createdAt' | 'updatedAt'>;

export interface CategoryStat { category: string; total: number; }
export interface MonthlyStat { month: string; expense: number; income: number; }

export const transactionsApi = {
  getAll: (): Promise<Transaction[]> => axiosClient.get('/api/transactions'),
  create: (data: TransactionInput): Promise<Transaction> =>
    axiosClient.post('/api/transactions', data),
  update: (id: string, data: Partial<TransactionInput>): Promise<Transaction> =>
    axiosClient.patch(`/api/transactions/${id}`, data),
  remove: (id: string): Promise<void> => axiosClient.delete(`/api/transactions/${id}`),
  getStats: (): Promise<Stat[]> => axiosClient.get('/api/transactions/stats'),
  // Phân tích: chi tiêu theo danh mục + xu hướng theo tháng.
  getByCategory: (): Promise<CategoryStat[]> =>
    axiosClient.get('/api/transactions/stats/by-category'),
  getMonthly: (months = 6): Promise<MonthlyStat[]> =>
    axiosClient.get(`/api/transactions/stats/monthly?months=${months}`),
};
