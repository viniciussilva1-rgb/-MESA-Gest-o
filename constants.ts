
import { FundType } from './types';

export const FUND_INFO: Record<FundType, { label: string; color: string }> = {
  ALUGUER: { label: 'Reserva de Rendas (Meta €1350)', color: '#3b82f6' },
  GERAL: { label: 'Saldo Disponível', color: '#10b981' },
  INFANTIL: { label: 'Ministério Infantil', color: '#8b5cf6' },
};

// Adicione aqui os emails que terão acesso de visitante (somente leitura).
export const VISITOR_EMAILS = [
  'visitante@amesa.local'
];

export const isVisitorEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return VISITOR_EMAILS.map((item) => item.toLowerCase()).includes(normalizedEmail);
};
