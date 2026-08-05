'use client';
import { useCallback, useEffect, useState } from 'react';
import { FileText, ChevronRight } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';

const TYPE_BADGE = {
  saas_channel_fee: 'bg-brand/10 text-brand',
  meta_passthrough: 'bg-blue-50 text-blue-700',
  sms_passthrough: 'bg-teal-50 text-teal-700',
  bsp_markup: 'bg-slate-100 text-slate-600',
  other: 'bg-slate-100 text-slate-600',
};

export default function InvoiceView() {
  const { call } = useApi();
  const [invoices, setInvoices] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    call('/billing/invoices').then(setInvoices).catch((e) => setError(e.message));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const openInvoice = (id) => {
    call(`/billing/invoices/${id}`).then(setSelected).catch((e) => setError(e.message));
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-600">{error}</p>}

      {!selected && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">Invoices</div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Period</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No invoices yet</td></tr>
              )}
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-slate-100 cursor-pointer hover:bg-slate-50" onClick={() => openInvoice(inv.id)}>
                  <td className="px-4 py-2">{inv.billing_period_start} – {inv.billing_period_end}</td>
                  <td className="px-4 py-2 capitalize">{inv.status}</td>
                  <td className="px-4 py-2 text-right font-medium">{inr(inv.amount)}</td>
                  <td className="px-4 py-2 text-right"><ChevronRight size={14} className="inline text-slate-400" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <FileText size={15} /> Invoice — {selected.billing_period_start} to {selected.billing_period_end}
            </span>
            <button onClick={() => setSelected(null)} className="text-xs text-slate-500 underline">Back to list</button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Line item</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-right px-4 py-2">Qty</th>
                <th className="text-right px-4 py-2">Unit</th>
                <th className="text-right px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {selected.line_items.map((li) => (
                <tr key={li.id} className="border-t border-slate-100">
                  <td className="px-4 py-2">
                    <span className={`text-xs rounded px-1.5 py-0.5 mr-2 ${TYPE_BADGE[li.type] || TYPE_BADGE.other}`}>{li.label}</span>
                    {li.description}
                  </td>
                  <td className="px-4 py-2 capitalize">{li.channel_type || '—'}</td>
                  <td className="px-4 py-2 text-right">{li.quantity}</td>
                  <td className="px-4 py-2 text-right">{inr(li.unit_amount)}</td>
                  <td className="px-4 py-2 text-right font-medium">{inr(li.total_amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200">
                <td colSpan={4} className="px-4 py-3 text-right font-semibold">Total</td>
                <td className="px-4 py-3 text-right font-bold">{inr(selected.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
