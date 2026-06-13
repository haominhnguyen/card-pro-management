import axiosClient from './axiosClient';
import type { CreditCard } from '../types';

export const cardsApi = {
  getAll: (): Promise<CreditCard[]> => axiosClient.get('/api/cards'),
  create: (data: Omit<CreditCard, '_id' | 'createdAt' | 'updatedAt'>): Promise<CreditCard> =>
    axiosClient.post('/api/cards', data),
  delete: (id: string): Promise<void> => axiosClient.delete(`/api/cards/${id}`),
};
