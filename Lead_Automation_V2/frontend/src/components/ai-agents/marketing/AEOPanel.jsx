'use client';
import { useState } from 'react';
import { Bot, Sparkles, AlertTriangle, ChevronRight, Copy, Check, Quote } from 'lucide-react';
import { useOptimizeAEO, useAEOOptimizations } from '@/lib/queries/marketingAgent';

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.text || v.answer || v.question || JSON.stringify(v);
  return String(v);
}

function ScoreRing({ score }) {
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  const tone = s >= 70 ? 'text-emerald-600' : s >= 45 ? 'text-amber-600' : 'text-red-500';
  const ring = s >= 70 ? '#059669' : s >= 45 ? '#d97706' : '#ef4444';
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f1f5f9" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.9" fill="none" stroke={ring} strokeWidth="3"
          strokeDasharray={`${s} 100`} strokeLinecap="round" />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${tone}`}>
        <span className="text-lg font-black leading-none">{s}</span>
        <span className="text-[8px] font-bold uppercase tracking-wide">/100</span>
      </div>
    </div>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard?.writeText(text || ''); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-violet-600 transition-colors"
    >
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function AEOPanel() {
  const optimize = useOptimizeAEO();
  const { data: saved } = useAEOOptimizations();
  const [copy, setCopy] = useState('');
  const [selected, setSelected] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!copy.trim()) return;
    optimize.mutate(copy.trim(), { onSuccess: (out) => setSelected(out) });
  };

  const active = selected || optimize.data;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      <div className="xl:col-span-2 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-600">
              <Bot size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Answer Engine Optimization</h4>
              <p className="text-[11px] text-slate-400">Make copy citable by ChatGPT, Perplexity &amp; Google AI Overviews</p>
            </div>
          </div>
          <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

          <form onSubmit={submit} className="space-y-3">
            <textarea
              value={copy}
              onChange={(e) => setCopy(e.target.value)}
              rows={4}
              placeholder="Paste marketing copy or a topic, e.g. 'Why Orbq is the best WhatsApp lead automation for SMBs'"
              className="input-premium w-full resize-none"
            />
            <button disabled={optimize.isPending || !copy.trim()} className="btn-primary">
              <Sparkles size={14} />
              {optimize.isPending ? 'Optimizing…' : 'Optimize for AI Citation'}
            </button>
          </form>

          {optimize.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mt-3">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{optimize.error?.message}</p>
            </div>
          )}
        </div>

        {active && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5 animate-scale-in">
            <div className="flex items-center gap-4">
              <ScoreRing score={active.aeo_score} />
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Citability score (input)</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-1">{asText(active.score_reason)}</p>
              </div>
            </div>

            {active.optimized_copy && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Optimized copy</p>
                  <CopyBtn text={active.optimized_copy} />
                </div>
                <div className="bg-violet-50/60 border border-violet-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {active.optimized_copy}
                </div>
              </div>
            )}

            {Array.isArray(active.citation_hooks) && active.citation_hooks.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Quotable citation hooks</p>
                <div className="space-y-2">
                  {active.citation_hooks.map((h, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-50 rounded-lg p-3">
                      <Quote size={13} className="text-violet-400 shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600">{asText(h)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(active.structured_qa) && active.structured_qa.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Structured Q&amp;A</p>
                <div className="space-y-2">
                  {active.structured_qa.map((qa, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs font-bold text-slate-700">{asText(qa.question || qa.q)}</p>
                      <p className="text-sm text-slate-600 mt-1">{asText(qa.answer || qa.a)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(active.entities_to_emphasize) && active.entities_to_emphasize.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Entities to emphasize</p>
                <div className="flex flex-wrap gap-1.5">
                  {active.entities_to_emphasize.map((e, i) => (
                    <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-fuchsia-50 text-fuchsia-700">{asText(e)}</span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(active.improvements) && active.improvements.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Improvements</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {active.improvements.map((r, i) => <li key={i}>{asText(r)}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600">
            <Bot size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Saved runs</h4>
            <p className="text-[11px] text-slate-400">Click to review</p>
          </div>
        </div>
        {!saved?.length ? (
          <div className="text-center py-8"><p className="text-xs font-medium text-slate-400">No runs yet</p></div>
        ) : (
          <div className="space-y-2">
            {saved.map((b, i) => (
              <button key={b.id}
                onClick={() => setSelected({ ...b.output, id: b.id, input_text: b.input_text })}
                className="w-full group flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50/50 border border-transparent hover:border-violet-100 transition-all duration-150 text-left animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <span className={`text-xs font-black shrink-0 ${((b.output?.aeo_score ?? 0) >= 70) ? 'text-emerald-600' : (b.output?.aeo_score ?? 0) >= 45 ? 'text-amber-600' : 'text-red-500'}`}>
                  {b.output?.aeo_score ?? '–'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-700 truncate">{b.input_text}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{new Date(b.created_at).toLocaleString()}</p>
                </div>
                <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1 group-hover:text-violet-400 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
