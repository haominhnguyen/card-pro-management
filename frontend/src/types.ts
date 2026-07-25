export interface CreditCard {
  _id: string;
  bank: string;
  cardName: string;
  creditLimit: number;
  statementDate: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Transaction {
  _id: string;
  amount: number;
  bank: string;
  cardName?: string;
  /** Card._id this transaction is attributed to (resolved server-side). */
  cardId?: string;
  category: string;
  description: string;
  date: string;
  type: 'expense' | 'income';
  createdAt?: string;
  updatedAt?: string;
}

export interface Stat {
  bank: string;
  type: 'expense' | 'income';
  total: number;
}

export interface Bank {
  _id: string;
  code: string;
  name: string;
  fullName: string;
  logo?: string;
  color?: string;
  description?: string;
  website?: string;
  hotline?: string;
  cardBrands?: string[];
  creditCards?: string[];
  isActive?: boolean;
}
