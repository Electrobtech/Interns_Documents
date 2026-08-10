'use client';
import { useEffect, useState } from 'react';
import {
  ArrowLeft, Plus, Trash2, Save, Loader2, AlertTriangle, CheckCircle2,
  Upload, Pencil, Check, X,
} from 'lucide-react';
import {
  useSpreadsheet, useUpdateSpreadsheet, useDeleteSpreadsheet, useImportSpreadsheet,
} from '@/lib/queries/spreadsheets';

/* Fields an import can populate. Mirrors TARGET_FIELDS in
   services/contact-service/src/importer.js (same list ImportTab.jsx uses). */
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

const MAX_VISIBLE_ROWS = 500; // grid stays editable/scrollable, not paginated, up to this many

export default function SpreadsheetEditor({ id, onBack }) {
  const { data, isLoading, isError, error } = useSpreadsheet(id);
  const update = useUpdateSpreadsheet();
  const del = useDeleteSpreadsheet();
  const runImport = useImportSpreadsheet();

  const [headers, setHeaders] = useState(null);
  const [rows, setRows] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [fieldByIndex, setFieldByIndex] = useState(null);
  const [defaultSource, setDefaultSource] = useState('');
  const [onDuplicate, setOnDuplicate] = useState('skip');
  const [importResult, setImportResult] = useState(null);

  // Seed local editable state from the server once, and again whenever a
  // fresh save's response replaces it — but never while the user has
  // unsaved edits in progress.
  useEffect(() => {
    if (!data || dirty) return;
    setHeaders(data.headers);
    setRows(data.rows);
    setNameDraft(data.name);
  }, [data, dirty]);

  if (isLoading || !headers) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-10 flex items-center justify-center gap-2 text-sm text-slate-400">
        <Loader2 size={14} className="animate-spin" /> Loading spreadsheet…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 mb-3">
          <ArrowLeft size={12} /> Back
        </button>
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error?.message || 'Could not load this spreadsheet.'}</p>
        </div>
      </div>
    );
  }

  function updateCell(r, c, value) {
    const next = rows.map((row) => row.slice());
    next[r][c] = value;
    setRows(next);
    setDirty(true);
  }

  function updateHeader(c, value) {
    const next = headers.slice();
    next[c] = value;
    setHeaders(next);
    setDirty(true);
  }

  function addRow() {
    setRows([...rows, headers.map(() => '')]);
    setDirty(true);
  }

  function deleteRow(r) {
    setRows(rows.filter((_, i) => i !== r));
    setDirty(true);
  }

  function addColumn() {
    setHeaders([...headers, `Column ${headers.length + 1}`]);
    setRows(rows.map((row) => [...row, '']));
    setDirty(true);
  }

  function deleteColumn(c) {
    setHeaders(headers.filter((_, i) => i !== c));
    setRows(rows.map((row) => row.filter((_, i) => i !== c)));
    if (fieldByIndex) setFieldByIndex(fieldByIndex.filter((_, i) => i !== c));
    setDirty(true);
  }

  async function save() {
    const res = await update.mutateAsync({ id, headers, rows }).catch(() => null);
    if (res) setDirty(false);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === data.name) { setEditingName(false); return; }
    await update.mutateAsync({ id, name: trimmed }).catch(() => null);
    setEditingName(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${data.name}"? This can't be undone.`)) return;
    await del.mutateAsync(id).catch(() => null);
    onBack();
  }

  function openImport() {
    setFieldByIndex(headers.map(() => ''));
    setImportResult(null);
    setShowImport(true);
  }

  function setField(idx, field) {
    const next = fieldByIndex.slice();
    next[idx] = field;
    setFieldByIndex(next);
  }

  async function commitImport() {
    const mapping = {};
    fieldByIndex.forEach((field, idx) => { if (field) mapping[idx] = field; });
    const res = await runImport.mutateAsync({
      id, mapping, defaultSource: defaultSource || null, onDuplicate,
    }).catch(() => null);
    if (res) setImportResult(res);
  }

  const visibleRows = rows.slice(0, MAX_VISIBLE_ROWS);
  const hiddenCount = rows.length - visibleRows.length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
      {/* header */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <button onClick={onBack} className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 mb-1.5">
            <ArrowLeft size={12} /> All spreadsheets
          </button>
          {editingName ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') { setNameDraft(data.name); setEditingName(false); } }}
                className="input-premium py-1 px-2 text-sm font-bold w-64"
              />
              <button onClick={saveName} className="text-emerald-600 hover:text-emerald-700"><Check size={16} /></button>
              <button onClick={() => { setNameDraft(data.name); setEditingName(false); }} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)} className="flex items-center gap-1.5 group">
              <h4 className="font-bold text-slate-800 text-sm truncate">{data.name}</h4>
              <Pencil size={11} className="text-slate-300 group-hover:text-slate-500 shrink-0" />
            </button>
          )}
          <p className="text-[11px] text-slate-400 mt-0.5">
            {headers.length} column{headers.length === 1 ? '' : 's'} · {rows.length} row{rows.length === 1 ? '' : 's'}
            {data.lastImportedAt && ` · last imported ${new Date(data.lastImportedAt).toLocaleDateString()}`}
            {dirty && <span className="text-amber-600 font-semibold"> · unsaved changes</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={handleDelete} disabled={del.isPending} className="btn-ghost btn-sm flex items-center gap-1 text-red-500 hover:text-red-600">
            <Trash2 size={12} /> Delete
          </button>
          <button onClick={save} disabled={!dirty || update.isPending} className="btn-violet btn-sm flex items-center gap-1.5">
            {update.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save
          </button>
          <button onClick={openImport} className="btn-primary btn-sm flex items-center gap-1.5">
            <Upload size={12} /> Import to CRM
          </button>
        </div>
      </div>

      {update.isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{update.error?.message || 'Save failed.'}</p>
        </div>
      )}

      {/* ── import panel ── */}
      {showImport && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h5 className="font-bold text-sm text-violet-900">Import to CRM</h5>
            <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
          </div>

          {dirty && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <p className="text-xs text-amber-800">You have unsaved edits — save them first, or importing will use the last saved version.</p>
            </div>
          )}

          {importResult ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <p className="text-sm font-bold text-emerald-900">Import finished</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  ['Inserted', importResult.inserted, 'text-emerald-600'],
                  ['Updated', importResult.updated, 'text-sky-600'],
                  ['Skipped', importResult.skipped, 'text-slate-500'],
                  ['Failed', importResult.failed, 'text-red-600'],
                ].map(([label, val, cls]) => (
                  <div key={label} className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 text-center">
                    <p className={`text-xl font-bold ${cls}`}>{val}</p>
                    <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
                  </div>
                ))}
              </div>
              {importResult.issues?.length > 0 && (
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {importResult.issues.slice(0, 20).map((iss, i) => (
                    <div key={i} className={`rounded-lg border px-3 py-1.5 text-[11px] ${ISSUE_TONE[iss.level] || ISSUE_TONE.info}`}>
                      {iss.rowNumber != null && <span className="font-semibold">Row {iss.rowNumber}: </span>}
                      {iss.message}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => setShowImport(false)} className="btn-ghost btn-sm">Close</button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">Map each column to a contact field, or leave it as a note.</p>
              <div className="flex flex-wrap gap-2">
                {headers.map((h, i) => (
                  <label key={i} className="flex flex-col gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1.5 min-w-[130px]">
                    <span className="text-[10px] font-semibold text-slate-500 truncate">{h || `Column ${i + 1}`}</span>
                    <select
                      value={fieldByIndex[i] || ''}
                      onChange={(e) => setField(i, e.target.value)}
                      className="text-[11px] border-0 p-0 bg-transparent focus:outline-none"
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  Default source
                  <input
                    value={defaultSource}
                    onChange={(e) => setDefaultSource(e.target.value)}
                    placeholder="e.g. spreadsheet-import"
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
              {runImport.isError && (
                <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg">
                  <AlertTriangle size={13} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{runImport.error?.message || 'Import failed.'}</p>
                </div>
              )}
              <button
                onClick={commitImport}
                disabled={runImport.isPending || !fieldByIndex.some(Boolean)}
                className="btn-violet w-full flex items-center justify-center gap-1.5"
              >
                {runImport.isPending ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {runImport.isPending ? 'Importing…' : 'Import into contacts/leads'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── editable grid ── */}
      <div className="overflow-auto rounded-xl border border-slate-100 max-h-[65vh]">
        <table className="text-xs border-collapse w-full">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="w-8 bg-slate-50 border-b border-r border-slate-100" />
              {headers.map((h, c) => (
                <th key={c} className="bg-slate-50 border-b border-r border-slate-100 p-0 min-w-[140px]">
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <input
                      value={h}
                      onChange={(e) => updateHeader(c, e.target.value)}
                      className="flex-1 min-w-0 bg-transparent font-semibold text-[11px] text-slate-600 px-1 py-1 rounded focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                    <button
                      onClick={() => deleteColumn(c)}
                      title="Delete column"
                      className="text-slate-300 hover:text-red-500 shrink-0"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </th>
              ))}
              <th className="bg-slate-50 border-b border-slate-100 p-1">
                <button onClick={addColumn} title="Add column" className="text-slate-400 hover:text-violet-600 p-1">
                  <Plus size={13} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, r) => (
              <tr key={r} className="group">
                <td className="text-center text-[10px] text-slate-300 border-r border-b border-slate-100 select-none">
                  <button onClick={() => deleteRow(r)} title="Delete row" className="w-full py-1.5 hover:text-red-500 hover:bg-red-50">
                    {r + 1}
                  </button>
                </td>
                {headers.map((_, c) => (
                  <td key={c} className="border-r border-b border-slate-100 p-0">
                    <input
                      value={row[c] ?? ''}
                      onChange={(e) => updateCell(r, c, e.target.value)}
                      className="w-full px-2 py-1.5 bg-transparent focus:outline-none focus:ring-2 focus:ring-violet-200 focus:relative"
                    />
                  </td>
                ))}
                <td className="border-b border-slate-100" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <button onClick={addRow} className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:text-violet-700">
          <Plus size={12} /> Add row
        </button>
        {hiddenCount > 0 && (
          <p className="text-[11px] text-slate-400">
            {hiddenCount} more row{hiddenCount === 1 ? '' : 's'} not shown — edit those via a re-upload, or trim the sheet before importing.
          </p>
        )}
      </div>
    </div>
  );
}