'use client';
import { useState } from 'react';
import { Sparkles, ShieldCheck, Check, AlertTriangle, X, Wand2 } from 'lucide-react';
import { useOptimizeAEO, useAntiBanCheck } from '@/lib/queries/marketingAgent';

const RISK_TONE = {
  low: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  medium: 'text-amber-700 bg-amber-50 border-amber-200',
  high: 'text-red-700 bg-red-50 border-red-200',
};

// Ambient Marketing Agent inside the Campaign composer: two one-click actions
// on whatever's in the message body — "Improve Copy" (AEO optimize) and
// "Anti-Ban Check" (Meta deliverability pre-flight). Results are shown inline;
// the user applies a rewrite with a single click. Never auto-edits the draft.
export default function CampaignComposerAI({ draft, channel, onApply }) {
  const optimize = useOptimizeAEO();
  const antiBan = useAntiBanCheck();
  const [open, setOpen] = useState(null); // 'improve' | 'antiban' | null

  const hasDraft = !!(draft && draft.trim());

  const runImprove = () => {
    setOpen('improve');
    optimize.mutate(draft.trim());
  };
  const runAntiBan = () => {
    setOpen('antiban');
    antiBan.mutate({ draft: draft.trim(), channel: channel || 'whatsapp' });
  };

  const aeo = optimize.data;
  const ban = antiBan.data;

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/70 to-fuchsia-50/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1 rounded-md bg-violet-100 text-violet-600"><Sparkles size={12} /></div>
        <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">Marketing Agent</span>
        <span className="text-[11px] text-slate-400 ml-auto">grounded in your docs</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runImprove}
          disabled={!hasDraft || optimize.isPending}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
        >
          <Wand2 size={12} /> {optimize.isPending ? 'Improving…' : 'Improve Copy'}
        </button>
        <button
          type="button"
          onClick={runAntiBan}
          disabled={!hasDraft || antiBan.isPending}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-violet-200 text-violet-700 hover:bg-violet-50 transition-colors disabled:opacity-50"
        >
          <ShieldCheck size={12} /> {antiBan.isPending ? 'Checking…' : 'Anti-Ban Check'}
        </button>
        {!hasDraft && <span className="text-[11px] text-slate-400 self-center">Write a message first</span>}
      </div>

      {/* Improve Copy result */}
      {open === 'improve' && aeo && (
        <div className="mt-3 rounded-lg bg-white border border-violet-100 p-3 relative">
          <button type="button" onClick={() => setOpen(null)} className="absolute top-2 right-2 text-slate-300 hover:text-slate-500"><X size={13} /></button>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-violet-600 uppercase">AEO score {aeo.aeo_score}/100</span>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">{aeo.optimized_copy}</p>
          {aeo.optimized_copy && (
            <button
              type="button"
              onClick={() => { onApply?.(aeo.optimized_copy); setOpen(null); }}
              className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
            >
              <Check size={12} /> Use this version
            </button>
          )}
        </div>
      )}
      {open === 'improve' && optimize.isError && (
        <p className="mt-2 text-xs text-red-500">{optimize.error?.message}</p>
      )}

      {/* Anti-Ban result */}
      {open === 'antiban' && ban && (
        <div className="mt-3 rounded-lg bg-white border border-violet-100 p-3 relative">
          <button type="button" onClick={() => setOpen(null)} className="absolute top-2 right-2 text-slate-300 hover:text-slate-500"><X size={13} /></button>
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${RISK_TONE[ban.risk_level] || RISK_TONE.low}`}>
              {ban.risk_level} risk · {ban.spam_risk_score}/100
            </span>
            <span className="text-[11px] font-semibold text-slate-500 capitalize">{String(ban.verdict).replace(/_/g, ' ')}</span>
          </div>
          {ban.frequency_warning && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 mb-1.5">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" /> {ban.frequency_warning}
            </p>
          )}
          {Array.isArray(ban.spam_trigger_words) && ban.spam_trigger_words.length > 0 && (
            <p className="text-xs text-slate-600 mb-1.5">
              <b>Trigger words:</b> {ban.spam_trigger_words.join(', ')}
            </p>
          )}
          {Array.isArray(ban.recommendations) && ban.recommendations.length > 0 && (
            <ul className="space-y-1 mb-2">
              {ban.recommendations.slice(0, 4).map((r, i) => (
                <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-violet-300 shrink-0 mt-1.5" /> {r}
                </li>
              ))}
            </ul>
          )}
          {ban.safe_rewrite && (
            <div className="rounded-lg bg-slate-50 border border-slate-100 p-2.5 mt-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Safer rewrite</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{ban.safe_rewrite}</p>
              <button
                type="button"
                onClick={() => { onApply?.(ban.safe_rewrite); setOpen(null); }}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
              >
                <Check size={12} /> Use safer version
              </button>
            </div>
          )}
        </div>
      )}
      {open === 'antiban' && antiBan.isError && (
        <p className="mt-2 text-xs text-red-500">{antiBan.error?.message}</p>
      )}
    </div>
  );
}
