'use client';
import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';

const CATEGORIES = ['SALARY', 'UTILITIES', 'TAXES', 'VENDOR', 'SOFTWARE', 'RENT', 'OTHER'];
const PAYMENT_METHODS = ['bank_transfer', 'upi', 'cash', 'card', 'cheque', 'other'];

export default function ExpensesOutgoings() {
  const { call } = useApi();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    category: 'VENDOR', amount: '', paymentMethod: 'bank_transfer',
    description: '', referenceId: '', tdsNotes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    call('/finances/transactions?type=EXPENSE&pageSize=100').then((r) => setRows(r.rows)).catch((e) => setError(e.message));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      await call('/finances/transactions', {
        method: 'POST',
        body: {
          type: 'EXPENSE',
          category: form.category,
          amount: Number(form.amount),
          paymentMethod: form.paymentMethod,
          description: form.description || undefined,
          referenceId: form.referenceId || undefined,
          tdsNotes: form.tdsNotes || undefined,
        },
      });
      setForm({ category: 'VENDOR', amount: '', paymentMethod: 'bank_transfer', description: '', referenceId: '', tdsNotes: '' });
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <p className="text-sm font-semibold">Log an expense</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-500">Category</label>
            <select value={form.category} onChange={set('category')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Amount (₹)</label>
            <input type="number" value={form.amount} onChange={set('amount')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Payment Method</label>
            <select value={form.paymentMethod} onChange={set('paymentMethod')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500">Reference / Bill No.</label>
            <input value={form.referenceId} onChange={set('referenceId')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">Description (e.g. "BESCOM electricity bill — August")</label>
          <input value={form.description} onChange={set('description')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-500">TDS / tax note (optional)</label>
          <input value={form.tdsNotes} onChange={set('tdsNotes')} placeholder="e.g. TDS 10% u/s 194J deducted" className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        </div>
        <button
          onClick={submit}
          disabled={submitting || !form.amount}
          className="flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          <Plus size={15} /> {submitting ? 'Saving…' : 'Log Expense'}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">Expenses & Outgoings</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Date</th>
              <th className="text-left px-4 py-2">Category</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-left px-4 py-2">Method</th>
              <th className="text-right px-4 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No expenses logged yet</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2">{new Date(r.transaction_date).toLocaleDateString('en-IN')}</td>
                <td className="px-4 py-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">{r.category}</span>
                  {r.source === 'ai_agent' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600 ml-1">AI Agent</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.description || '—'}</td>
                <td className="px-4 py-2 capitalize text-slate-500">{(r.payment_method || '—').replace('_', ' ')}</td>
                <td className="px-4 py-2 text-right font-medium">{inr(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
