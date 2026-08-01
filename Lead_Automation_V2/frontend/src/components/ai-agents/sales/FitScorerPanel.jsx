'use client';
import { useEffect, useState } from 'react';
import { Target, Zap, TrendingUp, Building2, Wallet, Radio, AlertTriangle } from 'lucide-react';
import { useScoreLeadFit } from '@/lib/queries/aiAgents';

const ORG_SIZES = [
  { value: 'small', label: '1–50' },
  { value: 'medium', label: '50–500' },
  { value: 'enterprise', label: '500+' },
];
const BUDGETS = [
  { value: 'low', label: '<$5k' },
  { value: 'medium', label: '$5k–$20k' },
  { value: 'high', label: '$20k+' },
];
const CHANNELS = [
  { value: 'email', label: 'Email' },
  { value: 'webchat', label: 'Web chat' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'linkedin', label: 'LinkedIn' },
];

const TIER_TONE = {
  hot: 'text-emerald-600',
  warm: 'text-amber-600',
  cold: 'text-slate-500',
};
const BAR_TONE = {
  hot: 'from-emerald-500 to-teal-400',
  warm: 'from-amber-500 to-orange-400',
  cold: 'from-slate-400 to-slate-300',
};

function PillGroup({ icon: Icon, label, options, value, onChange }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
        <Icon size={13} /> {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              value === o.value ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FitScorerPanel() {
  const score = useScoreLeadFit();
  const [orgSize, setOrgSize] = useState('medium');
  const [budget, setBudget] = useState('high');
  const [channel, setChannel] = useState('linkedin');

  // Re-score live whenever any pill changes (debounced by the mutation itself
  // being fast + deterministic on the server).
  useEffect(() => {
    score.mutate({ org_size: orgSize, budget, channel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSize, budget, channel]);

  const out = score.data;
  const value = Math.max(0, Math.min(100, Number(out?.score) || 0));
  const tier = out?.tier || 'cold';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <Target size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Interactive Fit Scorer</h4>
            <p className="text-[11px] text-slate-400">Adjust the signals — the score updates live</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
        <PillGroup icon={Building2} label="Org size" options={ORG_SIZES} value={orgSize} onChange={setOrgSize} />
        <PillGroup icon={Wallet} label="Budget" options={BUDGETS} value={budget} onChange={setBudget} />
        <PillGroup icon={Radio} label="Inbound channel" options={CHANNELS} value={channel} onChange={setChannel} />

        {score.isError && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{score.error?.message}</p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-end justify-between mb-1">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">AI fit score</p>
          <span className={`text-xs font-black uppercase tracking-wide ${TIER_TONE[tier]}`}>{tier} lead</span>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-5xl font-black text-slate-800 tabular-nums">{value}</span>
          <span className="text-lg font-bold text-slate-300">/100</span>
        </div>
        <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
          <div className={`h-full rounded-full bg-gradient-to-r ${BAR_TONE[tier]} transition-all duration-500`} style={{ width: `${value}%` }} />
        </div>

        {out?.tier_reason && (
          <p className="text-sm text-slate-600 leading-relaxed mt-4">{out.tier_reason}</p>
        )}

        {Array.isArray(out?.factors) && out.factors.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Score breakdown</p>
            {out.factors.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-500">{f.label}: <b className="text-slate-700">{f.value}</b></span>
                <span className="font-bold text-violet-600 tabular-nums">+{f.points}</span>
              </div>
            ))}
          </div>
        )}

        {out?.recommended_action && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-violet-50/60 border border-violet-100 p-3">
            <TrendingUp size={14} className="text-violet-500 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-800 font-medium">{out.recommended_action}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Client-side pipeline-stall risk chip — surfaced next to a lead score. Exported
// so the lead list / run result can reuse the exact same rule.
export function StallRiskChip({ lastActivityAt, stage }) {
  if (!lastActivityAt) return null;
  const days = Math.floor((Date.now() - new Date(lastActivityAt)) / 86400000);
  if (days < 3) return null;
  const tone = days >= 10 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200';
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${tone}`}>
      <Zap size={10} /> Stalled {days}d{stage ? `: ${stage}` : ''}
    </span>
  );
}
