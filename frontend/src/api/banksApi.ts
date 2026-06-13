import axiosClient from './axiosClient';
import type { Bank } from '../types';

export const banksApi = {
  getAll: (search?: string): Promise<Bank[]> =>
    axiosClient.get('/api/banks', { params: search ? { search } : undefined }),
  getByCardBrand: (cardBrand: string): Promise<Bank[]> =>
    axiosClient.get(`/api/banks/brand/${cardBrand}`),
};
