'use client';
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';

const PURPOSE_LABEL = {
  WALLET_RECHARGE: 'Wallet Recharge',
  ECOMMERCE_ORDER: 'Product Order',
  WALKIN_SALE: 'Walk-in Sale',
};

const STATUS_STYLE = {
  paid: 'text-emerald-600 bg-emerald-50',
  created: 'text-slate-500 bg-slate-100',
  pending: 'text-amber-600 bg-amber-50',
  failed: 'text-red-600 bg-red-50',
  refunded: 'text-indigo-600 bg-indigo-50',
};

export default function PaymentHistory() {
  const { call } = useApi();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    const q = filter ? `?purpose=${filter}` : '';
    call(`/billing/payments${q}`).then(setRows).catch(() => {});
  }, [call, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['', 'WALLET_RECHARGE', 'ECOMMERCE_ORDER', 'WALKIN_SALE'].map((p) => (
          <button
            key={p || 'all'}
            onClick={() => setFilter(p)}
            className={`text-xs rounded-full px-3 py-1.5 border ${
              filter === p ? 'border-brand bg-brand/5 text-brand font-medium' : 'border-slate-300 text-slate-500'
            }`}
          >
            {p ? PURPOSE_LABEL[p] : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Method</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No payments yet</td></tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{PURPOSE_LABEL[p.purpose] || p.purpose}</td>
                <td className="px-4 py-2 text-slate-500 capitalize">{p.method || '—'}</td>
                <td className="px-4 py-2 text-right font-medium">{inr(p.amount)}</td>
                <td className="px-4 py-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[p.status] || 'text-slate-500 bg-slate-100'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-400">{new Date(p.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
