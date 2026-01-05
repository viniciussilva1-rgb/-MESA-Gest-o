
import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { FinancialStats } from '../types';
import { FUND_INFO } from '../constants';

interface Props {
  stats: FinancialStats;
  history: { name: string; income: number; expense: number }[];
}

const DashboardCharts: React.FC<Props> = ({ stats, history }) => {
  // Mapeamento seguro: se a chave não existir no FUND_INFO (devido a dados antigos), o gráfico ignora ou usa valores padrão
  const pieData = Object.entries(stats.fundBalances)
    .map(([key, value]) => {
      const info = FUND_INFO[key as keyof typeof FUND_INFO];
      if (!info) return null;
      return {
        name: info.label,
        value: value as number,
        color: info.color,
      };
    })
    .filter((item): item is { name: string; value: number; color: string } => 
      item !== null && (item.value as number) > 0 && !isNaN(item.value as number)
    );

  const formatEuro = (value: number) => {
    return `€${value.toLocaleString('pt-PT', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Fluxo Financeiro Mensal</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 'bold' }} />
              <Tooltip 
                formatter={(value: number) => formatEuro(value)}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase', paddingTop: '10px' }} />
              <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-6">Equilíbrio de Fundos</h3>
        <div className="h-[300px] w-full">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   formatter={(value: number) => formatEuro(value)}
                   contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 font-bold italic text-xs uppercase tracking-widest">
              Aguardando primeiras entradas...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardCharts;
