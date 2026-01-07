
import { GoogleGenAI } from "@google/genai";
import { Transaction, FinancialStats } from "../types";

export const getFinancialInsights = async (stats: FinancialStats, recentTransactions: Transaction[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Você é um consultor financeiro ministerial sênior para a "Igreja  À MESA".
      A moeda oficial é o EURO (€).
      
      Dados Atuais da Igreja:
      - Receita Total (Dízimos/Ofertas): € ${stats.totalIncome.toFixed(2)}
      - Despesas Totais: € ${stats.totalExpenses.toFixed(2)}
      - Saldo em Caixa: € ${stats.netBalance.toFixed(2)}
      - Reserva de Renda: € ${stats.fundBalances.ALUGUER.toFixed(2)} (Meta mensal de reserva estratégica: €1350 - equivalente a 3 meses de renda)
      - Fundo Emergência (10%): € ${stats.fundBalances.EMERGENCIA.toFixed(2)}
      - Fundo Água/Luz: € ${stats.fundBalances.UTILIDADES.toFixed(2)}
      - Fundo Geral/Manutenção: € ${stats.fundBalances.GERAL.toFixed(2)}

      Objetivo: Fornecer 3 conselhos estratégicos curtos focado na saúde ministerial, no alcance da meta de reserva de 1350€ e na transparência financeira.
      Retorne apenas a lista Markdown.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text;
  } catch (error) {
    console.error("Erro no Gemini:", error);
    return "Conselho indisponível. Verifique as movimentações e tente novamente.";
  }
};
