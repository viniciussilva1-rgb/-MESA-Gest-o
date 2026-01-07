
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Fluxo Financeiro Mensal</h3>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 500 }} />
              <Tooltip 
                formatter={(value: number) => formatEuro(value)}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 500 }}
                cursor={{ fill: '#f8fafc' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: 500, paddingTop: '10px' }} />
              <Bar dataKey="income" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Saídas" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Equilíbrio de Fundos</h3>
        <div className="h-[280px] w-full">
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="45%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                   formatter={(value: number) => formatEuro(value)}
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 500 }}
                />
                <Legend layout="horizontal" align="center" verticalAlign="bottom" wrapperStyle={{ paddingTop: '15px', fontSize: '11px', fontWeight: 500 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 font-medium text-sm">
              Aguardando primeiras entradas...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardCharts;
