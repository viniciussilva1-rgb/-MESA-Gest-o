
import { FundType } from './types';
import { User } from 'firebase/auth';

export const FUND_INFO: Record<FundType, { label: string; color: string }> = {
  ALUGUER: { label: 'Reserva de Rendas (Meta €1350)', color: '#3b82f6' },
  GERAL: { label: 'Saldo Disponível', color: '#10b981' },
  INFANTIL: { label: 'Ministério Infantil', color: '#8b5cf6' },
};

// Adicione aqui os emails que terão acesso de visitante (somente leitura).
export const VISITOR_EMAILS = [
  'visitante@amesa.local'
];

// IDs de usuários visitantes no Firebase Auth (mais seguro que validar apenas email).
export const VISITOR_UIDS = [
  'SvSuCBI4tggG0SXVQcl5C8qm5nP2'
];

export const isVisitorEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  const inAllowList = VISITOR_EMAILS.map((item) => item.toLowerCase()).includes(normalizedEmail);
  const byPattern = normalizedEmail.includes('visit');
  return inAllowList || byPattern;
};

export const isVisitorUser = (user?: Pick<User, 'uid' | 'email'> | null): boolean => {
  if (!user) return false;
  const byUid = VISITOR_UIDS.includes(user.uid);
  const byEmail = isVisitorEmail(user.email);
  return byUid || byEmail;
};
