import React, { useState, useEffect } from 'react';
import { Transaction, FundType, CashCount, SystemConfig } from '../types';
import { FUND_INFO } from '../constants';
import { PlusCircle, MinusCircle, Calculator, Receipt, Home, Wallet, ArrowDownCircle, ArrowUpCircle, FileText, Tag, CreditCard, CheckCircle } from 'lucide-react';

interface Props {
  onAdd: (transaction: Transaction) => void;
  config: SystemConfig;
  currentRentBalance: number;
}

const TransactionForm: React.FC<Props> = ({ onAdd, config, currentRentBalance }) => {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Transaction['category']>('DIZIMO');
  const [targetFund, setTargetFund] = useState<FundType>('GERAL');
  const [showCounter, setShowCounter] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  
  const [cashCount, setCashCount] = useState<CashCount>({
    notes: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 },
    coins: { 2: 0, 1: 0, 0.5: 0, 0.2: 0, 0.1: 0, 0.05: 0, 0.02: 0, 0.01: 0 }
  });

  const calculateCashTotal = () => {
    const notesTotal = Object.entries(cashCount.notes).reduce((acc, [val, qty]) => acc + (parseFloat(val) * (qty as number)), 0);
    const coinsTotal = Object.entries(cashCount.coins).reduce((acc, [val, qty]) => acc + (parseFloat(val) * (qty as number)), 0);
    return notesTotal + coinsTotal;
  };

  useEffect(() => {
    if (showCounter && type === 'INCOME') {
      const total = calculateCashTotal();
      if (total > 0) setAmount(total.toFixed(2));
    }
  }, [cashCount, showCounter, type]);

  // Reset categoria quando muda o tipo
  useEffect(() => {
    if (type === 'INCOME') {
      setCategory('DIZIMO');
    } else {
      setCategory('CONTA');
      setTargetFund('GERAL');
    }
  }, [type]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(val);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const val = parseFloat(amount.replace(',', '.'));
    if (isNaN(val) || val <= 0) {
      alert('Por favor, insira um valor válido maior que zero.');
      return;
    }
    
    if (!description.trim()) {
      alert('Por favor, insira uma descrição.');
      return;
    }

    setIsSubmitting(true);

    let allocations: Record<FundType, number> = {
      ALUGUER: 0, EMERGENCIA: 0, UTILIDADES: 0, GERAL: 0
    };

    if (type === 'INCOME') {
      const rentTargetReached = currentRentBalance >= config.rentTarget;
      
      if (rentTargetReached) {
        allocations.ALUGUER = 0;
        allocations.EMERGENCIA = val * (config.fundPercentages.EMERGENCIA / 100);
        allocations.UTILIDADES = val * (config.fundPercentages.UTILIDADES / 100);
        allocations.GERAL = val * ((config.fundPercentages.GERAL + config.fundPercentages.ALUGUER) / 100);
      } else {
        allocations.ALUGUER = val * (config.fundPercentages.ALUGUER / 100);
        allocations.EMERGENCIA = val * (config.fundPercentages.EMERGENCIA / 100);
        allocations.UTILIDADES = val * (config.fundPercentages.UTILIDADES / 100);
        allocations.GERAL = val * (config.fundPercentages.GERAL / 100);
      }
    } else {
      if (category === 'RENDA') {
        allocations.ALUGUER = -val;
      } else {
        allocations[targetFund] = -val;
      }
    }

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      description: description.trim(),
      amount: val,
      type,
      category,
      fundAllocations: allocations,
      cashCount: showCounter ? cashCount : undefined,
      invoiceRef: type === 'EXPENSE' ? invoiceRef : undefined,
      hasAttachment: type === 'EXPENSE' && !!invoiceRef
    };

    try {
      await onAdd(newTransaction);
      
      if (type === 'EXPENSE' && category === 'RENDA') {
        const repoTransaction: Transaction = {
          id: crypto.randomUUID(),
          date: new Date().toISOString(),
          description: `Reposição automática - Reserva Renda`,
          amount: val,
          type: 'EXPENSE',
          category: 'OUTROS',
          fundAllocations: {
            ALUGUER: val,
            EMERGENCIA: 0,
            UTILIDADES: 0,
            GERAL: -val,
          },
          invoiceRef: undefined,
          hasAttachment: false
        };
        await onAdd(repoTransaction);
      }
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      resetForm();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar a movimentação. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setInvoiceRef('');
    setShowCounter(false);
    setCashCount({
      notes: { 500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0, 5: 0 },
      coins: { 2: 0, 1: 0, 0.5: 0, 0.2: 0, 0.1: 0, 0.05: 0, 0.02: 0, 0.01: 0 }
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-5 ${type === 'INCOME' ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-red-500 to-rose-500'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
              {type === 'INCOME' ? <ArrowDownCircle size={28} className="text-white" /> : <ArrowUpCircle size={28} className="text-white" />}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Nova Movimentação</h2>
              <p className="text-white/80 text-sm font-medium">{type === 'INCOME' ? 'Registrar entrada de valores' : 'Registrar saída de valores'}</p>
            </div>
          </div>
          {showSuccess && (
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl animate-in zoom-in duration-300">
              <CheckCircle size={20} className="text-white" />
              <span className="text-white font-bold text-sm">Salvo!</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Tipo de Movimentação */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={`relative flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all border-2 ${
              type === 'INCOME' 
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <PlusCircle size={22} />
            <span>Entrada</span>
            {type === 'INCOME' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center"><CheckCircle size={12} className="text-white" /></div>}
          </button>
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={`relative flex items-center justify-center gap-3 py-4 rounded-2xl font-bold transition-all border-2 ${
              type === 'EXPENSE' 
                ? 'bg-red-50 border-red-500 text-red-700 shadow-lg shadow-red-100' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <MinusCircle size={22} />
            <span>Saída</span>
            {type === 'EXPENSE' && <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"><CheckCircle size={12} className="text-white" /></div>}
          </button>
        </div>

        {/* Valor */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Wallet size={16} className="text-slate-400" />
              Valor
            </label>
            {type === 'INCOME' && (
              <button 
                type="button" 
                onClick={() => setShowCounter(!showCounter)}
                className={`text-xs flex items-center gap-1.5 font-bold px-3 py-1.5 rounded-lg transition-all ${
                  showCounter 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600'
                }`}
              >
                <Calculator size={14} /> 
                {showCounter ? 'Fechar Contador' : 'Contar Dinheiro'}
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-400">€</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.,]/g, '');
                setAmount(value);
              }}
              placeholder="0,00"
              readOnly={showCounter}
              className={`w-full pl-12 pr-4 py-4 text-2xl font-black border-2 rounded-2xl focus:ring-4 outline-none transition-all ${
                showCounter 
                  ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' 
                  : 'bg-white border-slate-200 text-slate-900 focus:border-blue-500 focus:ring-blue-100'
              }`}
              required
            />
          </div>
        </div>

        {/* Contador de Numerário */}
        {showCounter && type === 'INCOME' && (
          <div className="p-5 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border border-slate-200 animate-in slide-in-from-top-2 duration-300 space-y-5">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-black text-slate-700 uppercase tracking-wider">Contador de Numerário</h4>
              <div className="text-lg font-black text-emerald-600 bg-white px-4 py-1 rounded-xl shadow-sm">
                {formatCurrency(calculateCashTotal())}
              </div>
            </div>
            
            <div>
              <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider flex items-center gap-2">
                <CreditCard size={14} /> Notas
              </h5>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {[500, 200, 100, 50, 20, 10, 5].map(note => (
                  <div key={note} className="flex flex-col gap-1">
                    <span className="text-[10px] text-center font-black text-slate-500 bg-white py-1 rounded-lg shadow-sm">€{note}</span>
                    <input 
                      type="number" 
                      min="0" 
                      className="w-full text-center p-2 text-sm font-bold bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                      value={cashCount.notes[note as keyof typeof cashCount.notes] || ''}
                      onChange={(e) => setCashCount(prev => ({...prev, notes: {...prev.notes, [note]: parseInt(e.target.value)||0}}))} 
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-400" /> Moedas
              </h5>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                {[2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01].map(coin => (
                  <div key={coin} className="flex flex-col gap-1">
                    <span className="text-[9px] text-center font-black text-slate-500 bg-white py-1 rounded-lg shadow-sm">
                      {coin >= 1 ? `€${coin}` : `${(coin * 100).toFixed(0)}c`}
                    </span>
                    <input 
                      type="number" 
                      min="0" 
                      className="w-full text-center p-2 text-sm font-bold bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                      value={cashCount.coins[coin as keyof typeof cashCount.coins] || ''}
                      onChange={(e) => setCashCount(prev => ({...prev, coins: {...prev.coins, [coin]: parseInt(e.target.value)||0}}))} 
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Descrição */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <FileText size={16} className="text-slate-400" />
            Descrição
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'INCOME' ? 'Ex: Oferta Culto de Domingo' : 'Ex: Pagamento de eletricidade'}
            className="w-full px-4 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 font-medium transition-all"
            required
          />
        </div>

        {/* Categoria e Fundo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Tag size={16} className="text-slate-400" />
              Categoria
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-4 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-medium transition-all appearance-none cursor-pointer"
            >
              {type === 'INCOME' ? (
                <>
                  <option value="DIZIMO">💰 Dízimo</option>
                  <option value="OFERTA">🙏 Oferta</option>
                  <option value="INFANTIL">👶 Infantil</option>
                  <option value="OUTROS">📦 Outros</option>
                </>
              ) : (
                <>
                  <option value="RENDA">🏠 Pagamento de Renda</option>
                  <option value="CONTA">💡 Contas Fixas (Água/Luz)</option>
                  <option value="MANUTENCAO">🔧 Manutenção</option>
                  <option value="SOCIAL">❤️ Social</option>
                  <option value="OUTROS">📦 Outros</option>
                </>
              )}
            </select>
          </div>
          
          {type === 'EXPENSE' && category !== 'RENDA' ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Wallet size={16} className="text-slate-400" />
                Retirar do Fundo
              </label>
              <select
                value={targetFund}
                onChange={(e) => setTargetFund(e.target.value as FundType)}
                className="w-full px-4 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none font-medium transition-all appearance-none cursor-pointer"
              >
                {Object.entries(FUND_INFO).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
              </select>
            </div>
          ) : type === 'INCOME' ? (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Wallet size={16} className="text-slate-400" />
                Distribuição Automática
              </label>
              <div className="px-4 py-3.5 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                <div className="grid grid-cols-2 gap-2 text-xs font-bold">
                  <div className="flex justify-between text-slate-600">
                    <span>Renda:</span>
                    <span className="text-amber-600">{config.fundPercentages.ALUGUER}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Emergência:</span>
                    <span className="text-red-600">{config.fundPercentages.EMERGENCIA}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Água/Luz:</span>
                    <span className="text-blue-600">{config.fundPercentages.UTILIDADES}%</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Geral:</span>
                    <span className="text-emerald-600">{config.fundPercentages.GERAL}%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Receipt size={16} className="text-slate-400" />
                Referência da Fatura
              </label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="Ex: FAT-001"
                className="w-full px-4 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 font-medium transition-all"
              />
            </div>
          )}
        </div>

        {/* Fatura Ref para Saídas (quando não é renda) */}
        {type === 'EXPENSE' && category !== 'RENDA' && (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <Receipt size={16} className="text-slate-400" />
              Referência da Fatura (opcional)
            </label>
            <input
              type="text"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              placeholder="Ex: FAT-001, Recibo nº 123"
              className="w-full px-4 py-3.5 bg-white text-slate-900 border-2 border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 font-medium transition-all"
            />
          </div>
        )}

        {/* Aviso Pagamento Renda */}
        {type === 'EXPENSE' && category === 'RENDA' && (
          <div className="p-5 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border-2 border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
                <Home size={24} className="text-amber-600" />
              </div>
              <div>
                <h4 className="font-black text-amber-800">Pagamento de Renda</h4>
                <p className="text-sm text-amber-700">Valor configurado: {formatCurrency(config.rentAmount)}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-3 leading-relaxed">
              O valor será retirado da <strong>Reserva de Renda</strong> e automaticamente reposto a partir do <strong>Saldo Disponível</strong>.
            </p>
          </div>
        )}

        {/* Botão Submit */}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`w-full py-4 rounded-2xl font-black text-white text-lg transition-all transform active:scale-[0.98] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 ${
            type === 'INCOME' 
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-emerald-200' 
              : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-red-200'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              {type === 'INCOME' ? <ArrowDownCircle size={24} /> : <ArrowUpCircle size={24} />}
              {type === 'INCOME' ? 'Registrar Entrada' : 'Registrar Saída'}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
