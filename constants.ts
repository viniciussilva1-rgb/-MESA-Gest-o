
import { FundType } from './types';

export const FUND_INFO: Record<FundType, { label: string; color: string }> = {
  ALUGUER: { label: 'Reserva de Rendas (Meta €1200)', color: '#3b82f6' },
  EMERGENCIA: { label: 'Emergência (10%)', color: '#ef4444' },
  UTILIDADES: { label: 'Água e Luz', color: '#f59e0b' },
  GERAL: { label: 'Geral (Equip./Manut.)', color: '#10b981' },
};
