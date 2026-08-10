'use client';
import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Scale, Calendar } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';

function monthBounds(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10) };
}

export default function FinanceOverview() {
  const { call } = useApi();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const { from, to } = monthBounds(0);

  const load = useCallback(() => {
    call(`/finances/summary?from=${from}&to=${to}`).then(setSummary).catch((e) => setError(e.message));
  }, [call, from, to]);

  useEffect(() => { load(); }, [load]);

  const net = summary ? summary.netProfit : 0;
  const netPositive = net >= 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Calendar size={13} />
        <span>{new Date(from).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500" /> Total Revenue</p>
          <p className="text-2xl font-bold mt-1">{summary ? inr(summary.totalRevenue) : '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 flex items-center gap-1"><TrendingDown size={12} className="text-rose-500" /> Total Expenses</p>
          <p className="text-2xl font-bold mt-1">{summary ? inr(summary.totalExpenses) : '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 flex items-center gap-1"><Scale size={12} className={netPositive ? 'text-emerald-500' : 'text-rose-500'} /> Net Profit / Loss</p>
          <p className={`text-2xl font-bold mt-1 ${netPositive ? 'text-emerald-600' : 'text-rose-600'}`}>{summary ? inr(summary.netProfit) : '—'}</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">Revenue by category</div>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(summary.byCategory.INCOME || {}).length === 0 && (
                  <tr><td className="px-4 py-4 text-center text-slate-400">No income recorded this month</td></tr>
                )}
                {Object.entries(summary.byCategory.INCOME || {}).map(([cat, v]) => (
                  <tr key={cat} className="border-t border-slate-100">
                    <td className="px-4 py-2 capitalize">{cat.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="px-4 py-2 text-right font-medium">{inr(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">Expenses by category</div>
            <table className="w-full text-sm">
              <tbody>
                {Object.entries(summary.byCategory.EXPENSE || {}).length === 0 && (
                  <tr><td className="px-4 py-4 text-center text-slate-400">No expenses recorded this month</td></tr>
                )}
                {Object.entries(summary.byCategory.EXPENSE || {}).map(([cat, v]) => (
                  <tr key={cat} className="border-t border-slate-100">
                    <td className="px-4 py-2 capitalize">{cat.replace(/_/g, ' ').toLowerCase()}</td>
                    <td className="px-4 py-2 text-right font-medium">{inr(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
