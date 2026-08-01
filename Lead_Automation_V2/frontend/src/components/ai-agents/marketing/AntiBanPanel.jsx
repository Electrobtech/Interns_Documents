'use client';
import { useState } from 'react';
import { ShieldCheck, ShieldAlert, ShieldX, Sparkles, AlertTriangle, Copy, Check } from 'lucide-react';
import { useAntiBanCheck } from '@/lib/queries/marketingAgent';

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.text || v.reason || JSON.stringify(v);
  return String(v);
}

const VERDICTS = {
  safe_to_send:      { label: 'Safe to send',       icon: ShieldCheck, tone: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  revise_recommended:{ label: 'Revise recommended', icon: ShieldAlert, tone: 'text-amber-700 bg-amber-50 border-amber-200'    },
  do_not_send:       { label: 'Do not send',        icon: ShieldX,     tone: 'text-red-700 bg-red-50 border-red-200'          },
};

const CHANNELS = ['whatsapp', 'instagram', 'messenger', 'sms', 'email'];

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text || ''); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-600 transition-colors">
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

export default function AntiBanPanel() {
  const check = useAntiBanCheck();
  const [draft, setDraft] = useState('');
  const [channel, setChannel] = useState('whatsapp');
  const [freqNote, setFreqNote] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!draft.trim()) return;
    check.mutate({ draft: draft.trim(), channel, recent_sends_note: freqNote.trim() || null });
  };

  const out = check.data;
  const risk = Math.max(0, Math.min(100, Number(out?.spam_risk_score) || 0));
  const riskTone = risk >= 60 ? 'bg-red-500' : risk >= 30 ? 'bg-amber-500' : 'bg-emerald-500';
  const verdict = VERDICTS[out?.verdict] || VERDICTS.safe_to_send;
  const VerdictIcon = verdict.icon;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
            <ShieldCheck size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Meta Anti-Ban Pre-Flight</h4>
            <p className="text-[11px] text-slate-400">Catch spam triggers &amp; policy issues before you send</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Broadcast draft</label>
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={5}
              placeholder="Paste the broadcast/template message you plan to send…"
              className="input-premium w-full resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Channel</label>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="input-premium w-full capitalize">
                {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Recent sends (optional)</label>
              <input value={freqNote} onChange={(e) => setFreqNote(e.target.value)}
                placeholder="e.g. 3rd this week" className="input-premium w-full" />
            </div>
          </div>
          <button disabled={check.isPending || !draft.trim()} className="btn-primary">
            <Sparkles size={14} />
            {check.isPending ? 'Checking…' : 'Run Pre-Flight Check'}
          </button>
        </form>

        {check.isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mt-3">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{check.error?.message}</p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {check.isPending && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-8 text-center">
            <p className="text-sm font-semibold text-slate-500">Analysing deliverability…</p>
          </div>
        )}

        {out && (
          <div className="space-y-4 animate-scale-in">
            <div className={`flex items-center gap-3 rounded-2xl border p-4 ${verdict.tone}`}>
              <VerdictIcon size={22} className="shrink-0" />
              <div>
                <p className="text-sm font-bold">{verdict.label}</p>
                <p className="text-xs opacity-80 capitalize">Risk level: {out.risk_level}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Spam risk score</p>
                <span className="text-lg font-black text-slate-800 tabular-nums">{risk}<span className="text-xs text-slate-400">/100</span></span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full rounded-full ${riskTone}`} style={{ width: `${risk}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-4 text-xs">
                <span className={`inline-flex items-center gap-1 font-semibold ${out.opt_out_present ? 'text-emerald-600' : 'text-red-500'}`}>
                  {out.opt_out_present ? <Check size={13} /> : <AlertTriangle size={13} />} Opt-out {out.opt_out_present ? 'present' : 'missing'}
                </span>
                {out.template_category?.category && (
                  <span className="inline-flex items-center gap-1 font-semibold text-slate-600 capitalize">
                    Template: {out.template_category.category}
                  </span>
                )}
              </div>
            </div>

            {out.frequency_warning && (
              <div className="flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-2xl">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800">{out.frequency_warning}</p>
              </div>
            )}

            {Array.isArray(out.spam_trigger_words) && out.spam_trigger_words.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Risky phrases found</p>
                <div className="flex flex-wrap gap-1.5">
                  {out.spam_trigger_words.map((w, i) => (
                    <span key={i} className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-red-50 text-red-600">{asText(w)}</span>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(out.policy_flags) && out.policy_flags.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Policy flags</p>
                <ul className="list-disc list-inside space-y-1 text-sm text-slate-600">
                  {out.policy_flags.map((f, i) => <li key={i}>{asText(f)}</li>)}
                </ul>
              </div>
            )}

            {out.safe_rewrite && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Compliant rewrite</p>
                  <CopyBtn text={out.safe_rewrite} />
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                  {out.safe_rewrite}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
