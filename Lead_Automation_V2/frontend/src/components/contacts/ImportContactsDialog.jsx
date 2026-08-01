'use client';
import { useRef, useState } from 'react';
import {
  Upload, X, Loader2, AlertTriangle, CheckCircle2, FileSpreadsheet,
  ArrowRight, Info, Table2,
} from 'lucide-react';
import { usePreviewContactImport, useRunContactImport } from '@/lib/queries/crm';

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
  error:   'text-red-700 bg-red-50 border-red-200',
  warning: 'text-amber-700 bg-amber-50 border-amber-200',
  info:    'text-slate-600 bg-slate-50 border-slate-200',
};

export default function ImportContactsDialog({ open, onClose }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [sheetName, setSheetName] = useState('');
  const [mapping, setMapping] = useState(null);
  const [defaultSource, setDefaultSource] = useState('');
  const [onDuplicate, setOnDuplicate] = useState('skip');
  const [result, setResult] = useState(null);

  const preview = usePreviewContactImport();
  const run = useRunContactImport();
  const data = preview.data;

  if (!open) return null;

  function reset() {
    setFile(null); setSheetName(''); setMapping(null);
    setDefaultSource(''); setResult(null);
    preview.reset(); run.reset();
    if (fileRef.current) fileRef.current.value = '';
  }

  function close() { reset(); onClose(); }

  async function pickFile(f) {
    if (!f) return;
    setFile(f);
    setResult(null);
    setMapping(null);
    const res = await preview.mutateAsync({ file: f }).catch(() => null);
    if (res) {
      setSheetName(res.selectedSheet);
      setMapping(res.mapping);
    }
  }

  // Re-run the dry run whenever the user changes the sheet or a column's target.
  async function repreview(next = {}) {
    if (!file) return;
    const body = {
      file,
      sheetName: next.sheetName ?? sheetName,
      mapping: next.mapping ?? mapping,
      defaultSource: next.defaultSource ?? defaultSource,
    };
    const res = await preview.mutateAsync(body).catch(() => null);
    if (res) {
      setSheetName(res.selectedSheet);
      // the server echoes the mapping it actually used
      setMapping(res.mapping);
    }
  }

  async function commit() {
    const res = await run.mutateAsync({
      file, sheetName, mapping, defaultSource, onDuplicate,
    }).catch(() => null);
    if (res) setResult(res);
  }

  const stats = data?.stats;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-violet-600" />
            <p className="text-base font-bold text-slate-900">Import contacts</p>
          </div>
          <button type="button" onClick={close} aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* ── done ── */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Import finished</p>
                  <p className="mt-0.5 text-xs text-emerald-700">
                    {result.filename} · sheet “{result.sheet?.trim()}”
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: 'Inserted', value: result.inserted, tone: 'text-emerald-600' },
                  { label: 'Updated', value: result.updated, tone: 'text-violet-600' },
                  { label: 'Skipped', value: result.skipped, tone: 'text-slate-500' },
                  { label: 'Failed', value: result.failed, tone: result.failed ? 'text-red-600' : 'text-slate-400' },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
                    <p className={`text-2xl font-black tabular-nums ${s.tone}`}>{s.value}</p>
                    <p className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                  </div>
                ))}
              </div>

              <IssueList issues={result.issues} />
            </div>
          ) : (
            <>
              {/* ── step 1: file ── */}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">1 · Choose a file</p>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-5 transition-colors hover:border-violet-300 hover:bg-violet-50/50">
                  <Upload className="h-5 w-5 shrink-0 text-slate-400" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">
                      {file ? file.name : 'Click to select a .csv, .xlsx, or .xls file'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {file ? `${(file.size / 1024).toFixed(0)} KB` : 'Up to 10 MB · 20,000 rows per import'}
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={(e) => pickFile(e.target.files?.[0])}
                  />
                </label>
              </div>

              {preview.isPending && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Reading the file…
                </p>
              )}
              {preview.error && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-xs text-red-700">{preview.error.message}</p>
                </div>
              )}

              {data && (
                <>
                  {/* ── step 2: sheet ── */}
                  {data.sheets.length > 1 && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">2 · Which sheet</p>
                      <div className="flex flex-wrap gap-2">
                        {data.sheets.map((s) => {
                          const active = s.sheetName === sheetName;
                          const empty = !s.rowCount;
                          return (
                            <button
                              key={s.sheetName}
                              type="button"
                              disabled={empty || preview.isPending}
                              onClick={() => repreview({ sheetName: s.sheetName, mapping: null })}
                              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-40 ${
                                active
                                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50/50'
                              }`}
                            >
                              <Table2 className="h-3 w-3" />
                              {s.sheetName.trim() || '(unnamed)'}
                              <span className="text-slate-400">{s.rowCount}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── step 3: mapping ── */}
                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                      {data.sheets.length > 1 ? '3' : '2'} · Map columns
                    </p>
                    <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Column in file</th>
                            <th className="px-3 py-2">Sample</th>
                            <th className="px-3 py-2 w-40">Import as</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {data.headers.map((h, i) => {
                            const sheet = data.sheets.find((s) => s.sheetName === data.selectedSheet);
                            const sample = sheet?.sampleRows?.[0]?.[i] ?? '';
                            return (
                              <tr key={`${h}-${i}`} className="bg-white">
                                <td className="px-3 py-1.5 font-semibold text-slate-700">{h || `Column ${i + 1}`}</td>
                                <td className="max-w-[180px] truncate px-3 py-1.5 text-slate-400">{sample}</td>
                                <td className="px-3 py-1.5">
                                  <select
                                    value={mapping?.[i] ?? ''}
                                    onChange={(e) => {
                                      const next = { ...(mapping || {}) };
                                      if (e.target.value) next[i] = e.target.value;
                                      else delete next[i];
                                      setMapping(next);
                                      repreview({ mapping: next });
                                    }}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:border-violet-400"
                                  >
                                    {FIELD_OPTIONS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-slate-400">
                      <Info className="mt-px h-3 w-3 shrink-0" />
                      Unmapped columns are kept on the contact as notes, so nothing in the file is lost.
                    </p>
                  </div>

                  {/* ── options ── */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Default source <span className="font-medium normal-case text-slate-400">— if the file has none</span>
                      </label>
                      <input
                        value={defaultSource}
                        onChange={(e) => setDefaultSource(e.target.value)}
                        onBlur={() => repreview()}
                        placeholder="e.g. JustDial, Workshop"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-400 focus:ring focus:ring-violet-100"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        Existing contacts
                      </label>
                      <select
                        value={onDuplicate}
                        onChange={(e) => setOnDuplicate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-violet-400"
                      >
                        <option value="skip">Skip duplicates</option>
                        <option value="update">Update with file values</option>
                      </select>
                    </div>
                  </div>

                  {/* ── what will happen ── */}
                  {stats && (
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                        What will happen
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { label: 'Rows read', value: stats.total },
                          { label: 'Will insert', value: stats.willInsert, tone: 'text-emerald-600' },
                          { label: 'Dupes in file', value: stats.duplicatesInFile },
                          { label: 'Already in CRM', value: stats.alreadyInDatabase },
                        ].map((s) => (
                          <div key={s.label} className="rounded-xl border border-slate-200 bg-white p-2.5 text-center">
                            <p className={`text-lg font-black tabular-nums ${s.tone || 'text-slate-800'}`}>{s.value}</p>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{s.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <IssueList issues={data.issues} />

                  {run.error && (
                    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                      <p className="text-xs text-red-700">{run.error.message}</p>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5">
          <p className="text-[11px] text-slate-400">
            {data && !result ? `${data.filename} · sheet “${sheetName.trim()}”` : ''}
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={close}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">
              {result ? 'Done' : 'Cancel'}
            </button>
            {!result && (
              <button
                type="button"
                onClick={commit}
                disabled={!data || run.isPending || preview.isPending || !stats?.valid}
                className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-violet-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              >
                {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {run.isPending ? 'Importing…' : `Import ${stats?.willInsert ?? 0} contacts`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueList({ issues }) {
  const [expanded, setExpanded] = useState(false);
  if (!issues?.length) return null;

  const shown = expanded ? issues : issues.slice(0, 5);
  const counts = issues.reduce((acc, i) => { acc[i.level] = (acc[i.level] || 0) + 1; return acc; }, {});

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Row notes</p>
        {Object.entries(counts).map(([lvl, n]) => (
          <span key={lvl} className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${ISSUE_TONE[lvl] || ISSUE_TONE.info}`}>
            {n} {lvl}
          </span>
        ))}
      </div>
      <div className="space-y-1">
        {shown.map((i, idx) => (
          <div key={idx} className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${ISSUE_TONE[i.level] || ISSUE_TONE.info}`}>
            <span className="font-bold">Row {i.rowNumber}</span>
            {i.field ? <span className="opacity-70"> · {i.field}</span> : null}
            {' — '}{i.message}
          </div>
        ))}
      </div>
      {issues.length > 5 && (
        <button type="button" onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-[11px] font-bold text-violet-600 hover:underline">
          {expanded ? 'Show fewer' : `Show all ${issues.length}`}
        </button>
      )}
    </div>
  );
}
