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
      console.log('TransactionForm: Chamando onAdd com:', newTransaction);
      await onAdd(newTransaction);
      console.log('TransactionForm: onAdd executado com sucesso');
      
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
        console.log('TransactionForm: Criando reposição automática');
        await onAdd(repoTransaction);
      }
      
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
      resetForm();
    } catch (error: any) {
      console.error('TransactionForm: Erro ao salvar:', error);
      // Não mostra alerta aqui pois o App.tsx já mostra
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
    <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden h-full">
      {/* Header */}
      <div className={`px-5 py-4 ${type === 'INCOME' ? 'bg-emerald-600' : 'bg-red-600'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              {type === 'INCOME' ? <ArrowDownCircle size={22} className="text-white" /> : <ArrowUpCircle size={22} className="text-white" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Nova Movimentação</h2>
              <p className="text-white/80 text-xs">{type === 'INCOME' ? 'Registrar entrada' : 'Registrar saída'}</p>
            </div>
          </div>
          {showSuccess && (
            <div className="flex items-center gap-2 bg-white/20 px-3 py-1.5 rounded-lg">
              <CheckCircle size={16} className="text-white" />
              <span className="text-white font-bold text-xs">Salvo!</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Tipo de Movimentação */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={`relative flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
              type === 'INCOME' 
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <PlusCircle size={18} />
            <span>Entrada</span>
          </button>
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={`relative flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all border-2 ${
              type === 'EXPENSE' 
                ? 'bg-red-50 border-red-500 text-red-700' 
                : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
            }`}
          >
            <MinusCircle size={18} />
            <span>Saída</span>
          </button>
        </div>

        {/* Valor */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">Valor</label>
            {type === 'INCOME' && (
              <button 
                type="button" 
                onClick={() => setShowCounter(!showCounter)}
                className={`text-xs flex items-center gap-1 font-semibold px-2 py-1 rounded-lg transition-all ${
                  showCounter 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-slate-100 text-slate-600 hover:bg-blue-50'
                }`}
              >
                <Calculator size={12} /> 
                {showCounter ? 'Fechar' : 'Contar'}
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">€</span>
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
              className={`w-full pl-10 pr-4 py-3 text-xl font-bold border-2 rounded-xl focus:ring-2 outline-none transition-all ${
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
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-700">Contador de Numerário</h4>
              <div className="text-base font-bold text-emerald-600 bg-white px-3 py-1 rounded-lg">
                {formatCurrency(calculateCashTotal())}
              </div>
            </div>
            
            <div>
              <h5 className="text-xs font-semibold text-slate-500 mb-2">Notas</h5>
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
                {[500, 200, 100, 50, 20, 10, 5].map(note => (
                  <div key={note} className="flex flex-col gap-1">
                    <span className="text-[9px] text-center font-bold text-slate-500 bg-white py-0.5 rounded">€{note}</span>
                    <input 
                      type="number" 
                      min="0" 
                      className="w-full text-center p-1.5 text-sm font-bold bg-white text-slate-900 border border-slate-200 rounded-lg focus:border-blue-500 outline-none"
                      value={cashCount.notes[note as keyof typeof cashCount.notes] || ''}
                      onChange={(e) => setCashCount(prev => ({...prev, notes: {...prev.notes, [note]: parseInt(e.target.value)||0}}))} 
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h5 className="text-xs font-semibold text-slate-500 mb-2">Moedas</h5>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                {[2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01].map(coin => (
                  <div key={coin} className="flex flex-col gap-1">
                    <span className="text-[8px] text-center font-bold text-slate-500 bg-white py-0.5 rounded">
                      {coin >= 1 ? `€${coin}` : `${(coin * 100).toFixed(0)}c`}
                    </span>
                    <input 
                      type="number" 
                      min="0" 
                      className="w-full text-center p-1.5 text-sm font-bold bg-white text-slate-900 border border-slate-200 rounded-lg focus:border-blue-500 outline-none"
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
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">Descrição</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={type === 'INCOME' ? 'Ex: Oferta Culto de Domingo' : 'Ex: Pagamento de eletricidade'}
            className="w-full px-3 py-2.5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 text-sm transition-all"
            required
          />
        </div>

        {/* Categoria e Fundo */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm transition-all appearance-none cursor-pointer"
            >
              {type === 'INCOME' ? (
                <>
                  <option value="DIZIMO">Dízimo</option>
                  <option value="OFERTA">Oferta</option>
                  <option value="INFANTIL">Infantil</option>
                  <option value="OUTROS">Outros</option>
                </>
              ) : (
                <>
                  <option value="RENDA">Pagamento de Renda</option>
                  <option value="CONTA">Contas Fixas (Água/Luz)</option>
                  <option value="MANUTENCAO">Manutenção</option>
                  <option value="SOCIAL">Social</option>
                  <option value="OUTROS">Outros</option>
                </>
              )}
            </select>
          </div>
          
          {type === 'EXPENSE' && category !== 'RENDA' ? (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Retirar do Fundo</label>
              <select
                value={targetFund}
                onChange={(e) => setTargetFund(e.target.value as FundType)}
                className="w-full px-3 py-2.5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none text-sm transition-all appearance-none cursor-pointer"
              >
                {Object.entries(FUND_INFO).map(([key, info]) => (
                  <option key={key} value={key}>{info.label}</option>
                ))}
              </select>
            </div>
          ) : type === 'INCOME' ? (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Distribuição Automática</label>
              <div className="px-3 py-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Renda</span>
                    <span className="font-bold text-amber-600">{config.fundPercentages.ALUGUER}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Emergência</span>
                    <span className="font-bold text-red-600">{config.fundPercentages.EMERGENCIA}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Água/Luz</span>
                    <span className="font-bold text-blue-600">{config.fundPercentages.UTILIDADES}%</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Geral</span>
                    <span className="font-bold text-emerald-600">{config.fundPercentages.GERAL}%</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">Referência da Fatura</label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="Ex: FAT-001"
                className="w-full px-3 py-2.5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 text-sm transition-all"
              />
            </div>
          )}
        </div>

        {/* Fatura Ref para Saídas (quando não é renda) */}
        {type === 'EXPENSE' && category !== 'RENDA' && (
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">Referência da Fatura (opcional)</label>
            <input
              type="text"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              placeholder="Ex: FAT-001, Recibo nº 123"
              className="w-full px-3 py-2.5 bg-white text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-500 outline-none placeholder:text-slate-400 text-sm transition-all"
            />
          </div>
        )}

        {/* Aviso Pagamento Renda */}
        {type === 'EXPENSE' && category === 'RENDA' && (
          <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Home size={20} className="text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-amber-800 text-sm">Pagamento de Renda</h4>
                <p className="text-xs text-amber-700">Valor configurado: {formatCurrency(config.rentAmount)}</p>
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-2">
              Será retirado da <strong>Reserva de Renda</strong> e reposto do <strong>Saldo Disponível</strong>.
            </p>
          </div>
        )}

        {/* Botão Submit */}
        <button 
          type="submit" 
          disabled={isSubmitting}
          className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
            type === 'INCOME' 
              ? 'bg-emerald-600 hover:bg-emerald-700' 
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              {type === 'INCOME' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
              {type === 'INCOME' ? 'Registrar Entrada' : 'Registrar Saída'}
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
