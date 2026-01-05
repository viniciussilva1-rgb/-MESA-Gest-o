
import React, { useState, useEffect } from 'react';
import { Transaction, FundType, CashCount, SystemConfig } from '../types';
import { FUND_INFO } from '../constants';
import { PlusCircle, MinusCircle, Calculator, Receipt } from 'lucide-react';

interface Props {
  onAdd: (transaction: Transaction) => void;
  config: SystemConfig;
}

const TransactionForm: React.FC<Props> = ({ onAdd, config }) => {
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Transaction['category']>('DIZIMO');
  // Fix: changed 'OPERACIONAL' to a valid FundType 'ALUGUER'
  const [targetFund, setTargetFund] = useState<FundType>('ALUGUER');
  const [showCounter, setShowCounter] = useState(false);
  const [invoiceRef, setInvoiceRef] = useState('');
  
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0 || !description) return;

    // Fix: updated object keys to match the FundType definition
    let allocations: Record<FundType, number> = {
      ALUGUER: 0, EMERGENCIA: 0, UTILIDADES: 0, GERAL: 0
    };

    if (type === 'INCOME') {
      // Fix: Use dynamic percentages from system config using correct FundType keys
      allocations.ALUGUER = val * (config.fundPercentages.ALUGUER / 100);
      allocations.EMERGENCIA = val * (config.fundPercentages.EMERGENCIA / 100);
      allocations.UTILIDADES = val * (config.fundPercentages.UTILIDADES / 100);
      allocations.GERAL = val * (config.fundPercentages.GERAL / 100);
    } else {
      allocations[targetFund] = -val;
    }

    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      description,
      amount: val,
      type,
      category,
      fundAllocations: allocations,
      cashCount: showCounter ? cashCount : undefined,
      invoiceRef: type === 'EXPENSE' ? invoiceRef : undefined,
      hasAttachment: type === 'EXPENSE' && !!invoiceRef
    };

    onAdd(newTransaction);
    resetForm();
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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
      <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        {type === 'INCOME' ? <PlusCircle className="text-emerald-500" /> : <MinusCircle className="text-red-500" />}
        Nova Movimentação
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2 p-1 bg-slate-100 rounded-lg mb-4">
          <button
            type="button"
            onClick={() => setType('INCOME')}
            className={`flex-1 py-2 rounded-md transition-all ${type === 'INCOME' ? 'bg-white shadow-sm text-emerald-600 font-bold' : 'text-slate-500'}`}
          >
            Entrada
          </button>
          <button
            type="button"
            onClick={() => setType('EXPENSE')}
            className={`flex-1 py-2 rounded-md transition-all ${type === 'EXPENSE' ? 'bg-white shadow-sm text-red-600 font-bold' : 'text-slate-500'}`}
          >
            Saída
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Descrição</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Oferta Culto de Domingo"
              className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-400"
              required
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Valor (€)</label>
              {type === 'INCOME' && (
                <button 
                  type="button" 
                  onClick={() => setShowCounter(!showCounter)}
                  className={`text-xs flex items-center gap-1 font-semibold ${showCounter ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}
                >
                  <Calculator size={14} /> {showCounter ? 'Fechar Contador' : 'Contar Numerário'}
                </button>
              )}
            </div>
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              readOnly={showCounter}
              className={`w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 placeholder:text-slate-400 ${showCounter ? 'bg-slate-50 cursor-not-allowed' : 'bg-white'}`}
              required
            />
          </div>
        </div>

        {showCounter && type === 'INCOME' && (
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 animate-in slide-in-from-top-2 duration-300">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-wider">Notas</h4>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2 mb-4">
              {[500, 200, 100, 50, 20, 10, 5].map(note => (
                <div key={note} className="flex flex-col gap-1">
                  <span className="text-[9px] text-center font-bold text-slate-500">€{note}</span>
                  <input type="number" min="0" className="w-full text-center p-1.5 text-xs bg-white text-slate-900 border border-slate-200 rounded"
                    onChange={(e) => setCashCount(prev => ({...prev, notes: {...prev.notes, [note]: parseInt(e.target.value)||0}}))} />
                </div>
              ))}
            </div>
            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-wider">Moedas</h4>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {[2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01].map(coin => (
                <div key={coin} className="flex flex-col gap-1">
                   <span className="text-[9px] text-center font-bold text-slate-500">{coin >= 1 ? `€${coin}` : `${(coin * 100).toFixed(0)}c`}</span>
                   <input type="number" min="0" className="w-full text-center p-1.5 text-xs bg-white text-slate-900 border border-slate-200 rounded"
                    onChange={(e) => setCashCount(prev => ({...prev, coins: {...prev.coins, [coin]: parseInt(e.target.value)||0}}))} />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as any)}
              className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
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
                  <option value="CONTA">Contas Fixas</option>
                  <option value="MANUTENCAO">Manutenção</option>
                  <option value="SOCIAL">Social</option>
                  <option value="OUTROS">Outros</option>
                </>
              )}
            </select>
          </div>
          
          {type === 'EXPENSE' ? (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                {/* Fixed: removed typo '開' from Receipt component name */}
                <Receipt size={14} /> Fatura Ref
              </label>
              <input
                type="text"
                value={invoiceRef}
                onChange={(e) => setInvoiceRef(e.target.value)}
                placeholder="Ex: FAT-001"
                className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          ) : (
             <div className="flex flex-col justify-end">
              <label className="block text-sm font-medium text-slate-700 mb-1">Regras de Alocação</label>
               <div className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-dashed border-slate-200">
                 Divisão baseada nas configurações atuais de separação de fundos.
               </div>
            </div>
          )}
        </div>

        {type === 'EXPENSE' && (
           <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Fundo de Origem</label>
            <select
              value={targetFund}
              onChange={(e) => setTargetFund(e.target.value as FundType)}
              className="w-full px-4 py-2 bg-white text-slate-900 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {Object.entries(FUND_INFO).map(([key, info]) => (
                <option key={key} value={key}>{info.label}</option>
              ))}
            </select>
          </div>
        )}

        <button type="submit" className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 shadow-lg ${type === 'INCOME' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}>
          {type === 'INCOME' ? 'Registrar Entrada' : 'Registrar Gasto'}
        </button>
      </form>
    </div>
  );
};

export default TransactionForm;
