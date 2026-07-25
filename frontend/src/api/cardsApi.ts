import axiosClient from './axiosClient';
import type { CreditCard } from '../types';

export type CardInput = Omit<CreditCard, '_id' | 'createdAt' | 'updatedAt'>;

export const cardsApi = {
  getAll: (): Promise<CreditCard[]> => axiosClient.get('/api/cards'),
  create: (data: CardInput): Promise<CreditCard> => axiosClient.post('/api/cards', data),
  update: (id: string, data: Partial<CardInput>): Promise<CreditCard> =>
    axiosClient.put(`/api/cards/${id}`, data),
  delete: (id: string): Promise<void> => axiosClient.delete(`/api/cards/${id}`),
};
