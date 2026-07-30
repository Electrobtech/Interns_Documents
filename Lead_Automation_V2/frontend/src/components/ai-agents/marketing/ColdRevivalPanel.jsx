'use client';
import { useState } from 'react';
import { Radar, Sparkles, AlertTriangle, Copy, Check, Clock, Ban, Megaphone } from 'lucide-react';
import { useColdRevival } from '@/lib/queries/marketingAgent';
import { useCreateCampaign } from '@/lib/queries/crm';

function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return v.text || v.goal || JSON.stringify(v);
  return String(v);
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard?.writeText(text || ''); setDone(true); setTimeout(() => setDone(false), 1500); }}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-violet-600 transition-colors">
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const WINDOWS = [15, 30, 60, 90];

export default function ColdRevivalPanel() {
  const scan = useColdRevival();
  const createCampaign = useCreateCampaign();
  const [days, setDays] = useState(30);
  const [note, setNote] = useState('');
  const [sentStep, setSentStep] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    scan.mutate({ dormant_days: days, note: note.trim() || null });
  };

  const out = scan.data;
  const steps = Array.isArray(out?.drip_sequence) ? out.drip_sequence : [];

  const sendStepToCampaign = async (step, i) => {
    await createCampaign.mutateAsync({
      name: `Revival Step ${step.step_number || i + 1} — ${days}d dormant`,
      type: 'drip',
      channel_type: (step.channel || 'whatsapp').toLowerCase(),
      message_body: asText(step.message),
      status: 'draft',
    });
    setSentStep(i);
    setTimeout(() => setSentStep(null), 2500);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-fuchsia-100 text-violet-600">
            <Radar size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Cold Lead Revival Radar</h4>
            <p className="text-[11px] text-slate-400">Find dormant leads and draft a 3-step WhatsApp re-engagement drip</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Consider a lead dormant after</label>
            <div className="flex gap-2">
              {WINDOWS.map((d) => (
                <button key={d} type="button" onClick={() => setDays(d)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${days === d ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {d} days
                </button>
              ))}
            </div>
          </div>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Optional: a hook to re-engage with, e.g. 'we just launched voice agents'"
            className="input-premium w-full" />
          <button disabled={scan.isPending} className="btn-primary">
            <Sparkles size={14} />
            {scan.isPending ? 'Scanning…' : 'Scan & Draft Revival Drip'}
          </button>
        </form>

        {scan.isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mt-3">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{scan.error?.message}</p>
          </div>
        )}
      </div>

      {out && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-scale-in">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 text-center">
              <p className="text-4xl font-black text-violet-600 tabular-nums">{out.dormant_count}</p>
              <p className="text-xs font-semibold text-slate-500 mt-1">dormant leads (&ge; {out.dormant_days} days)</p>
            </div>

            {out.segment_insight && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Segment insight</p>
                <p className="text-sm text-slate-600 leading-relaxed">{out.segment_insight}</p>
              </div>
            )}

            {Array.isArray(out.dormant_leads) && out.dormant_leads.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">Who's gone cold</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {out.dormant_leads.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 truncate">{l.name}</span>
                      <span className="flex items-center gap-1 text-slate-400 shrink-0">
                        <span className="capitalize">{l.source}</span>
                        <span className="text-slate-300">·</span>
                        <Clock size={11} /> {l.days_inactive}d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {Array.isArray(out.do_not_do) && out.do_not_do.length > 0 && (
              <div className="bg-red-50/60 rounded-2xl border border-red-100 p-5">
                <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Ban size={12} /> Don't do this
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700/90">
                  {out.do_not_do.map((d, i) => <li key={i}>{asText(d)}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="xl:col-span-2 space-y-4">
            {out.revival_summary && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <p className="text-sm text-slate-600 leading-relaxed">{out.revival_summary}</p>
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-400">
                  {out.best_send_window && <span><b className="text-slate-600">Best window:</b> {out.best_send_window}</span>}
                  {out.channel_recommendation && <span><b className="text-slate-600">Channel:</b> {out.channel_recommendation}</span>}
                </div>
              </div>
            )}

            {steps.map((step, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white text-[11px] font-black">{step.step_number || i + 1}</span>
                    <span className="text-xs font-bold text-slate-700">{step.timing || `Step ${i + 1}`}</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{step.channel || 'whatsapp'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CopyBtn text={asText(step.message)} />
                    <button onClick={() => sendStepToCampaign(step, i)} disabled={createCampaign.isPending}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-white bg-gradient-to-r from-violet-500 to-purple-600 px-2.5 py-1 rounded-lg hover:shadow-md transition-all disabled:opacity-50">
                      <Megaphone size={11} /> {sentStep === i ? 'Sent ✓' : 'To Campaign'}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed">{asText(step.message)}</div>
                {step.goal && <p className="text-[11px] text-slate-400 mt-2"><b>Goal:</b> {asText(step.goal)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
