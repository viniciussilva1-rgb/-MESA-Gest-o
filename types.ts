
export type FundType = 'ALUGUER' | 'EMERGENCIA' | 'UTILIDADES' | 'GERAL';

export interface SystemConfig {
  churchName: string;
  fundPercentages: Record<FundType, number>;
  rentTarget: number;
  rentAmount: number; // Valor da renda mensal (ex: 450€)
  sheetsUrl?: string; // URL do Webhook do Google Apps Script
}

export interface CashCount {
  notes: {
    500: number; 200: number; 100: number; 50: number; 20: number; 10: number; 5: number;
  };
  coins: {
    2: number; 1: number; 0.5: number; 0.2: number; 0.1: number; 0.05: number; 0.02: number; 0.01: number;
  };
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  category: 'DIZIMO' | 'OFERTA' | 'INFANTIL' | 'CONTA' | 'MANUTENCAO' | 'SOCIAL' | 'RENDA' | 'OUTROS';
  fundAllocations: Record<FundType, number>;
  cashCount?: CashCount;
  invoiceRef?: string;
  hasAttachment?: boolean;
}

export interface FinancialStats {
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  fundBalances: Record<FundType, number>;
}