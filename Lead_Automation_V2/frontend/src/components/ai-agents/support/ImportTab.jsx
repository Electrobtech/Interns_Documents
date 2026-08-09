'use client';
import { useState } from 'react';
import {
  Sheet, AlertTriangle, Info, CheckCircle2, Loader2, RotateCcw, ArrowRight,
} from 'lucide-react';
import { usePreviewSheet, useImportSheet } from '@/lib/queries/sheets';

/**
 * Support Agent — Google Sheets import. Paste a link (public, or private +
 * shared with the configured service account), review/adjust the suggested
 * contacts mapping, then commit — writes into the CRM through the same
 * mapping/dedupe pipeline as the CSV/XLSX importer
 * (services/contact-service/src/sheetsRoutes.js + contactWriter.js).
 */

/* Fields an import can populate. Mirrors TARGET_FIELDS in
   services/contact-service/src/importer.js. */
const FIELD_OPTIONS = [
  { value: '', label: '— keep as note —' },
  { value: 'name', label: 'Name' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'source', label: 'Source' },
  { value: 'notes', label: 'Notes' },
];

const ISSUE_TONE = {
  error: 'text-red-700 bg-red-50 border-red-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  info: 'text-slate-600 bg-slate-50 border-slate-200',
};

/** mapping comes back from the server as { "<colIndex>": "field" } */
function mappingToFieldByIndex(mapping, headerCount) {
  const out = Array(headerCount).fill('');
  Object.entries(mapping || {}).forEach(([idx, field]) => {
    out[Number(idx)] = field;
  });
  return out;
}

function fieldByIndexToMapping(fieldByIndex) {
  const mapping = {};
  fieldByIndex.forEach((field, idx) => {
    if (field) mapping[idx] = field;
  });
  return mapping;
}

export default function ImportTab() {
  const [url, setUrl] = useState('');
  const [fieldByIndex, setFieldByIndex] = useState(null); // string[] aligned to headers
  const [defaultSource, setDefaultSource] = useState('');
  const [onDuplicate, setOnDuplicate] = useState('skip');
  const [result, setResult] = useState(null);

  const preview = usePreviewSheet();
  const runImport = useImportSheet();
  const data = preview.data;

  function reset() {
    setUrl(''); setFieldByIndex(null); setDefaultSource(''); setResult(null);
    preview.reset(); runImport.reset();
  }

  async function fetchSheet(e) {
    e.preventDefault();
    if (!url.trim()) return;
    setResult(null);
    const res = await preview.mutateAsync({ url: url.trim() }).catch(() => null);
    if (res) setFieldByIndex(mappingToFieldByIndex(res.mapping, res.headers.length));
  }

  // Re-run the dry run whenever the mapping or default source changes.
  async function repreview(nextFieldByIndex, nextDefaultSource) {
    const mapping = fieldByIndexToMapping(nextFieldByIndex ?? fieldByIndex);
    const res = await preview.mutateAsync({
      url: url.trim(),
      mapping,
      defaultSource: nextDefaultSource ?? defaultSource,
    }).catch(() => null);
    if (res) setFieldByIndex(mappingToFieldByIndex(res.mapping, res.headers.length));
  }

  function setField(idx, field) {
    const next = fieldByIndex.slice();
    next[idx] = field;
    setFieldByIndex(next);
    repreview(next, defaultSource);
  }

  async function commit() {
    const res = await runImport.mutateAsync({
      url: url.trim(),
      mapping: fieldByIndexToMapping(fieldByIndex),
      defaultSource: defaultSource || null,
      onDuplicate,
    }).catch(() => null);
    if (res) setResult(res);
  }

  const stats = data?.stats;
  const notMappedYet = !fieldByIndex;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <Sheet size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Google Sheets Import</h4>
            <p className="text-[11px] text-slate-400">Paste a sheet link, map columns, import into contacts/leads</p>
          </div>
        </div>
        {(data || result) && (
          <button onClick={reset} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600">
            <RotateCcw size={12} /> Start over
          </button>
        )}
      </div>

      {/* ── done ── */}
      {result ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Import finished</p>
              <p className="mt-0.5 text-xs text-emerald-700">Sheet &quot;{result.sheet}&quot;</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Inserted', result.inserted, 'text-emerald-600'],
              ['Updated', result.updated, 'text-sky-600'],
              ['Skipped', result.skipped, 'text-slate-500'],
              ['Failed', result.failed, 'text-red-600'],
            ].map(([label, val, cls]) => (
              <div key={label} className="rounded-xl border border-slate-100 px-3 py-2.5 text-center">
                <p className={`text-xl font-bold ${cls}`}>{val}</p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
              </div>
            ))}
          </div>
          {result.issues?.length > 0 && (
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {result.issues.map((iss, i) => (
                <div key={i} className={`rounded-lg border px-3 py-1.5 text-[11px] ${ISSUE_TONE[iss.level] || ISSUE_TONE.info}`}>
                  {iss.rowNumber != null && <span className="font-semibold">Row {iss.rowNumber}: </span>}
                  {iss.message}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── url input ── */}
          <form onSubmit={fetchSheet} className="flex items-center gap-2">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
              className="input-premium flex-1"
            />
            <button disabled={preview.isPending || !url.trim()} className="btn-violet whitespace-nowrap flex items-center gap-1.5">
              {preview.isPending ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
              {preview.isPending ? 'Fetching…' : 'Fetch'}
            </button>
          </form>

          <div className="flex items-start gap-2 px-3 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
            <Info size={13} className="text-slate-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500">
              Works with any sheet shared as &quot;Anyone with the link can view.&quot; For private sheets,
              share it with the configured service account{data?.serviceAccountEmail ? ` (${data.serviceAccountEmail})` : ''}.
              Sheets larger than 20,000 rows aren&apos;t supported yet.
            </p>
          </div>

          {preview.isError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={14} className="text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{preview.error?.message || 'Failed to fetch that sheet.'}</p>
            </div>
          )}

          {/* ── mapping + stats ── */}
          {data && fieldByIndex && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  &quot;{data.sheetTitle}&quot; · {data.rowCount} row{data.rowCount === 1 ? '' : 's'}
                </p>
                {data.truncated && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                    Preview capped at 500 rows — all {data.rowCount} would still be imported
                  </span>
                )}
              </div>

              {/* Column mapping */}
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="table-premium">
                  <thead>
                    <tr>
                      {data.headers.map((h, i) => (
                        <th key={i} className="min-w-[140px]">
                          <div className="space-y-1">
                            <p className="truncate">{h || `Column ${i + 1}`}</p>
                            <select
                              value={fieldByIndex[i] || ''}
                              onChange={(e) => setField(i, e.target.value)}
                              className="w-full rounded-lg border border-slate-200 px-1.5 py-1 text-[11px] font-normal"
                            >
                              {FIELD_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rawPreviewRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j} className="text-xs text-slate-600 max-w-[220px] truncate">{cell || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import options */}
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  Default source
                  <input
                    value={defaultSource}
                    onChange={(e) => { setDefaultSource(e.target.value); }}
                    onBlur={() => repreview(fieldByIndex, defaultSource)}
                    placeholder="e.g. google-sheets-import"
                    className="input-premium py-1 px-2 text-xs w-44"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  On duplicate
                  <select
                    value={onDuplicate}
                    onChange={(e) => setOnDuplicate(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
                  >
                    <option value="skip">Skip</option>
                    <option value="update">Update existing</option>
                  </select>
                </label>
              </div>

              {/* Stats */}
              {stats && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Will insert', stats.willInsert, 'text-emerald-600'],
                    ['Already in CRM', stats.alreadyInDatabase, 'text-sky-600'],
                    ['Duplicates in sheet', stats.duplicatesInFile, 'text-slate-500'],
                    ['Skipped rows', stats.skipped, 'text-red-500'],
                  ].map(([label, val, cls]) => (
                    <div key={label} className="rounded-xl border border-slate-100 px-3 py-2.5 text-center">
                      <p className={`text-xl font-bold ${cls}`}>{val ?? 0}</p>
                      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {data.issues?.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {data.issues.slice(0, 20).map((iss, i) => (
                    <div key={i} className={`rounded-lg border px-3 py-1.5 text-[11px] ${ISSUE_TONE[iss.level] || ISSUE_TONE.info}`}>
                      {iss.rowNumber != null && <span className="font-semibold">Row {iss.rowNumber}: </span>}
                      {iss.message}
                    </div>
                  ))}
                </div>
              )}

              {runImport.isError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-sm text-red-600">{runImport.error?.message || 'Import failed.'}</p>
                </div>
              )}

              <button
                onClick={commit}
                disabled={runImport.isPending || notMappedYet || !stats?.willInsert}
                className="btn-violet w-full flex items-center justify-center gap-1.5"
              >
                {runImport.isPending ? <Loader2 size={13} className="animate-spin" /> : null}
                {runImport.isPending ? 'Importing…' : `Import ${stats?.willInsert ?? 0} contact${stats?.willInsert === 1 ? '' : 's'}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
