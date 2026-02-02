import React, { useState, useMemo, useEffect, useRef } from 'react';
import { User } from 'firebase/auth';
import { Transaction, FinancialStats, FundType, SystemConfig, ReportHistory } from './types';
import { FUND_INFO } from './constants';
import TransactionForm from './components/TransactionForm';
import DashboardCharts from './components/DashboardCharts';
import LoginScreen from './components/LoginScreen';
import { getFinancialInsights } from './services/geminiService';
import { 
  subscribeToTransactions, 
  subscribeToConfig, 
  addTransaction as addTransactionToFirestore, 
  updateTransaction as updateTransactionInFirestore,
  deleteTransaction as deleteTransactionFromFirestore,
  saveConfig,
  migrateFromLocalStorage,
  saveReportHistory,
  subscribeToReportsHistory,
  subscribeTreasurySummary,
  incrementEmergencyBalance,
  TreasurySummary
} from './services/firestoreService';
import { subscribeToAuthState, logout } from './services/authService';
import { exportToExcel } from './services/exportService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { 
  Wallet, TrendingUp, TrendingDown, History, Sparkles, 
  Menu, Bell, LayoutDashboard, Landmark, Settings, FileText, Printer, ChevronRight, Search, Trash2, Cloud, CloudUpload, ExternalLink, CheckCircle2, AlertCircle, Database, LogOut, Download, FileSpreadsheet, RefreshCw, Share2
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRANSACTIONS' | 'REPORTS' | 'SETTINGS'>('DASHBOARD');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reportsHistory, setReportsHistory] = useState<ReportHistory[]>([]);
  const [treasurySummary, setTreasurySummary] = useState<TreasurySummary>({ emergencyBalance: 280.11, updatedAt: new Date().toISOString() });

  const defaultConfig: SystemConfig = {
    churchName: 'Igreja  À MESA',
    fundPercentages: { ALUGUER: 40, EMERGENCIA: 10, UTILIDADES: 20, GERAL: 30, INFANTIL: 0 },
    rentTarget: 1350,
    rentAmount: 450,
    sheetsUrl: '',
    emergencyInitialBalance: 0 // Saldo será calculado apenas a partir das transações
  };

  const [config, setConfig] = useState<SystemConfig>(defaultConfig);
  
  const [aiInsight, setAiInsight] = useState<string>('');
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Verificar autenticação
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((firebaseUser) => {
      setUser(firebaseUser);
      setIsCheckingAuth(false);
      if (!firebaseUser) {
        setIsLoadingData(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Migrar dados do localStorage para Firebase (apenas uma vez, após login)
  useEffect(() => {
    if (!user) return;
    
    const checkAndMigrate = async () => {
      const hasLocalData = localStorage.getItem('gestao_a_mesa_data') || localStorage.getItem('gestao_a_mesa_config');
      if (hasLocalData) {
        try {
          setMigrationStatus('Migrando dados para a nuvem...');
          const result = await migrateFromLocalStorage();
          if (result.transactions > 0 || result.config) {
            setMigrationStatus(`✅ Migração concluída! ${result.transactions} transações migradas.`);
            setTimeout(() => setMigrationStatus(''), 5000);
          }
        } catch (error) {
          console.error('Erro na migração:', error);
          // Erro silencioso - não exibir para o usuário
        }
      }
    };
    checkAndMigrate();
  }, [user]);

  // Escutar transações do Firebase em tempo real (apenas após login)
  useEffect(() => {
    if (!user) {
      setIsLoadingData(false);
      return;
    }
    
    // Timeout de segurança - se não carregar em 5 segundos, para de esperar
    const timeout = setTimeout(() => {
      setIsLoadingData(false);
    }, 5000);
    
    const unsubscribe = subscribeToTransactions(
      (firebaseTransactions) => {
        clearTimeout(timeout);
        setTransactions(firebaseTransactions);
        setIsLoadingData(false);
      },
      (error) => {
        clearTimeout(timeout);
        console.error('Erro Firebase:', error);
        setIsLoadingData(false);
      }
    );
    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [user]);

  // Escutar configurações do Firebase em tempo real (apenas após login)
  const [configLoaded, setConfigLoaded] = useState(false);
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToConfig((firebaseConfig) => {
      if (firebaseConfig) {
        // Resetar emergencyInitialBalance para 0 (será calculado apenas a partir das transações)
        setConfig({...firebaseConfig, emergencyInitialBalance: 0});
      }
      setConfigLoaded(true);
    });
    return () => unsubscribe();
  }, [user]);

  // Escutar histórico de relatórios do Firebase
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeToReportsHistory((reports) => {
      setReportsHistory(reports);
    });
    return () => unsubscribe();
  }, [user]);

  // Escutar treasury summary do Firebase (saldo de emergência persistido)
  useEffect(() => {
    if (!user) return;
    
    const unsubscribe = subscribeTreasurySummary((summary) => {
      setTreasurySummary(summary);
    });
    return () => unsubscribe();
  }, [user]);

  // Salvar configurações automaticamente quando mudam (após carregamento inicial)
  useEffect(() => {
    if (!user || !configLoaded) return;
    
    const timeoutId = setTimeout(() => {
      saveConfig(config).catch(err => console.error('Erro ao salvar config:', err));
    }, 1000); // Aguarda 1 segundo para não salvar a cada tecla
    
    return () => clearTimeout(timeoutId);
  }, [config, user, configLoaded]);

  const handleLogout = async () => {
    if (confirm('Deseja realmente sair do sistema?')) {
      await logout();
    }
  };

  // CÁLCULO AUTOMÁTICO E SIMPLES - sem depender de fundAllocations salvos
  const stats = useMemo((): FinancialStats => {
    let totalIncome = 0; 
    let totalExpenses = 0;
    let infantilIncome = 0; 
    let infantilExpenses = 0;
    
    // Saldos dos fundos - calculados automaticamente
    let saldoRenda = 0;
    // Saldo de emergência vem do Treasury Summary (persistido no Firebase)
    let saldoEmergencia = treasurySummary.emergencyBalance;
    let saldoUtilidades = 0; // Reservado (não afeta saldo disponível)
    let saldoGeral = 0; // Saldo Disponível - dinheiro efetivamente livre
    let saldoInfantil = 0;
    
    const META_RENDA = config.rentTarget; // €1350
    
    // Ordenar por data para processar na ordem correta
    const transacoesOrdenadas = [...transactions]
      .filter(tx => 
        !tx.description.toLowerCase().includes('reposição automática')
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    transacoesOrdenadas.forEach((tx) => {
      const isInfantil = tx.category === 'INFANTIL';
      
      if (tx.type === 'INCOME') {
        // === ENTRADAS ===
        if (isInfantil) {
          // Ministério Infantil - 100% separado
          infantilIncome += tx.amount;
          saldoInfantil += tx.amount;
        } else {
          // Entrada normal da igreja
          totalIncome += tx.amount;
          let valor = tx.amount;
          
          // NÃO descontar para utilidades aqui
          // A emergência (10%) é persistida no Firebase (não descontar)
          // Apenas destribuir: Renda + Saldo Disponível
          
          // 1º Preencher reserva de renda até a meta
          const faltaRenda = Math.max(0, META_RENDA - saldoRenda);
          if (faltaRenda > 0) {
            const paraRenda = Math.min(valor, faltaRenda);
            saldoRenda += paraRenda;
            valor -= paraRenda;
          }
          
          // 2º Resto vai para Saldo Disponível (Geral) - este é o dinheiro efetivamente livre
          if (valor > 0) {
            saldoGeral += valor;
          }
        }
      } else {
        // === SAÍDAS ===
        if (isInfantil) {
          infantilExpenses += tx.amount;
          saldoInfantil -= tx.amount;
        } else if (tx.category === 'RENDA') {
          // Pagamento de renda - sai da reserva de renda, se faltar busca no Saldo Disponível
          totalExpenses += tx.amount;
          if (saldoRenda >= tx.amount) {
            saldoRenda -= tx.amount;
          } else {
            // Usa o que tem e busca o resto no Saldo Disponível
            const falta = tx.amount - saldoRenda;
            saldoRenda = 0;
            saldoGeral -= falta;
          }
        } else if (tx.category === 'CONTA') {
          // Pagamento de contas (água, luz, tv) - sai de Utilidades, se faltar busca no Saldo Disponível
          totalExpenses += tx.amount;
          if (saldoUtilidades >= tx.amount) {
            saldoUtilidades -= tx.amount;
          } else {
            const falta = tx.amount - saldoUtilidades;
            saldoUtilidades = 0;
            saldoGeral -= falta;
          }
        } else if (tx.category === 'EMERGENCIA') {
          // Saída específica do fundo de emergência - SÓ aqui o fundo diminui
          totalExpenses += tx.amount;
          if (saldoEmergencia >= tx.amount) {
            saldoEmergencia -= tx.amount;
          } else {
            const falta = tx.amount - saldoEmergencia;
            saldoEmergencia = 0;
            saldoGeral -= falta;
          }
        } else if (tx.category === 'ALOCACAO_RENDA') {
          // Alocação manual de saldo para completar renda - sai de Geral, vai para Renda
          saldoGeral -= tx.amount;
          saldoRenda += tx.amount;
        } else {
          // Outras despesas (incluindo MANUTENCAO) - sai do Saldo Disponível
          totalExpenses += tx.amount;
          saldoGeral -= tx.amount;
        }
      }
    });
    
    const fundBalances: Record<FundType, number> = { 
      ALUGUER: saldoRenda, 
      EMERGENCIA: saldoEmergencia, 
      UTILIDADES: saldoUtilidades, // Água, Luz, TV
      GERAL: saldoGeral, // Saldo Disponível
      INFANTIL: saldoInfantil 
    };
    
    return { 
      totalIncome, 
      totalExpenses, 
      netBalance: totalIncome - totalExpenses, 
      fundBalances,
      infantilIncome,
      infantilExpenses
    };
  }, [transactions, config.rentTarget, treasurySummary]);

  const chartHistory = useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
    return months.map((m) => ({
      name: m,
      income: stats.totalIncome * (0.8 + Math.random() * 0.4),
      expense: stats.totalExpenses * (0.8 + Math.random() * 0.4),
    }));
  }, [stats]);

  const syncToSheets = async () => {
    if (!config.sheetsUrl) {
      alert("Por favor, configure o URL da planilha nas Definições primeiro.");
      setActiveTab('SETTINGS');
      return;
    }

    setSyncStatus('SYNCING');
    try {
      const response = await fetch(config.sheetsUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          churchName: config.churchName,
          lastSync: new Date().toISOString(),
          transactions: transactions.map(t => ({
            Data: new Date(t.date).toLocaleDateString('pt-PT'),
            Descricao: t.description,
            Tipo: t.type === 'INCOME' ? 'Entrada' : 'Saída',
            Categoria: t.category,
            Valor: t.amount,
            Fundo_Renda: t.fundAllocations.ALUGUER,
            Fundo_Emergencia: t.fundAllocations.EMERGENCIA,
            Fundo_AguaLuz: t.fundAllocations.UTILIDADES,
            Fundo_Geral: t.fundAllocations.GERAL
          }))
        })
      });

      setSyncStatus('SUCCESS');
      setTimeout(() => setSyncStatus('IDLE'), 3000);
    } catch (error) {
      console.error("Sync error:", error);
      setSyncStatus('ERROR');
      setTimeout(() => setSyncStatus('IDLE'), 5000);
    }
  };

  const handleAddTransaction = async (tx: Transaction) => {
    console.log('Tentando salvar transação:', tx);
    console.log('Usuário autenticado:', user?.email);
    
    if (!user) {
      alert('Você precisa estar logado para salvar transações.');
      return;
    }
    
    try {
      await addTransactionToFirestore(tx);
      console.log('Transação salva com sucesso!');
      
      // Se for DIZIMO ou OFERTA, incrementar saldo de emergência com 10%
      if ((tx.category === 'DIZIMO' || tx.category === 'OFERTA') && tx.type === 'INCOME') {
        const emergencyIncrement = tx.amount * 0.10;
        try {
          await incrementEmergencyBalance(emergencyIncrement);
          console.log(`Saldo de emergência incrementado em €${emergencyIncrement.toFixed(2)}`);
        } catch (error) {
          console.error('Erro ao incrementar emergência:', error);
        }
      }
    } catch (error: any) {
      console.error('Erro completo:', error);
      console.error('Código do erro:', error?.code);
      console.error('Mensagem:', error?.message);
      
      if (error?.code === 'permission-denied') {
        alert('Erro de permissão. Verifique se você está logado corretamente.');
      } else {
        alert('Erro ao salvar: ' + (error?.code || error?.message || 'Erro desconhecido'));
      }
      throw error;
    }
  };

  const handleSaveConfig = async (newConfig: SystemConfig) => {
    try {
      await saveConfig(newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações. Tente novamente.');
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

  // Função para salvar relatório no histórico
  const salvarRelatorioHistorico = async () => {
    if (!user) return;
    
    const report: ReportHistory = {
      date: new Date().toISOString(),
      totalIncome: stats.totalIncome,
      totalExpenses: stats.totalExpenses,
      netBalance: stats.netBalance,
      fundBalances: stats.fundBalances,
      infantilIncome: stats.infantilIncome,
      infantilExpenses: stats.infantilExpenses,
      generatedBy: user.email || undefined,
      createdAt: new Date().toISOString()
    };
    
    try {
      await saveReportHistory(report);
      
      // Atualizar o saldo inicial de emergência para o próximo período
      // O saldo de emergência atual passa a ser o saldo inicial
      const novoConfig = {
        ...config,
        emergencyInitialBalance: stats.fundBalances.EMERGENCIA
      };
      await saveConfig(novoConfig);
      setConfig(novoConfig);
      
      alert('✅ Relatório salvo no histórico com sucesso!\n\nO saldo de emergência foi atualizado para €' + stats.fundBalances.EMERGENCIA.toFixed(2));
    } catch (error) {
      console.error('Erro ao salvar relatório:', error);
      alert('Erro ao salvar relatório no histórico.');
    }
  };

  // Função para baixar PDF do relatório
  const baixarPDF = async () => {
    if (!reportRef.current) return;
    
    setIsGeneratingPDF(true);
    
    try {
      // Gerar imagem do relatório
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      // Criar PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      
      // Baixar o PDF
      const nomeArquivo = `Relatorio_${config.churchName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('pt-PT').replace(/\//g, '-')}.pdf`;
      pdf.save(nomeArquivo);
      
      // Perguntar se deseja salvar no histórico
      if (confirm('Deseja salvar este relatório no histórico para consultas futuras?')) {
        await salvarRelatorioHistorico();
      }
      
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Função para completar a reserva de renda usando o saldo disponível
  const completarReservaRenda = async () => {
    const faltaParaMeta = config.rentTarget - stats.fundBalances.ALUGUER;
    const saldoDisponivel = stats.fundBalances.GERAL;
    
    if (faltaParaMeta <= 0) {
      alert('A meta de reserva de renda já foi atingida!');
      return;
    }
    
    if (saldoDisponivel <= 0) {
      alert('Não há saldo disponível no fundo Geral para transferir.');
      return;
    }
    
    const valorTransferir = Math.min(faltaParaMeta, saldoDisponivel);
    
    if (!confirm(`Deseja transferir ${formatCurrency(valorTransferir)} do Saldo Disponível para a Reserva de Renda?`)) {
      return;
    }
    
    const transferencia: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      description: 'Alocação Manual - Completar Reserva de Renda',
      amount: valorTransferir,
      type: 'EXPENSE',
      category: 'ALOCACAO_RENDA' as any,
      fundAllocations: {
        ALUGUER: valorTransferir,
        EMERGENCIA: 0,
        UTILIDADES: 0,
        GERAL: -valorTransferir,
        INFANTIL: 0,
      }
    };
    
    try {
      await handleAddTransaction(transferencia);
      alert(`Transferência de ${formatCurrency(valorTransferir)} realizada com sucesso!`);
    } catch (error) {
      console.error('Erro na transferência:', error);
    }
  };

  const resetData = () => {
    if (confirm("Deseja realmente apagar todos os lançamentos locais? Esta ação não afetará sua planilha do Google se você já tiver sincronizado.")) {
      setTransactions([]);
      localStorage.removeItem('gestao_a_mesa_data');
    }
  };

  // Função para remover transações duplicadas
  const removerDuplicados = async () => {
    // Agrupar transações por chave única (descrição + valor + categoria + tipo)
    const grupos: Record<string, Transaction[]> = {};
    
    transactions.forEach(tx => {
      const chave = `${tx.description}|${tx.amount}|${tx.category}|${tx.type}`;
      if (!grupos[chave]) {
        grupos[chave] = [];
      }
      grupos[chave].push(tx);
    });
    
    // Encontrar grupos com mais de uma transação (duplicados)
    const duplicados: Transaction[] = [];
    Object.values(grupos).forEach(grupo => {
      if (grupo.length > 1) {
        // Ordenar por data e manter apenas o mais antigo
        grupo.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        // Adicionar todos exceto o primeiro (mais antigo) à lista de duplicados
        duplicados.push(...grupo.slice(1));
      }
    });
    
    if (duplicados.length === 0) {
      alert('Não foram encontradas transações duplicadas.');
      return;
    }
    
    const lista = duplicados.slice(0, 10).map(t => `- ${t.description}: €${t.amount.toFixed(2)}`).join('\n');
    const mais = duplicados.length > 10 ? `\n... e mais ${duplicados.length - 10} duplicados` : '';
    
    if (!confirm(`Encontrados ${duplicados.length} duplicado(s):\n\n${lista}${mais}\n\nDeseja remover os duplicados? (mantém a transação original)`)) {
      return;
    }
    
    let removidos = 0;
    for (const tx of duplicados) {
      try {
        await deleteTransactionFromFirestore(tx.id);
        removidos++;
      } catch (error) {
        console.error('Erro ao remover duplicado:', tx.id, error);
      }
    }
    
    alert(`✅ ${removidos} duplicado(s) removido(s) com sucesso!`);
  };

  // Função para limpar TODAS transações internas (reposições e transferências)
  const limparTransferenciasInternas = async () => {
    const transferencias = transactions.filter(tx => 
      tx.description.toLowerCase().includes('reposição automática') ||
      tx.description.toLowerCase().includes('transferência')
    );
    
    if (transferencias.length === 0) {
      alert('Não há transações internas (reposições/transferências) para remover.');
      return;
    }
    
    const lista = transferencias.map(t => `- ${t.description}: €${t.amount.toFixed(2)}`).join('\n');
    if (!confirm(`Encontradas ${transferencias.length} transação(ões) internas:\n\n${lista}\n\nDeseja removê-las?`)) {
      return;
    }
    
    let removidas = 0;
    for (const tx of transferencias) {
      try {
        await deleteTransactionFromFirestore(tx.id);
        removidas++;
      } catch (error) {
        console.error('Erro ao remover:', tx.id, error);
      }
    }
    
    alert(`${removidas} transação(ões) removida(s) com sucesso!\n\nAgora clique em "Recalcular Alocações".`);
  };

  // Função para recalcular alocações de todas as transações com as percentagens atuais
  const recalcularAlocacoes = async () => {
    if (!confirm(`RECALCULAR TODAS AS ALOCAÇÕES\n\n` +
      `Meta de Renda: €${config.rentTarget}\n` +
      `Percentagens: Emergência ${config.fundPercentages.EMERGENCIA}%, Água/Luz ${config.fundPercentages.UTILIDADES}%, Geral ${config.fundPercentages.GERAL}%\n\n` +
      `Isso vai redistribuir todas as entradas corretamente.\nContinuar?`)) {
      return;
    }

    let recalculadas = 0;
    let erros = 0;
    let saldoRenda = 0;

    // Filtrar apenas transações reais (sem transferências internas)
    const transacoesReais = transactions.filter(tx => 
      !tx.description.toLowerCase().includes('reposição automática') &&
      !tx.description.toLowerCase().includes('transferência')
    );

    // Ordenar por data para processar na ordem correta
    const sortedTransactions = [...transacoesReais].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    console.log('=== INICIANDO RECÁLCULO ===');
    console.log('Transações a processar:', sortedTransactions.length);
    console.log('Meta de Renda:', config.rentTarget);

    for (const tx of sortedTransactions) {
      // Para saídas de RENDA, diminuir do saldo
      if (tx.type !== 'INCOME') {
        if (tx.category === 'RENDA') {
          saldoRenda = Math.max(0, saldoRenda - tx.amount);
          console.log(`Pagamento renda: -€${tx.amount}, Saldo renda agora: €${saldoRenda}`);
        }
        continue;
      }
      
      // Ignorar entradas do ministério infantil
      if (tx.category === 'INFANTIL') continue;

      const val = tx.amount;
      let newAllocations: Record<FundType, number> = {
        ALUGUER: 0, EMERGENCIA: 0, UTILIDADES: 0, GERAL: 0, INFANTIL: 0
      };

      // Verificar quanto falta para completar a meta na reserva de renda
      const rentaMissing = Math.max(0, config.rentTarget - saldoRenda);
      
      if (rentaMissing > 0) {
        const rentaAllocation = Math.min(val, rentaMissing);
        newAllocations.ALUGUER = rentaAllocation;
        saldoRenda += rentaAllocation;
        
        const remaining = val - rentaAllocation;
        if (remaining > 0) {
          const totalOtherPercentages = config.fundPercentages.EMERGENCIA + config.fundPercentages.UTILIDADES + config.fundPercentages.GERAL;
          newAllocations.EMERGENCIA = remaining * (config.fundPercentages.EMERGENCIA / totalOtherPercentages);
          newAllocations.UTILIDADES = remaining * (config.fundPercentages.UTILIDADES / totalOtherPercentages);
          newAllocations.GERAL = remaining * (config.fundPercentages.GERAL / totalOtherPercentages);
        }
        console.log(`ENTRADA ${tx.description}: €${val} -> Renda: €${rentaAllocation.toFixed(2)}, Outros: €${(val - rentaAllocation).toFixed(2)}`);
      } else {
        // Meta atingida - distribui tudo entre os outros fundos
        const totalOtherPercentages = config.fundPercentages.EMERGENCIA + config.fundPercentages.UTILIDADES + config.fundPercentages.GERAL;
        newAllocations.EMERGENCIA = val * (config.fundPercentages.EMERGENCIA / totalOtherPercentages);
        newAllocations.UTILIDADES = val * (config.fundPercentages.UTILIDADES / totalOtherPercentages);
        newAllocations.GERAL = val * (config.fundPercentages.GERAL / totalOtherPercentages);
        console.log(`ENTRADA ${tx.description}: €${val} -> META ATINGIDA, tudo para outros fundos`);
      }

      // Atualizar no Firebase usando UPDATE
      try {
        await updateTransactionInFirestore(tx.id, { fundAllocations: newAllocations });
        recalculadas++;
      } catch (error) {
        console.error('Erro ao atualizar:', tx.id, error);
        erros++;
      }
    }

    console.log('=== RECÁLCULO FINALIZADO ===');
    console.log(`Saldo final Renda: €${saldoRenda}`);
    
    alert(`✅ Recálculo concluído!\n\n` +
      `${recalculadas} transações atualizadas\n` +
      `${erros} erros\n\n` +
      `Reserva de Renda final: €${saldoRenda.toFixed(2)}\n` +
      `(Meta: €${config.rentTarget})\n\n` +
      `Atualize a página para ver os novos valores.`);
  };

  const renderDashboard = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Paz do Senhor, Tesouraria!</h2>
          <p className="text-slate-500 text-sm font-medium">Aqui está o resumo financeiro de hoje.</p>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <SummaryCard icon={<Wallet size={24} />} title="Saldo Disponível" value={formatCurrency(stats.fundBalances.GERAL)} color="blue" />
        <SummaryCard icon={<TrendingUp size={24} />} title="Entradas Igreja" value={formatCurrency(stats.totalIncome)} color="emerald" />
        <SummaryCard icon={<Landmark size={24} />} title="Emergência" value={formatCurrency(stats.fundBalances.EMERGENCIA)} color="red" />
        
        {/* Card especial da Reserva Renda com botão para completar */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-amber-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl bg-amber-50 text-amber-600"><FileText size={24} /></div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Reserva Renda</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats.fundBalances.ALUGUER)}</h3>
          <p className="text-xs text-slate-500 mt-1">Meta: {formatCurrency(config.rentTarget)}</p>
          
          {stats.fundBalances.ALUGUER < config.rentTarget && stats.fundBalances.GERAL > 0 && (
            <button
              onClick={completarReservaRenda}
              className="mt-3 w-full py-2 px-3 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-xl transition-all"
            >
              Completar Reserva ({formatCurrency(Math.min(config.rentTarget - stats.fundBalances.ALUGUER, stats.fundBalances.GERAL))})
            </button>
          )}
          {stats.fundBalances.ALUGUER >= config.rentTarget && (
            <p className="mt-3 text-xs text-emerald-600 font-bold">Meta atingida</p>
          )}
        </div>
        
        {/* Card do Ministério Infantil - separado */}
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-purple-100 hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-2xl bg-purple-50 text-purple-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Min. Infantil</span>
          </div>
          <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(stats.fundBalances.INFANTIL)}</h3>
          <p className="text-[10px] text-slate-500 mt-1">
            <span className="text-emerald-600">+{formatCurrency(stats.infantilIncome)}</span>
            {' / '}
            <span className="text-red-600">-{formatCurrency(stats.infantilExpenses)}</span>
          </p>
        </div>
      </section>

      <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5"><Sparkles size={140} /></div>
        <div className="relative z-10">
          <h3 className="text-2xl font-black mb-4 flex items-center gap-3"><Sparkles className="text-amber-400" /> Conselheiro Gemini</h3>
          {aiInsight ? (
            <div className="bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 prose prose-invert max-w-none mb-6">
              <p className="whitespace-pre-wrap leading-relaxed text-slate-200">{aiInsight}</p>
            </div>
          ) : (
            <p className="text-slate-400 text-lg mb-6">Análise inteligente do fluxo de caixa e equilíbrio dos fundos ministeriais.</p>
          )}
          <button
            onClick={async () => {
              setIsLoadingInsight(true);
              const insight = await getFinancialInsights(stats, transactions.slice(0, 10));
              setAiInsight(insight || 'Análise indisponível.');
              setIsLoadingInsight(false);
            }}
            disabled={isLoadingInsight}
            className="px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-500 transition-all shadow-xl active:scale-95 disabled:opacity-50"
          >
            {isLoadingInsight ? 'Gerando Análise...' : 'Solicitar Consultoria IA'}
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TransactionForm onAdd={handleAddTransaction} config={config} currentRentBalance={stats.fundBalances.ALUGUER} />
        <FundDistribution stats={stats} />
      </div>

      <DashboardCharts stats={stats} history={chartHistory} />
      
      <RecentTransactions transactions={transactions} formatCurrency={formatCurrency} />
    </div>
  );

  const renderTransactions = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
       <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-xl font-bold text-slate-800">Livro de Caixa Ministerial</h3>
          <button onClick={syncToSheets} className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"><CloudUpload size={14} /> Backup para Planilha</button>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-black tracking-widest">
              <tr>
                <th className="px-6 py-4 text-left">Data</th>
                <th className="px-6 py-4 text-left">Descrição</th>
                <th className="px-6 py-4 text-left">Categoria</th>
                <th className="px-6 py-4 text-right">Valor</th>
                <th className="px-6 py-4 text-center">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">Nenhum lançamento registrado.</td></tr>
              ) : (
                transactions.map(tx => (
                  <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-500">{new Date(tx.date).toLocaleDateString('pt-PT')}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-800">{tx.description}</div>
                      {tx.invoiceRef && <div className="text-[9px] text-slate-400 font-bold mt-1">REF: {tx.invoiceRef}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight ${tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {tx.category}
                      </span>
                    </td>
                    <td className={`px-6 py-4 text-right font-black text-sm ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.type === 'INCOME' ? '+' : '-'} {formatCurrency(tx.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={async () => {
                          if (confirm(`Deseja cancelar esta movimentação?\n\n${tx.description}\n${formatCurrency(tx.amount)}`)) {
                            try {
                              await deleteTransactionFromFirestore(tx.id);
                              alert('Movimentação cancelada com sucesso!');
                            } catch (error) {
                              alert('Erro ao cancelar movimentação.');
                            }
                          }
                        }}
                        className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 mx-auto"
                      >
                        <Trash2 size={14} /> Cancelar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
       </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-8 animate-in zoom-in-95 duration-500 print:bg-white print:p-0">
      {/* Botões de Exportação */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-3xl shadow-xl print:hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-white">
            <h3 className="text-xl font-black flex items-center gap-2"><Download size={24} /> Exportar Dados</h3>
            <p className="text-emerald-100 text-sm font-medium">Baixe uma cópia dos dados para seu computador</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                exportToExcel(transactions, stats, config);
                alert('✅ Arquivo Excel baixado com sucesso!');
              }}
              className="flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 rounded-xl hover:bg-emerald-50 transition-all shadow-lg font-bold"
            >
              <FileSpreadsheet size={20} /> Baixar Excel
            </button>
            <button 
              onClick={salvarRelatorioHistorico}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-800 text-white rounded-xl hover:bg-emerald-900 transition-all shadow-lg font-bold"
            >
              <History size={20} /> Salvar no Histórico
            </button>
          </div>
        </div>
      </div>

      <div ref={reportRef} className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 print:shadow-none print:border-none">
        <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
          <div className="flex gap-5 items-center">
            <img src="/logo-branco.png" alt="Logo" className="w-16 h-16 object-contain bg-slate-900 rounded-2xl p-2" />
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{config.churchName}</h1>
              <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Relatório Mensal de Gestão Financeira</p>
            </div>
          </div>
          <div className="text-right flex items-center gap-3 print:hidden">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg font-bold">
              <Printer size={20} /> Imprimir / Salvar PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <ReportStat label="Total Entradas" value={formatCurrency(stats.totalIncome)} />
          <ReportStat label="Total Saídas" value={formatCurrency(stats.totalExpenses)} />
          <ReportStat label="Saldo Disponível" value={formatCurrency(stats.fundBalances.GERAL)} highlight />
          <ReportStat label="Saldo Total (Entradas - Saídas)" value={formatCurrency(stats.totalIncome - stats.totalExpenses)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
           <div>
             <h3 className="text-sm font-black text-slate-900 mb-8 uppercase tracking-widest border-l-4 border-slate-900 pl-4">Separação de Verbas por Fundo</h3>
             <div className="space-y-6">
                {Object.entries(stats.fundBalances).filter(([fund]) => fund !== 'GERAL').map(([fund, balance]) => (
                  <div key={fund}>
                    <div className="flex justify-between mb-2">
                      <span className="text-xs font-bold text-slate-600 uppercase">{FUND_INFO[fund as FundType]?.label || fund}</span>
                      <span className="text-sm font-black text-slate-900">{formatCurrency(balance as number)}</span>
                    </div>
                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ backgroundColor: FUND_INFO[fund as FundType]?.color || '#ccc', width: `${Math.max(0, (balance as number / (stats.totalIncome || 1)) * 100)}%` }} />
                    </div>
                  </div>
                ))}
             </div>
           </div>
           <div className="bg-slate-50 p-10 rounded-3xl border border-dashed border-slate-300 flex flex-col justify-center items-center text-center">
             <div className="p-6 bg-white rounded-full shadow-sm mb-6 border border-slate-100"><FileText size={48} className="text-slate-900" /></div>
             <h4 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Validado pela Tesouraria</h4>
             <div className="w-64 h-[2px] bg-slate-900 mt-12 mb-4" />
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Responsável Legal</p>
           </div>
        </div>
      </div>

      {/* Histórico de Relatórios */}
      {reportsHistory.length > 0 && (
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-100 print:hidden">
          <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-3">
            <History size={24} className="text-blue-600" /> Histórico de Relatórios
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black text-slate-500 uppercase">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Entradas</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Saídas</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Saldo</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Emergência</th>
                  <th className="px-4 py-3 text-right text-xs font-black text-slate-500 uppercase">Reserva Renda</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportsHistory.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm font-bold text-slate-700">
                      {new Date(report.date).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-emerald-600">
                      {formatCurrency(report.totalIncome)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                      {formatCurrency(report.totalExpenses)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-black text-slate-900">
                      {formatCurrency(report.netBalance)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-600">
                      {formatCurrency(report.fundBalances.EMERGENCIA)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-blue-600">
                      {formatCurrency(report.fundBalances.ALUGUER)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const renderSettings = () => (
    <div className="max-w-3xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-500">
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
        <h3 className="text-xl font-black text-slate-800 mb-8 border-b border-slate-100 pb-4">Configurações da Igreja</h3>
        <div className="space-y-6">
          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-2">Nome da Igreja</label>
            <input 
              type="text" 
              value={config.churchName}
              onChange={(e) => setConfig({...config, churchName: e.target.value})}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" 
            />
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 uppercase mb-2">Valor da Renda Mensal (€)</label>
            <input 
              type="number" 
              value={config.rentAmount}
              onChange={(e) => {
                const rentAmount = parseInt(e.target.value) || 0;
                setConfig({...config, rentAmount, rentTarget: rentAmount * 3});
              }}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-blue-600" 
            />
            <p className="text-xs text-slate-500 mt-1">Meta automática: 3x €{config.rentAmount} = €{config.rentTarget}</p>
          </div>

          <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-4">
            <h4 className="text-sm font-black text-emerald-900 uppercase tracking-widest flex items-center gap-2"><Database size={18} /> Backup dos Dados</h4>
            <div className="space-y-3 text-sm text-emerald-700 font-medium">
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl">
                <CheckCircle2 size={20} className="text-emerald-600" />
                <div>
                  <p className="font-bold text-emerald-800">Firebase Firestore (Automático)</p>
                  <p className="text-xs text-emerald-600">Seus dados são salvos automaticamente na nuvem do Google</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl">
                <FileSpreadsheet size={20} className="text-emerald-600" />
                <div>
                  <p className="font-bold text-emerald-800">Exportar para Excel (Manual)</p>
                  <p className="text-xs text-emerald-600">Vá em Relatórios → Baixar Excel para ter uma cópia local</p>
                </div>
              </div>
            </div>
          </div>
          
          <div>
            <h4 className="text-xs font-black text-slate-500 mb-6 uppercase tracking-widest">Regras de Distribuição Automática</h4>
            
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="font-bold text-blue-800 mb-2">💰 Como o dinheiro é distribuído:</p>
                <ol className="text-sm text-blue-700 space-y-2 list-decimal list-inside">
                  <li><strong>Reserva de Renda</strong> - Preenche até €{config.rentTarget} (3x renda mensal)</li>
                  <li><strong>Fundo de Emergência</strong> - 10% de cada entrada</li>
                  <li><strong>Água/Luz/TV</strong> - 10% de cada entrada</li>
                  <li><strong>Saldo Disponível</strong> - O restante (80%) fica disponível</li>
                </ol>
                <p className="text-xs text-blue-600 mt-3">* Ministério Infantil é 100% separado</p>
              </div>
              
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <label className="block text-xs font-black text-slate-500 mb-2 uppercase">Meta da Reserva de Renda (€)</label>
                <input 
                  type="number" 
                  value={config.rentTarget}
                  onChange={(e) => setConfig({...config, rentTarget: parseInt(e.target.value) || 1350})}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900" 
                />
                <p className="text-xs text-slate-500 mt-1">Recomendado: 3x o valor da renda mensal</p>
              </div>
              
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-bold text-amber-800 mb-3">🧹 Limpar dados antigos com problemas:</p>
                <button 
                  onClick={limparTransferenciasInternas} 
                  className="w-full py-2 bg-amber-500 text-white font-bold hover:bg-amber-600 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Trash2 size={14} /> Remover Transferências Internas Antigas
                </button>
              </div>
            </div>
          </div>
          
          <div className="pt-8 border-t border-slate-100 flex flex-col gap-3">
             <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
               <CheckCircle2 size={18} />
               <span>Configurações salvas automaticamente</span>
             </div>
             <button onClick={resetData} className="w-full py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition-all flex items-center justify-center gap-2 border border-transparent hover:border-red-100">
               <Trash2 size={16} /> Limpar Todos os Lançamentos Locais
             </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Tela de carregamento enquanto verifica autenticação
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 font-bold">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  // Tela de login se não estiver autenticado
  if (!user) {
    return <LoginScreen onLoginSuccess={() => {}} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 z-50 transform transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} print:hidden`}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-10 bg-gradient-to-br from-blue-500/10 to-transparent p-3 rounded-2xl border border-white/5 overflow-hidden">
            <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center shrink-0 overflow-hidden p-2 border border-white/10">
              <img src="/logo-branco.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-black text-white leading-tight tracking-tighter">À MESA</h1>
          </div>
          <nav className="space-y-1">
            <NavBtn active={activeTab === 'DASHBOARD'} onClick={() => setActiveTab('DASHBOARD')} icon={<LayoutDashboard size={20} />} label="Início" />
            <NavBtn active={activeTab === 'TRANSACTIONS'} onClick={() => setActiveTab('TRANSACTIONS')} icon={<History size={20} />} label="Lançamentos" />
            <NavBtn active={activeTab === 'REPORTS'} onClick={() => setActiveTab('REPORTS')} icon={<TrendingUp size={20} />} label="Relatórios" />
            <NavBtn active={activeTab === 'SETTINGS'} onClick={() => setActiveTab('SETTINGS')} icon={<Settings size={20} />} label="Definições" />
          </nav>
        </div>
        <div className="absolute bottom-6 left-6 right-6 space-y-3">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl backdrop-blur-sm">
             <p className="text-[10px] uppercase font-black text-slate-500 mb-1 tracking-widest">Usuário Logado</p>
             <div className="text-xs font-bold text-white truncate">{user.email}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-bold transition-all"
          >
            <LogOut size={16} /> Sair do Sistema
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between z-30 print:hidden">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Tesouraria / <span className="text-slate-900">{activeTab}</span></div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
               <Database size={14} /> Firebase Conectado
             </div>
             {syncStatus === 'SYNCING' && <div className="text-[10px] font-black text-blue-600 animate-pulse uppercase">Gravando na Nuvem...</div>}
             {syncStatus === 'SUCCESS' && <div className="text-[10px] font-black text-emerald-600 uppercase flex items-center gap-1"><CheckCircle2 size={14} /> Salvo no Sheets</div>}
             {syncStatus === 'ERROR' && <div className="text-[10px] font-black text-red-600 uppercase flex items-center gap-1"><AlertCircle size={14} /> Erro de Conexão</div>}
             <button className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-colors"><Bell size={20} /></button>
          </div>
        </header>

        {migrationStatus && (
          <div className="mx-6 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold text-blue-700 flex items-center gap-2">
            <Database size={18} /> {migrationStatus}
          </div>
        )}

        {isLoadingData ? (
          <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-500 font-bold">Carregando dados do Firebase...</p>
            </div>
          </div>
        ) : (
          <div className="p-6 md:p-10 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
            {activeTab === 'DASHBOARD' && renderDashboard()}
            {activeTab === 'TRANSACTIONS' && renderTransactions()}
            {activeTab === 'REPORTS' && renderReports()}
            {activeTab === 'SETTINGS' && renderSettings()}
          </div>
        )}
      </main>
    </div>
  );
};

// --- Subcomponents ---

const NavBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex items-center gap-4 w-full px-5 py-4 rounded-2xl transition-all font-black text-xs uppercase tracking-widest ${active ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 translate-x-1' : 'text-slate-500 hover:bg-white/5 hover:text-slate-200'}`}>
    {icon} {label}
  </button>
);

const SummaryCard = ({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: string, color: string }) => {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-100",
    red: "bg-red-50 text-red-600 border-red-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100"
  };
  return (
    <div className={`bg-white p-7 rounded-3xl shadow-sm border ${colors[color]} hover:shadow-md transition-all group`}>
      <div className="flex items-center justify-between mb-6">
        <div className={`p-4 rounded-2xl ${colors[color]} group-hover:scale-110 transition-transform`}>{icon}</div>
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{title}</span>
      </div>
      <h3 className="text-2xl font-black text-slate-900 tracking-tighter">{value}</h3>
    </div>
  );
};

const ReportStat = ({ label, value, highlight }: { label: string, value: string, highlight?: boolean }) => (
  <div className={`p-6 rounded-2xl border-2 ${highlight ? 'bg-emerald-600 text-white border-emerald-700 shadow-lg ring-4 ring-emerald-200 print:ring-2 print:ring-emerald-400' : 'border-slate-100 bg-white'}`}>
    <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${highlight ? 'text-emerald-100' : 'text-slate-500'}`}>{label}</p>
    <h4 className={`font-black tracking-tight ${highlight ? 'text-3xl print:text-black' : 'text-2xl'}`}>{value}</h4>
  </div>
);

const FundDistribution = ({ stats }: { stats: FinancialStats }) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 h-full">
    <h3 className="text-sm font-bold text-slate-800 mb-6">Distribuição por Fundos</h3>
    <div className="space-y-5">
      {Object.entries(stats.fundBalances).filter(([key]) => key !== 'GERAL' && key !== 'UTILIDADES').map(([key, balance]) => {
        const info = FUND_INFO[key as FundType];
        if (!info) return null;
        return (
          <div key={key} className="p-4 bg-slate-50 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <span className="text-sm font-semibold text-slate-700">{info.label}</span>
              <span className="text-base font-bold text-slate-900">{new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(balance as number)}</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-3">
              <div className="h-full rounded-full transition-all duration-1000" style={{ backgroundColor: info.color, width: `${Math.max(0, Math.min(100, (balance as number / (Math.max(stats.totalIncome, 1))) * 100))}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const RecentTransactions = ({ transactions, formatCurrency }: { transactions: Transaction[], formatCurrency: (v: number) => string }) => {
  const handleDeleteTransaction = async (transactionId: string, description: string, amount: number) => {
    if (confirm(`Deseja cancelar esta movimentação?\n\n${description}\n${formatCurrency(amount)}`)) {
      try {
        await deleteTransactionFromFirestore(transactionId);
        alert('Movimentação cancelada com sucesso!');
      } catch (error) {
        alert('Erro ao cancelar movimentação.');
      }
    }
  };

  return (
    <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest"><History size={18} className="text-blue-600" /> Movimentações Recentes</h3>
      </div>
      <div className="space-y-4">
        {transactions.slice(0, 5).map(tx => (
          <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl border border-transparent transition-all group">
            <div className="flex items-center gap-4 flex-1">
              <div className={`p-2.5 rounded-xl ${tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                 {tx.type === 'INCOME' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{tx.description}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className={`text-sm font-black ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
                {tx.type === 'INCOME' ? '+' : '-'} {formatCurrency(tx.amount)}
              </div>
              <button
                onClick={() => handleDeleteTransaction(tx.id, tx.description, tx.amount)}
                className="px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-xs font-bold opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
