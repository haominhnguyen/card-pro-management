import axiosClient from './axiosClient';

export interface TelegramStatus {
  linked: boolean;
  chats: { telegramId: number; telegramName?: string }[];
}

export interface LinkCode {
  code: string;
  deepLink: string;
}

export const telegramApi = {
  createLinkCode: (): Promise<LinkCode> => axiosClient.post('/api/telegram/link-code'),
  getStatus: (): Promise<TelegramStatus> => axiosClient.get('/api/telegram/status'),
  unlink: (): Promise<{ success: boolean }> => axiosClient.delete('/api/telegram/link'),
};
