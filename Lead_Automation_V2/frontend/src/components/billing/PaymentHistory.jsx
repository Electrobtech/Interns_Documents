'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, FileText, Sheet, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';
import { exportPaymentHistoryCsv, exportPaymentHistoryPdf } from '@/lib/exportPaymentHistory';

const PURPOSE_LABEL = {
  WALLET_RECHARGE: 'Wallet Recharge',
  ECOMMERCE_ORDER: 'Product Order',
  WALKIN_SALE: 'Charge',
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
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const downloadRef = useRef(null);

  const load = useCallback(() => {
    const q = filter ? `?purpose=${filter}` : '';
    call(`/billing/payments${q}`).then(setRows).catch(() => {});
  }, [call, filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onClickOutside(e) {
      if (downloadRef.current && !downloadRef.current.contains(e.target)) setDownloadOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filterLabel = filter ? PURPOSE_LABEL[filter] : 'All';

  async function handleDownload(format) {
    setDownloadOpen(false);
    setExporting(true);
    try {
      if (format === 'csv') exportPaymentHistoryCsv(rows, filterLabel);
      else await exportPaymentHistoryPdf(rows, filterLabel);
    } catch (e) {
      console.error('[billing] payment history export failed', e);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2 flex-wrap">
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

        <div className="relative shrink-0" ref={downloadRef}>
          <button
            onClick={() => setDownloadOpen((v) => !v)}
            disabled={rows.length === 0 || exporting}
            className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 disabled:opacity-50 hover:bg-slate-50"
          >
            {exporting ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Download
          </button>
          {downloadOpen && (
            <div className="absolute right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-10">
              <button
                onClick={() => handleDownload('csv')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-600 hover:bg-slate-50"
              >
                <Sheet size={13} /> Download CSV
              </button>
              <button
                onClick={() => handleDownload('pdf')}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-slate-600 hover:bg-slate-50 border-t border-slate-100"
              >
                <FileText size={13} /> Download PDF
              </button>
            </div>
          )}
        </div>
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
