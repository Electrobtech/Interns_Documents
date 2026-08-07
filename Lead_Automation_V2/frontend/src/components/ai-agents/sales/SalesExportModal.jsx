'use client';
import { useEffect, useState } from 'react';
import { Download, X, AlertTriangle } from 'lucide-react';
import { useExportSalesData } from '@/lib/queries/aiAgents';

// Flattens the export payload's leads array into CSV. Only primitive
// (string/number/bool) columns — nested objects would need their own
// column-splitting policy this button doesn't need to decide.
function toCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => {
        if (row[k] === null || typeof row[k] !== 'object') set.add(k);
      });
      return set;
    }, new Set())
  );
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => escape(row[c])).join(',')));
  return lines.join('\n');
}

function download(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Header's "Export" button — generates the payload server-side
// (GET /ai-agents/sales/export) and formats it into a download client-side,
// so the backend stays a plain JSON API rather than needing to own two
// content-type branches.
export default function SalesExportModal({ onClose }) {
  const exportData = useExportSalesData();
  const [err, setErr] = useState('');

  useEffect(() => {
    exportData.mutate(undefined, { onError: (ex) => setErr(ex.message || 'Export failed') });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const payload = exportData.data;

  const handleDownload = (format) => {
    if (!payload) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'json') {
      download(`sales-export-${stamp}.json`, JSON.stringify(payload, null, 2), 'application/json');
    } else {
      download(`sales-export-${stamp}.csv`, toCsv(payload.leads), 'text/csv');
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-card-lg w-full max-w-md border border-slate-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-600">
              <Download size={15} />
            </div>
            <h2 className="font-bold text-slate-800 text-sm">Export Sales Data</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {exportData.isPending && <p className="text-xs text-slate-400">Generating export…</p>}
          {err && <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle size={12} /> {err}</p>}

          {payload && (
            <>
              <div className="text-xs text-slate-500 p-3 rounded-xl bg-slate-50 border border-[#E4E8F0]">
                {payload.summary.total_leads} lead(s)
                {payload.summary.deal_value_field
                  ? ` · pipeline value $${(payload.summary.total_pipeline_value ?? 0).toLocaleString()}`
                  : ' · no deal-value field mapped'}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleDownload('csv')}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium border border-[#E4E8F0] hover:bg-slate-50 transition-colors"
                >
                  Download CSV
                </button>
                <button
                  onClick={() => handleDownload('json')}
                  className="px-4 py-2.5 rounded-xl text-xs font-medium bg-slate-800 text-white hover:bg-slate-900 transition-colors"
                >
                  Download JSON
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
