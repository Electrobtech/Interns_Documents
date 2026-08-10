'use client';
import { useRef, useState } from 'react';
import {
  Table2, Upload, Link2, Loader2, AlertTriangle, FileSpreadsheet, Sheet as SheetIcon,
} from 'lucide-react';
import {
  useSpreadsheets, useUploadSpreadsheet, useCreateSpreadsheetFromLink,
} from '@/lib/queries/spreadsheets';
import SpreadsheetEditor from './SpreadsheetEditor';

function timeAgo(iso) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

/**
 * Support Agent "Import" tab — saved, editable spreadsheets. Upload a file
 * or fetch a Google Sheet, then open it in an in-app grid editor
 * (SpreadsheetEditor.jsx) to view/edit cells before importing into
 * contacts/leads whenever ready. Separate from ImportTab.jsx's one-shot
 * link-only flow, which writes nothing to disk.
 */
export default function SpreadsheetsLibrary() {
  const { data: sheets, isLoading, isError, error } = useSpreadsheets();
  const uploadFile = useUploadSpreadsheet();
  const fromLink = useCreateSpreadsheetFromLink();
  const fileInputRef = useRef(null);

  const [openId, setOpenId] = useState(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkForm, setShowLinkForm] = useState(false);

  if (openId) {
    return <SpreadsheetEditor id={openId} onBack={() => setOpenId(null)} />;
  }

  async function handleFilePick(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    const res = await uploadFile.mutateAsync({ file }).catch(() => null);
    if (res) setOpenId(res.id);
  }

  async function handleLinkSubmit(e) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const res = await fromLink.mutateAsync({ url: linkUrl.trim() }).catch(() => null);
    if (res) { setOpenId(res.id); setLinkUrl(''); setShowLinkForm(false); }
  }

  const creating = uploadFile.isPending || fromLink.isPending;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <Table2 size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">My Spreadsheets</h4>
            <p className="text-[11px] text-slate-400">Upload or fetch a sheet, edit it right here, import whenever you&apos;re ready</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFilePick} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={creating}
            className="btn-ghost btn-sm flex items-center gap-1.5"
          >
            {uploadFile.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Upload file
          </button>
          <button
            onClick={() => setShowLinkForm((v) => !v)}
            disabled={creating}
            className="btn-violet btn-sm flex items-center gap-1.5"
          >
            <Link2 size={12} /> From Google Sheets
          </button>
        </div>
      </div>

      {showLinkForm && (
        <form onSubmit={handleLinkSubmit} className="flex items-center gap-2">
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/…/edit#gid=0"
            className="input-premium flex-1"
          />
          <button disabled={fromLink.isPending || !linkUrl.trim()} className="btn-violet whitespace-nowrap flex items-center gap-1.5">
            {fromLink.isPending ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
            {fromLink.isPending ? 'Fetching…' : 'Fetch'}
          </button>
        </form>
      )}

      {(uploadFile.isError || fromLink.isError) && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">
            {uploadFile.error?.message || fromLink.error?.message || 'Could not create that spreadsheet.'}
          </p>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error?.message || 'Could not load spreadsheets.'}</p>
        </div>
      )}

      {!isLoading && !isError && sheets?.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <FileSpreadsheet size={28} className="text-slate-200" />
          <p className="text-sm text-slate-400">No spreadsheets yet — upload a file or fetch a Google Sheet to get started.</p>
        </div>
      )}

      {!isLoading && sheets?.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {sheets.map((s) => (
            <button
              key={s.id}
              onClick={() => setOpenId(s.id)}
              className="flex items-start gap-3 text-left rounded-xl border border-slate-100 p-3.5 hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
            >
              <div className="p-1.5 rounded-lg bg-slate-50 text-slate-400 shrink-0">
                {s.source === 'google_sheets' ? <SheetIcon size={14} /> : <FileSpreadsheet size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {s.columnCount} col{s.columnCount === 1 ? '' : 's'} · {s.rowCount} row{s.rowCount === 1 ? '' : 's'} · edited {timeAgo(s.updatedAt)}
                </p>
                {s.lastImportedAt && (
                  <p className="text-[10px] text-emerald-600 font-semibold mt-1">Imported {timeAgo(s.lastImportedAt)}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}