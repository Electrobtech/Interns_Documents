'use client';
/**
 * Form + modal primitives shared by the domain sections.
 *
 * Split from MarketingUI (display primitives) so a section that only renders
 * doesn't pull in form machinery.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import {
  X, Sparkles, Loader2, AlertTriangle, Save, Search, ChevronDown, Check, Info,
} from 'lucide-react';

import { useRunMarketingAgent } from '@/lib/queries/aiAgents';
import { Card, Button, Badge, ConfidenceMeter, ACCENT } from '../MarketingUI';

export function Modal({ open, onClose, title, subtitle, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm">
      <div
        className={`bg-white rounded-2xl border border-[#E4E8F0] shadow-xl w-full ${
          wide ? 'max-w-3xl' : 'max-w-lg'
        } max-h-[90vh] flex flex-col`}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[#EEF1F6]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {title}
            </h3>
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-slate-600 transition-colors flex-shrink-0">
            <X size={17} />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="px-5 py-3.5 border-t border-[#EEF1F6] flex items-center justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full text-sm rounded-xl border border-[#E4E8F0] px-3.5 py-2.5 outline-none text-slate-700 ' +
  'focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all placeholder:text-slate-300';

export function Field({ label, hint, required, children }) {
  return (
    <label className="block mb-4 last:mb-0">
      <span className="block text-[11px] font-semibold text-slate-500 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </span>
      {children}
      {hint && <span className="block text-[10px] text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />;
}

export function Textarea(props) {
  return <textarea rows={4} {...props} className={`${inputCls} resize-y ${props.className || ''}`} />;
}

export function Select({ options, placeholder, ...props }) {
  return (
    <select {...props} className={`${inputCls} ${props.className || ''}`}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder }) {
  return (
    <div className="relative flex-1 min-w-[200px]">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`${inputCls} pl-9 py-2`}
      />
    </div>
  );
}

/** Comma-separated text ⇄ string[]. The backend takes arrays; a marketer
 *  types a list. */
export function TagsInput({ value, onChange, placeholder }) {
  return (
    <Input
      value={(value || []).join(', ')}
      onChange={(e) =>
        onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))
      }
      placeholder={placeholder}
    />
  );
}

export function ErrorNote({ error }) {
  if (!error) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50/70 px-3 py-2.5">
      <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-red-600">{error.message || 'Something went wrong'}</p>
    </div>
  );
}

/* ── Toasts ─────────────────────────────────────────────────────────────
   Destructive actions get an Undo affordance. Undo here is a real inverse
   call supplied by the caller, not a delayed send — the mutation has already
   happened, so "Undo" restores rather than cancels. */

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((toast) => {
    const id = ++seq.current;
    setToasts((t) => [...t, { ...toast, id }]);
    setTimeout(() => dismiss(id), toast.duration ?? 6000);
    return id;
  }, [dismiss]);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2 w-80">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`rounded-xl border shadow-lg px-3.5 py-3 bg-white flex items-start gap-2.5 ${
              t.tone === 'error' ? 'border-red-200' : 'border-[#E4E8F0]'
            }`}
          >
            {t.tone === 'error'
              ? <AlertTriangle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              : <Check size={14} className="text-emerald-500 mt-0.5 flex-shrink-0" />}
            <p className="text-[12px] text-slate-700 flex-1">{t.message}</p>
            {t.onUndo && (
              <button
                onClick={() => { t.onUndo(); dismiss(t.id); }}
                className="text-[11px] font-semibold flex-shrink-0"
                style={{ color: ACCENT }}
              >
                Undo
              </button>
            )}
            <button onClick={() => dismiss(t.id)} className="text-slate-300 hover:text-slate-500 flex-shrink-0">
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ── Confirm dialog ─────────────────────────────────────────────────── */

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Delete permanently', danger = true, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working…' : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={16} className={danger ? 'text-red-500 mt-0.5' : 'text-amber-500 mt-0.5'} />
        <p className="text-[13px] text-slate-600">{message}</p>
      </div>
    </Modal>
  );
}

/* ── Dropdown menu ──────────────────────────────────────────────────── */

export function Menu({ trigger, items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={`absolute z-40 mt-1 min-w-[184px] rounded-xl border border-[#E4E8F0] bg-white shadow-lg py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((it, i) =>
            it.divider ? (
              <div key={`d${i}`} className="my-1 border-t border-[#EEF1F6]" />
            ) : (
              <button
                key={it.label}
                role="menuitem"
                disabled={it.disabled}
                onClick={() => { setOpen(false); it.onClick?.(); }}
                title={it.disabled ? it.disabledReason : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-left transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed ${
                    it.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-600 hover:bg-slate-50'
                  }`}
              >
                {it.icon && <it.icon size={14} />}
                {it.label}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

/** Default action on the body, alternates behind the caret. */
export function SplitButton({ label, icon: Icon, onClick, items }) {
  return (
    <div className="inline-flex">
      <Button icon={Icon} onClick={onClick} className="!rounded-r-none !pr-2.5">{label}</Button>
      <Menu
        trigger={
          <button
            aria-label={`${label} options`}
            className="h-full px-1.5 rounded-r-xl border border-l-0 border-[#E4E8F0] bg-white
                       text-slate-500 hover:bg-slate-50 transition-colors"
          >
            <ChevronDown size={13} />
          </button>
        }
        items={items}
      />
    </div>
  );
}

/* ── Skeleton ───────────────────────────────────────────────────────── */

export function Skeleton({ className = '' }) {
  return <div className={`bg-slate-100 rounded animate-pulse ${className}`} />;
}

/** A cell whose data has no source in this deployment. Rendered as an explicit
 *  gap so it can never be mistaken for a measured zero. */
export function NoSource({ hint = 'Needs a connected ad account' }) {
  return (
    <span title={hint} className="text-slate-300 cursor-help">—</span>
  );
}

export function timeAgo(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function fmtDate(iso, opts) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, opts || { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Run a Marketing Agent capability, show its provenance, and hand the raw
 * output to the caller so it can be saved.
 *
 * The save step is deliberately the caller's: a draft the marketer rejects
 * should not end up in the library, so nothing is persisted automatically.
 */
export function AIPanel({
  title = 'Ask the Marketing Agent',
  placeholder,
  examples = [],
  capability,
  renderResult,
  onSave,
  saveLabel = 'Save result',
  saving = false,
}) {
  const run = useRunMarketingAgent();
  const [prompt, setPrompt] = useState('');

  const res = run.data;
  const exp = res?.explanation;
  const output = res?.output?.[capability] ?? (res?.output ? Object.values(res.output)[0] : null);

  const submit = (e) => {
    e?.preventDefault();
    const message = prompt.trim();
    if (message) run.mutate({ message });
  };

  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={14} style={{ color: '#7C3AED' }} />
        <h3 className="text-sm font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
          {title}
        </h3>
        {capability && (
          <code className="ml-auto font-mono text-[10px] text-slate-400">{capability}</code>
        )}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <Textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={placeholder}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex flex-wrap gap-1.5">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setPrompt(ex)}
                className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E4E8F0] text-slate-500
                           hover:bg-slate-50 hover:text-slate-700 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              variant="primary"
              icon={run.isPending ? Loader2 : Sparkles}
              disabled={run.isPending || !prompt.trim()}
            >
              {run.isPending ? 'Running…' : 'Run'}
            </Button>
            {/* Always visible, so it's obvious the result can be kept — but
                disabled until there is actually something to save. */}
            {onSave && (
              <Button
                type="button"
                icon={saving ? Loader2 : Save}
                disabled={!output || saving}
                title={output ? saveLabel : 'Run the agent first, then save the result'}
                onClick={() =>
                  onSave(output, { execution_id: res?.execution_id, confidence: exp?.confidence })
                }
              >
                {saving ? 'Saving…' : saveLabel}
              </Button>
            )}
          </div>
        </div>
      </form>

      {run.isError && <div className="mt-3"><ErrorNote error={run.error} /></div>}

      {res && !run.isPending && (
        <div className="mt-4 pt-4 border-t border-[#EEF1F6]">
          <div className="flex items-start justify-between gap-4 mb-3">
            <p className="text-[11px] text-slate-500 flex-1">{exp?.summary}</p>
            <div className="text-right flex-shrink-0 w-24">
              <div className="text-base font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {exp?.confidence != null ? `${Math.round(exp.confidence * 100)}%` : '—'}
              </div>
              <p className="text-[10px] text-slate-400 mb-1">confidence</p>
              <ConfidenceMeter value={exp?.confidence != null ? exp.confidence * 100 : null} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {(exp?.capabilities_used || []).map((c) => <Badge key={c} tone="violet">{c}</Badge>)}
            {(exp?.degraded_inputs || []).map((d) => <Badge key={d} tone="amber">{d}</Badge>)}
          </div>

          {!exp?.knowledge_used?.length && (
            <p className="text-[11px] text-amber-600 mb-3">
              No documents matched — this answer is not grounded in your knowledge base.
            </p>
          )}

          {output && (
            <div className="rounded-xl border border-[#EEF1F6] bg-slate-50/60 p-3.5 mb-3">
              {renderResult ? renderResult(output) : (
                <pre className="text-[11px] text-slate-600 whitespace-pre-wrap font-mono overflow-x-auto">
                  {JSON.stringify(output, null, 2)}
                </pre>
              )}
            </div>
          )}

          {output && onSave && (
            <Button
              variant="primary"
              icon={saving ? Loader2 : Save}
              disabled={saving}
              onClick={() => onSave(output, { execution_id: res?.execution_id, confidence: exp?.confidence })}
            >
              {saving ? 'Saving…' : saveLabel}
            </Button>
          )}
        </div>
      )}

      {!res && !run.isPending && (
        <p className="mt-3 pt-3 border-t border-[#EEF1F6] text-[11px] text-slate-400">
          Results appear here with their confidence and sources. Nothing is saved
          until you choose to keep it.
        </p>
      )}
    </Card>
  );
}
