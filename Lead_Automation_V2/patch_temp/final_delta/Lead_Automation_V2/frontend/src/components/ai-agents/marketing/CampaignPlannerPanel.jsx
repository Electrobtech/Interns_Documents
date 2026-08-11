'use client';
import { useState } from 'react';
import {
  CalendarClock, Sparkles, AlertTriangle, Send, CheckCircle2, X,
} from 'lucide-react';
import {
  useGenerateCampaignPlan, useCampaignPlans, useConvertPlanItem,
} from '@/lib/queries/marketingAgent';

// Must match marketing-hub-service's CHANNELS enum exactly (see
// campaignsRouter.js) — 'website' used to be offered here but isn't a
// valid mh_campaigns channel, so converting a plan item on that channel
// would 400 once this points at marketing-hub-service instead of the old
// campaign-service.
const CHANNEL_OPTIONS = ['whatsapp', 'email', 'sms', 'messenger', 'instagram', 'linkedin'];

function ConvertRow({ planId, itemIndex, item }) {
  const convert = useConvertPlanItem();
  const [open, setOpen] = useState(false);
  const [channelType, setChannelType] = useState(item.channel || 'whatsapp');
  const [messageBody, setMessageBody] = useState(item.notes || item.topic || '');

  if (convert.isSuccess) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">
        <CheckCircle2 size={12} /> Converted
      </span>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-violet-600 hover:text-violet-700 px-2.5 py-1 rounded-lg border border-violet-200 hover:bg-violet-50 transition-colors"
      >
        Convert to campaign
      </button>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">New Campaign</span>
        <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
          <X size={13} />
        </button>
      </div>
      <select value={channelType} onChange={(e) => setChannelType(e.target.value)} className="input-premium py-1.5 text-xs">
        {CHANNEL_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <textarea
        rows={2}
        value={messageBody}
        onChange={(e) => setMessageBody(e.target.value)}
        className="input-premium resize-none py-1.5 text-xs"
        placeholder="Message body…"
      />
      {convert.isError && <p className="text-[10px] text-red-600">{convert.error?.message}</p>}
      <button
        disabled={convert.isPending || !messageBody.trim()}
        onClick={() => convert.mutate({ planId, itemIndex, channel_type: channelType, message_body: messageBody.trim() })}
        className="btn-primary btn-sm w-full justify-center"
      >
        <Send size={12} /> {convert.isPending ? 'Creating…' : 'Create Campaign'}
      </button>
    </div>
  );
}

export default function CampaignPlannerPanel() {
  const generate = useGenerateCampaignPlan();
  const { data: plans } = useCampaignPlans();
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [timeframe, setTimeframe] = useState('4 weeks');
  const [channels, setChannels] = useState(['whatsapp', 'email']);
  const [persona, setPersona] = useState('');
  const [selected, setSelected] = useState(null);

  const toggleChannel = (c) => {
    setChannels((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !goal.trim() || !timeframe.trim()) return;
    generate.mutate(
      { name: name.trim(), goal: goal.trim(), timeframe: timeframe.trim(), channels, persona: persona.trim() || undefined },
      { onSuccess: (out) => setSelected(out) },
    );
  };

  const active = selected || generate.data;
  const items = Array.isArray(active?.items) ? active.items : [];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600">
            <CalendarClock size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Campaign Planner</h4>
            <p className="text-[11px] text-slate-400">Generate a proportional content calendar</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Plan Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Q3 Lead Gen Sprint" className="input-premium" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Timeframe</label>
              <input value={timeframe} onChange={(e) => setTimeframe(e.target.value)} placeholder="e.g. 4 weeks" className="input-premium" />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Goal</label>
            <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Drive demo bookings for new pricing tier" className="input-premium" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Channels</label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => toggleChannel(c)}
                  className={`text-xs font-medium px-3 py-1.5 rounded-lg border capitalize transition-colors ${
                    channels.includes(c) ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Target Persona (optional)</label>
            <input value={persona} onChange={(e) => setPersona(e.target.value)} placeholder="e.g. D2C Founders" className="input-premium" />
          </div>

          {generate.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{generate.error?.message}</p>
            </div>
          )}

          <button disabled={generate.isPending || !name.trim() || !goal.trim()} className="btn-primary w-full">
            <Sparkles size={14} />
            {generate.isPending ? 'Planning…' : 'Generate Plan'}
          </button>
        </form>
      </div>

      {active && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 animate-scale-in">
          {active.plan_summary && <p className="text-sm text-slate-600 leading-relaxed mb-4">{active.plan_summary}</p>}
          {items.length === 0 ? (
            <p className="text-xs text-slate-400">No calendar items generated.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th className="py-2 pr-3">Week</th>
                    <th className="py-2 pr-3">Channel</th>
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Topic</th>
                    <th className="py-2 pr-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b border-slate-50 align-top">
                      <td className="py-3 pr-3 text-xs text-slate-500 whitespace-nowrap">{item.week ?? '—'}</td>
                      <td className="py-3 pr-3">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                          {item.channel || '—'}
                        </span>
                      </td>
                      <td className="py-3 pr-3 text-xs text-slate-600">{item.content_type || '—'}</td>
                      <td className="py-3 pr-3 text-xs text-slate-700 max-w-xs">{item.topic || item.notes || '—'}</td>
                      <td className="py-3 pr-3 min-w-[140px]">
                        {active.id != null && (
                          <ConvertRow planId={active.id} itemIndex={i} item={item} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <h4 className="font-bold text-slate-800 text-sm mb-4">Saved Plans</h4>
        {!plans?.length ? (
          <p className="text-xs text-slate-400 text-center py-6">No plans yet</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {plans.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelected({ ...p.output, id: p.id, name: p.name, goal: p.goal, timeframe: p.timeframe })}
                className="text-left p-3 rounded-xl bg-slate-50 hover:bg-amber-50/50 border border-transparent hover:border-amber-100 transition-all animate-fade-in"
                style={{ animationDelay: `${i * 40}ms` }}
              >
                <p className="text-xs font-semibold text-slate-700 truncate">{p.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">{p.timeframe} · {new Date(p.created_at).toLocaleDateString()}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
