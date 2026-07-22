'use client';
import { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, X, Loader2, CheckCircle2 } from 'lucide-react';
import { apiUpload } from '@/lib/api';

const ALLOWED = ['image/png', 'image/jpeg', 'application/pdf'];
const MAX_BYTES = 10 * 1024 * 1024;

// Reusable drag-and-drop uploader used for the company logo (Step 2) and
// the verification documents (Step 5). Uploads immediately on drop/select
// via POST /company/upload and reports the resulting URL back up.
export default function FileDropzone({ label, kind, accept = '.png,.jpg,.jpeg,.pdf', value, onChange, hint }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const upload = useCallback(async (file) => {
    setError('');
    if (!file) return;
    if (!ALLOWED.includes(file.type)) return setError('Only PNG, JPG and PDF files are allowed.');
    if (file.size > MAX_BYTES) return setError('File exceeds the 10 MB limit.');

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', kind);
      const result = await apiUpload('/company/upload', fd);
      onChange({ url: result.url, filename: result.filename, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null });
    } catch (e) {
      setError(e.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }, [kind, onChange]);

  return (
    <div>
      {label && <label className="block text-xs font-medium text-slate-600 mb-1.5">{label}</label>}
      {!value ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files?.[0]); }}
          className={`flex flex-col items-center justify-center gap-1.5 border-2 border-dashed rounded-xl px-4 py-6 text-center cursor-pointer transition-colors
            ${dragging ? 'border-brand bg-brand-light' : 'border-slate-200 hover:border-brand/50 hover:bg-slate-50'}`}
        >
          {busy ? <Loader2 size={22} className="text-brand animate-spin" /> : <UploadCloud size={22} className="text-slate-400" />}
          <p className="text-xs text-slate-500">
            <span className="text-brand font-medium">Click to upload</span> or drag and drop
          </p>
          {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
          <input ref={inputRef} type="file" accept={accept} className="hidden"
            onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      ) : (
        <div className="flex items-center gap-3 border border-slate-200 rounded-xl px-3 py-2.5">
          {value.previewUrl ? (
            <img src={value.previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-brand-light text-brand grid place-items-center shrink-0"><FileText size={18} /></div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-slate-700 truncate">{value.filename}</p>
            <p className="text-[11px] text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12} /> Uploaded</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="text-slate-400 hover:text-red-500 shrink-0">
            <X size={16} />
          </button>
        </div>
      )}
      {error && <p className="text-[11px] text-red-500 mt-1">{error}</p>}
    </div>
  );
}
