'use client';
import { useEffect, useState } from 'react';
import { X, Target, Building2, Wallet, Radio, Send, CheckCircle2, AlertTriangle, Zap, Package } from 'lucide-react';
import { useScoreLeadFit, useApplyRecommendation } from '@/lib/queries/aiAgents';
import { useUpdateLead } from '@/lib/queries/crm';
import { useProducts } from '@/lib/queries/products';
import { StallRiskChip } from './FitScorerPanel';

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

const TIER_TONE = { hot: 'text-emerald-600', warm: 'text-amber-600', cold: 'text-slate-500' };
const BAR_TONE = { hot: 'from-emerald-500 to-teal-400', warm: 'from-amber-500 to-orange-400', cold: 'from-slate-400 to-slate-300' };

function Pill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
        active ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

// Slide-over "record" panel for a single lead — this is the ambient AI Sales
// Agent surface: it lives ON the lead, not on a separate agent dashboard. Pick
// the fit signals, get a live score + recommended next action, then apply it
// straight to this lead's CRM record and (optionally) dispatch a follow-up on
// their real channel — all without leaving the Leads table.
export default function LeadDetailDrawer({ lead, onClose, onApplied }) {
  const score = useScoreLeadFit();
  const apply = useApplyRecommendation();
  const updateLead = useUpdateLead();
  const { data: activeProducts } = useProducts('active');

  const [orgSize, setOrgSize] = useState('medium');
  const [budget, setBudget] = useState('high');
  const [channel, setChannel] = useState(lead?.source || 'linkedin');
  const [followUp, setFollowUp] = useState('');
  const [sendFollowUp, setSendFollowUp] = useState(false);
  const [applied, setApplied] = useState(false);
  const [productId, setProductId] = useState(lead?.product_id || '');

  useEffect(() => { setProductId(lead?.product_id || ''); }, [lead?.id, lead?.product_id]);

  // Assigning a product here — rather than only via a raw PUT /leads/:id
  // call — is what lets the Sales Agent's Pipeline-by-Product forecast
  // (SalesWorkspace.jsx Forecasting tab) and per-product revenue targets
  // actually attribute this lead. Saves immediately on change, same as a
  // Pipeline stage drag — no separate "Save" step for a single field.
  const changeProduct = (value) => {
    setProductId(value);
    updateLead.mutate({ id: lead.id, product_id: value || null });
  };

  useEffect(() => {
    if (!lead) return;
    score.mutate({ org_size: orgSize, budget, channel });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, orgSize, budget, channel]);

  useEffect(() => {
    setApplied(false);
    setFollowUp('');
    setSendFollowUp(false);
  }, [lead?.id]);

  if (!lead) return null;

  const out = score.data;
  const value = Math.max(0, Math.min(100, Number(out?.score) || 0));
  const tier = out?.tier || 'cold';

  const doApply = () => {
    apply.mutate(
      {
        leadId: lead.id,
        lead_score: value,
        opportunity_stage: tier === 'hot' ? 'active' : tier === 'warm' ? 'qualified' : 'new',
        follow_up_message: followUp.trim() || undefined,
        channel_type: channel,
        send_follow_up: sendFollowUp && !!followUp.trim(),
      },
      { onSuccess: () => { setApplied(true); onApplied?.(); } },
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-3 z-10">
          <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-600 grid place-items-center font-bold text-sm shrink-0">
            {(lead.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800 truncate">{lead.name || 'Unnamed lead'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[11px] text-slate-400 capitalize truncate">{lead.stage || 'new'} · current score {lead.score ?? '—'}</p>
              <StallRiskChip lastActivityAt={lead.updated_at || lead.created_at} />
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Product / offer assignment */}
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              <Package size={12} /> Product / Offer
            </p>
            <select
              value={productId}
              onChange={(e) => changeProduct(e.target.value)}
              className="input-premium text-sm"
            >
              <option value="">Unassigned</option>
              {(activeProducts || []).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {updateLead.isPending && updateLead.variables?.id === lead.id && (
              <p className="text-[10px] text-slate-400 mt-1">Saving…</p>
            )}
            {updateLead.isError && updateLead.variables?.id === lead.id && (
              <p className="text-[10px] text-red-500 mt-1">Couldn&apos;t save — try again.</p>
            )}
          </div>

          {/* Live AI score */}
          <div className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50/70 to-fuchsia-50/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-violet-100 text-violet-600"><Target size={13} /></div>
              <span className="text-[11px] font-bold text-violet-700 uppercase tracking-wide">AI Fit Score</span>
              <span className={`ml-auto text-xs font-black uppercase tracking-wide ${TIER_TONE[tier]}`}>{tier} lead</span>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className="text-4xl font-black text-slate-800 tabular-nums">{value}</span>
              <span className="text-base font-bold text-slate-300">/100</span>
            </div>
            <div className="h-2.5 rounded-full bg-white overflow-hidden mb-3">
              <div className={`h-full rounded-full bg-gradient-to-r ${BAR_TONE[tier]} transition-all duration-500`} style={{ width: `${value}%` }} />
            </div>
            {out?.recommended_action && (
              <p className="text-xs text-violet-800 font-medium leading-relaxed">{out.recommended_action}</p>
            )}
          </div>

          {/* Fit signals */}
          <div className="space-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Building2 size={12} /> Org size
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ORG_SIZES.map((o) => <Pill key={o.value} label={o.label} active={orgSize === o.value} onClick={() => setOrgSize(o.value)} />)}
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Wallet size={12} /> Budget
              </p>
              <div className="flex flex-wrap gap-1.5">
                {BUDGETS.map((o) => <Pill key={o.value} label={o.label} active={budget === o.value} onClick={() => setBudget(o.value)} />)}
              </div>
            </div>
            <div>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                <Radio size={12} /> Channel
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CHANNELS.map((o) => <Pill key={o.value} label={o.label} active={channel === o.value} onClick={() => setChannel(o.value)} />)}
              </div>
            </div>
          </div>

          {/* Follow-up + apply */}
          <div className="pt-2 border-t border-slate-100 space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Follow-up message (optional)</label>
              <textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                rows={3}
                placeholder="Draft a follow-up to send on their channel…"
                className="input-premium resize-none text-sm"
              />
            </div>
            {followUp.trim() && (
              <label className="flex items-center gap-2 text-xs text-slate-500">
                <input type="checkbox" checked={sendFollowUp} onChange={(e) => setSendFollowUp(e.target.checked)} className="rounded" />
                Also send this on {channel} now
              </label>
            )}

            {apply.isError && (
              <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                <AlertTriangle size={13} className="text-red-500 shrink-0" />
                <p className="text-xs text-red-600">{apply.error?.message}</p>
              </div>
            )}
            {applied ? (
              <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 px-1">
                <CheckCircle2 size={16} /> Applied to CRM
                {apply.data?.follow_up_queued && <span className="text-xs font-normal text-slate-400">· follow-up sent</span>}
              </div>
            ) : (
              <button
                onClick={doApply}
                disabled={apply.isPending}
                className="w-full flex items-center justify-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl bg-violet-600 text-white hover:bg-violet-700 transition-colors disabled:opacity-60"
              >
                <Send size={14} /> {apply.isPending ? 'Applying…' : 'Apply to CRM & Send Reply'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
