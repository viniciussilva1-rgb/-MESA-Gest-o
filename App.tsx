
import React, { useState, useMemo, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Transaction, FinancialStats, FundType, SystemConfig } from './types';
import { FUND_INFO } from './constants';
import TransactionForm from './components/TransactionForm';
import DashboardCharts from './components/DashboardCharts';
import LoginScreen from './components/LoginScreen';
import { getFinancialInsights } from './services/geminiService';
import { 
  subscribeToTransactions, 
  subscribeToConfig, 
  addTransaction as addTransactionToFirestore, 
  saveConfig,
  migrateFromLocalStorage 
} from './services/firestoreService';
import { subscribeToAuthState, logout } from './services/authService';
import { exportToExcel } from './services/exportService';
import { 
  Wallet, TrendingUp, TrendingDown, History, Sparkles, 
  Menu, Bell, LayoutDashboard, Landmark, Settings, FileText, Printer, ChevronRight, Search, Trash2, Cloud, CloudUpload, ExternalLink, CheckCircle2, AlertCircle, Database, LogOut, Download, FileSpreadsheet, RefreshCw
} from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'TRANSACTIONS' | 'REPORTS' | 'SETTINGS'>('DASHBOARD');
  const [syncStatus, setSyncStatus] = useState<'IDLE' | 'SYNCING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const defaultConfig: SystemConfig = {
    churchName: 'Igreja  À MESA',
    fundPercentages: { ALUGUER: 40, EMERGENCIA: 10, UTILIDADES: 20, GERAL: 30 },
    rentTarget: 1350,
    rentAmount: 450,
    sheetsUrl: ''
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
        setConfig(firebaseConfig);
      }
      setConfigLoaded(true);
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

  const stats = useMemo((): FinancialStats => {
    const fundBalances: Record<FundType, number> = { ALUGUER: 0, EMERGENCIA: 0, UTILIDADES: 0, GERAL: 0, INFANTIL: 0 };
    let totalIncome = 0; let totalExpenses = 0;
    let infantilIncome = 0; let infantilExpenses = 0;
    
    transactions.forEach((tx) => {
      // Separar valores do ministério infantil
      const isInfantil = tx.category === 'INFANTIL';
      
      // Verificar se é uma transação interna (transferência entre fundos)
      const isTransferenciaInterna = tx.description.toLowerCase().includes('transferência') || 
                                      tx.description.toLowerCase().includes('reposição automática');
      
      if (tx.type === 'INCOME') {
        if (isInfantil) {
          infantilIncome += tx.amount;
          fundBalances.INFANTIL += tx.amount;
        } else {
          totalIncome += tx.amount;
        }
      } else {
        if (isInfantil) {
          infantilExpenses += tx.amount;
          fundBalances.INFANTIL -= tx.amount;
        } else if (!isTransferenciaInterna) {
          // Só conta como despesa real se NÃO for transferência interna
          totalExpenses += tx.amount;
        }
      }
      
      // Processar fundAllocations para os outros fundos (exceto infantil que já foi tratado acima)
      Object.entries(tx.fundAllocations).forEach(([fund, val]) => {
        if (fund in fundBalances && fund !== 'INFANTIL') {
          fundBalances[fund as FundType] += (val as number) || 0;
        }
      });
    });
    return { 
      totalIncome, 
      totalExpenses, 
      netBalance: totalIncome - totalExpenses, 
      fundBalances,
      infantilIncome,
      infantilExpenses
    };
  }, [transactions]);

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
      description: 'Transferência para completar Reserva de Renda',
      amount: valorTransferir,
      type: 'EXPENSE',
      category: 'OUTROS',
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

  // Função para recalcular alocações de todas as transações com as percentagens atuais
  const recalcularAlocacoes = async () => {
    if (!confirm('Isto irá recalcular todas as alocações de entradas com as percentagens atuais. Transações de saída não serão alteradas. Continuar?')) {
      return;
    }

    let recalculadas = 0;
    let saldoRenda = 0; // Rastreamos o saldo de renda para simular o preenchimento prioritário

    // Ordenar por data para processar na ordem correta
    const sortedTransactions = [...transactions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const tx of sortedTransactions) {
      // Só recalcula entradas que não são INFANTIL nem transferências
      if (tx.type !== 'INCOME') {
        // Atualizar saldo de renda baseado nas saídas
        if (tx.category === 'RENDA') {
          saldoRenda -= tx.amount;
        } else if (tx.description.toLowerCase().includes('reposição automática')) {
          saldoRenda += tx.amount; // Reposição adiciona de volta
        }
        continue;
      }
      
      if (tx.category === 'INFANTIL') continue;

      const val = tx.amount;
      let newAllocations: Record<FundType, number> = {
        ALUGUER: 0, EMERGENCIA: 0, UTILIDADES: 0, GERAL: 0, INFANTIL: 0
      };

      // Verificar quanto falta para completar a meta de €1350 na reserva de renda
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
      } else {
        const totalOtherPercentages = config.fundPercentages.EMERGENCIA + config.fundPercentages.UTILIDADES + config.fundPercentages.GERAL;
        newAllocations.EMERGENCIA = val * (config.fundPercentages.EMERGENCIA / totalOtherPercentages);
        newAllocations.UTILIDADES = val * (config.fundPercentages.UTILIDADES / totalOtherPercentages);
        newAllocations.GERAL = val * (config.fundPercentages.GERAL / totalOtherPercentages);
      }

      // Atualizar no Firebase
      try {
        await addTransactionToFirestore({ ...tx, fundAllocations: newAllocations });
        recalculadas++;
      } catch (error) {
        console.error('Erro ao recalcular transação:', tx.id, error);
      }
    }

    alert(`${recalculadas} transação(ões) recalculada(s) com sucesso!`);
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
        <SummaryCard icon={<Wallet size={24} />} title="Saldo Disponível" value={formatCurrency(stats.fundBalances.UTILIDADES + stats.fundBalances.GERAL)} color="blue" />
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
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactions.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum lançamento registrado.</td></tr>
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
          </div>
        </div>
      </div>

      <div className="bg-white p-10 rounded-3xl shadow-xl border border-slate-100 print:shadow-none print:border-none">
        <div className="flex justify-between items-start mb-12 border-b-2 border-slate-900 pb-8">
          <div className="flex gap-5 items-center">
            <img src="/logo-branco.png" alt="Logo" className="w-16 h-16 object-contain bg-slate-900 rounded-2xl p-2" />
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">{config.churchName}</h1>
              <p className="text-slate-500 font-bold uppercase text-xs tracking-widest">Relatório Mensal de Gestão Financeira</p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end print:hidden">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg font-bold">
              <Printer size={20} /> Emitir PDF do Mês
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <ReportStat label="Total Dízimos/Ofertas" value={formatCurrency(stats.totalIncome)} />
          <ReportStat label="Total Despesas" value={formatCurrency(stats.totalExpenses)} />
          <ReportStat label="Saldo Disponível" value={formatCurrency(stats.fundBalances.UTILIDADES + stats.fundBalances.GERAL)} highlight />
          <ReportStat label="Saldo Final (Todos Fundos)" value={formatCurrency(stats.netBalance)} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
           <div>
             <h3 className="text-sm font-black text-slate-900 mb-8 uppercase tracking-widest border-l-4 border-slate-900 pl-4">Separação de Verbas por Fundo</h3>
             <div className="space-y-6">
                {Object.entries(stats.fundBalances).map(([fund, balance]) => (
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
            <h4 className="text-xs font-black text-slate-500 mb-6 uppercase tracking-widest">Divisão de Receitas Automática (%)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {Object.entries(FUND_INFO).map(([key, info]) => (
                 <div key={key}>
                   <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-tighter">{info.label}</label>
                   <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={config.fundPercentages[key as FundType] || 0}
                      onChange={(e) => setConfig({
                        ...config, 
                        fundPercentages: {...config.fundPercentages, [key]: parseInt(e.target.value)||0}
                      })}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900" 
                    />
                    <span className="font-black text-slate-400">%</span>
                   </div>
                 </div>
               ))}
            </div>
            <div className={`mt-6 p-4 rounded-xl text-xs flex items-center justify-between font-bold ${Object.values(config.fundPercentages).reduce((a: number, b: number) => a + b, 0) === 100 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              <span className="flex items-center gap-2"><Sparkles size={16} /> Total da Distribuição:</span>
              <span className="text-lg">{Object.values(config.fundPercentages).reduce((a: number, b: number) => a + b, 0)}%</span>
            </div>
            
            <button 
              onClick={recalcularAlocacoes} 
              className="mt-4 w-full py-3 bg-blue-600 text-white font-bold hover:bg-blue-700 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw size={16} /> Recalcular Todas as Alocações
            </button>
            <p className="text-xs text-slate-500 text-center mt-2">
              Use este botão para aplicar as novas percentagens a todas as transações existentes
            </p>
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
      {Object.entries(stats.fundBalances).map(([key, balance]) => {
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

const RecentTransactions = ({ transactions, formatCurrency }: { transactions: Transaction[], formatCurrency: (v: number) => string }) => (
  <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
    <div className="flex items-center justify-between mb-8">
      <h3 className="text-[11px] font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest"><History size={18} className="text-blue-600" /> Movimentações Recentes</h3>
    </div>
    <div className="space-y-4">
      {transactions.slice(0, 5).map(tx => (
        <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-2xl border border-transparent transition-all">
          <div className="flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
               {tx.type === 'INCOME' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{tx.description}</p>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight">{tx.category} • {new Date(tx.date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className={`text-sm font-black ${tx.type === 'INCOME' ? 'text-emerald-600' : 'text-red-600'}`}>
            {tx.type === 'INCOME' ? '+' : '-'} {formatCurrency(tx.amount)}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default App;
