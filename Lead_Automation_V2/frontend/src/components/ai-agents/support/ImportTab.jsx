'use client';
import { useState } from 'react';
import { Sheet, AlertTriangle, Info } from 'lucide-react';
import { usePreviewSheet } from '@/lib/queries/sheets';

/**
 * Task 5/5 (Support Agent — Google Sheets import): paste a link, extract
 * and display the data. Preview-only by design — nothing here writes to
 * the CRM (see sheetsRoutes.js on the backend). A natural follow-up
 * ("import these rows as leads/contacts") is intentionally left as a
 * suggested next step rather than built here.
 */
export default function ImportTab() {
  const [url, setUrl] = useState('');
  const preview = usePreviewSheet();

  const submit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    preview.mutate(url.trim());
  };

  const result = preview.data;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5">
      <div className="flex items-center gap-2.5">
        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
          <Sheet size={15} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">Google Sheets Import</h4>
          <p className="text-[11px] text-slate-400">Paste a public sheet link to preview its rows — nothing is imported yet</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
          className="input-premium flex-1"
        />
        <button disabled={preview.isPending || !url.trim()} className="btn-violet whitespace-nowrap">
          {preview.isPending ? 'Fetching…' : 'Fetch'}
        </button>
      </form>

      <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
        <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500">
          Works with sheets shared as &quot;Anyone with the link can view.&quot; Rows are capped at 500 and
          nothing here writes to your CRM — this is preview only.
        </p>
      </div>

      {preview.isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{preview.error?.message || 'Failed to fetch that sheet.'}</p>
        </div>
      )}

      {result && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              {result.rowCount} row{result.rowCount === 1 ? '' : 's'} detected
            </p>
            {result.truncated && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                Showing first 500 rows
              </span>
            )}
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="table-premium">
              <thead>
                <tr>
                  {result.headers.map((h, i) => (
                    <th key={i}>{h || `Column ${i + 1}`}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="text-xs text-slate-600 max-w-[220px] truncate">{cell || '—'}</td>
                    ))}
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
