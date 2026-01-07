import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Transaction, SystemConfig, FinancialStats } from '../types';

export const exportToExcel = (
  transactions: Transaction[],
  stats: FinancialStats,
  config: SystemConfig
) => {
  // Criar workbook
  const wb = XLSX.utils.book_new();

  // ============ ABA 1: TRANSAÇÕES ============
  const transactionsData = transactions.map(tx => ({
    'Data': new Date(tx.date).toLocaleDateString('pt-PT'),
    'Descrição': tx.description,
    'Tipo': tx.type === 'INCOME' ? 'Entrada' : 'Saída',
    'Categoria': tx.category,
    'Valor (€)': tx.amount,
    'Fundo Renda': tx.fundAllocations.ALUGUER || 0,
    'Fundo Emergência': tx.fundAllocations.EMERGENCIA || 0,
    'Fundo Água/Luz': tx.fundAllocations.UTILIDADES || 0,
    'Fundo Geral': tx.fundAllocations.GERAL || 0,
    'Referência': tx.invoiceRef || ''
  }));

  const wsTransactions = XLSX.utils.json_to_sheet(transactionsData);
  
  // Ajustar largura das colunas
  wsTransactions['!cols'] = [
    { wch: 12 }, // Data
    { wch: 35 }, // Descrição
    { wch: 10 }, // Tipo
    { wch: 15 }, // Categoria
    { wch: 12 }, // Valor
    { wch: 14 }, // Fundo Renda
    { wch: 16 }, // Fundo Emergência
    { wch: 14 }, // Fundo Água/Luz
    { wch: 12 }, // Fundo Geral
    { wch: 15 }, // Referência
  ];

  XLSX.utils.book_append_sheet(wb, wsTransactions, 'Transações');

  // ============ ABA 2: RESUMO ============
  const resumoData = [
    { 'Indicador': 'Total de Entradas', 'Valor (€)': stats.totalIncome },
    { 'Indicador': 'Total de Saídas', 'Valor (€)': stats.totalExpenses },
    { 'Indicador': 'Saldo Líquido', 'Valor (€)': stats.netBalance },
    { 'Indicador': '', 'Valor (€)': '' },
    { 'Indicador': '--- SALDOS POR FUNDO ---', 'Valor (€)': '' },
    { 'Indicador': 'Fundo Renda/Aluguer', 'Valor (€)': stats.fundBalances.ALUGUER },
    { 'Indicador': 'Fundo Emergência', 'Valor (€)': stats.fundBalances.EMERGENCIA },
    { 'Indicador': 'Fundo Água/Luz', 'Valor (€)': stats.fundBalances.UTILIDADES },
    { 'Indicador': 'Fundo Geral', 'Valor (€)': stats.fundBalances.GERAL },
    { 'Indicador': '', 'Valor (€)': '' },
    { 'Indicador': '--- CONFIGURAÇÕES ---', 'Valor (€)': '' },
    { 'Indicador': 'Nome da Igreja', 'Valor (€)': config.churchName },
    { 'Indicador': 'Valor Renda Mensal', 'Valor (€)': config.rentAmount },
    { 'Indicador': 'Meta Reserva (3x)', 'Valor (€)': config.rentTarget },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(resumoData);
  wsResumo['!cols'] = [
    { wch: 25 },
    { wch: 20 },
  ];

  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Financeiro');

  // ============ GERAR ARQUIVO ============
  const hoje = new Date().toISOString().split('T')[0];
  const nomeArquivo = `A_MESA_Financeiro_${hoje}.xlsx`;

  // Converter para blob e baixar
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  saveAs(blob, nomeArquivo);

  return nomeArquivo;
};

export const exportToCSV = (transactions: Transaction[]) => {
  const headers = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Valor', 'Fundo Renda', 'Fundo Emergência', 'Fundo Água/Luz', 'Fundo Geral', 'Referência'];
  
  const rows = transactions.map(tx => [
    new Date(tx.date).toLocaleDateString('pt-PT'),
    `"${tx.description}"`,
    tx.type === 'INCOME' ? 'Entrada' : 'Saída',
    tx.category,
    tx.amount,
    tx.fundAllocations.ALUGUER || 0,
    tx.fundAllocations.EMERGENCIA || 0,
    tx.fundAllocations.UTILIDADES || 0,
    tx.fundAllocations.GERAL || 0,
    tx.invoiceRef || ''
  ].join(';'));

  const csv = [headers.join(';'), ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  
  const hoje = new Date().toISOString().split('T')[0];
  saveAs(blob, `A_MESA_Transacoes_${hoje}.csv`);
};
