
export type FundType = 'ALUGUER' | 'EMERGENCIA' | 'GERAL' | 'INFANTIL';

export interface SystemConfig {
  churchName: string;
  fundPercentages: Record<FundType, number>;
  rentTarget: number;
  rentAmount: number; // Valor da renda mensal (ex: 450€)
  sheetsUrl?: string; // URL do Webhook do Google Apps Script
  emergencyInitialBalance?: number; // Saldo inicial do fundo de emergência (do último relatório)
}

export interface ReportHistory {
  id?: string;
  date: string; // Data de emissão do relatório
  totalIncome: number;
  totalExpenses: number;
  netBalance: number;
  fundBalances: Record<FundType, number>;
  infantilIncome: number;
  infantilExpenses: number;
  generatedBy?: string; // Email do usuário que gerou
  createdAt: string;
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
  category: 'DIZIMO' | 'OFERTA' | 'INFANTIL' | 'CONTA' | 'MANUTENCAO' | 'SOCIAL' | 'RENDA' | 'OUTROS' | 'EMERGENCIA' | 'ALOCACAO_RENDA';
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
  // Valores separados do infantil (não contam no saldo da igreja)
  infantilIncome: number;
  infantilExpenses: number;
}