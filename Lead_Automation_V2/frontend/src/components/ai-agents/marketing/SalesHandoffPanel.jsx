'use client';
import { useState } from 'react';
import {
  UserCheck, Sparkles, AlertTriangle, CheckCircle2, TrendingUp,
} from 'lucide-react';
import { useGenerateSalesHandoff } from '@/lib/queries/marketingAgent';
import { useCampaigns } from '@/lib/queries/crm';

const STATUS_TONE = {
  sent: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-violet-50 text-violet-700',
  draft: 'bg-slate-100 text-slate-600',
  needs_approval: 'bg-amber-50 text-amber-700',
  failed: 'bg-red-50 text-red-700',
};

export default function SalesHandoffPanel() {
  const generate = useGenerateSalesHandoff();
  const { data: campaigns } = useCampaigns();
  const [campaignId, setCampaignId] = useState('');
  const [note, setNote] = useState('');

  const submit = (e) => {
    e.preventDefault();
    generate.mutate({ campaign_id: campaignId || undefined, note: note.trim() || undefined });
  };

  const out = generate.data;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-teal-50 to-emerald-100 text-teal-600">
            <UserCheck size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Sales Conversion Handoff</h4>
            <p className="text-[11px] text-slate-400">Real campaign → lead → order data, narrated for sales</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        <form onSubmit={submit} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Campaign (optional)
              </label>
              <select value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className="input-premium">
                <option value="">All recent campaigns</option>
                {(Array.isArray(campaigns) ? campaigns : []).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                Note for sales (optional)
              </label>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. quarterly review" className="input-premium" />
            </div>
          </div>

          {generate.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{generate.error?.message}</p>
            </div>
          )}

          <button disabled={generate.isPending} className="btn-primary w-full">
            <Sparkles size={14} />
            {generate.isPending ? 'Drafting…' : 'Draft Handoff Brief'}
          </button>
        </form>
      </div>

      {out && (
        <div className="space-y-6 animate-scale-in">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-800">
              Brief saved — it also appears in the Handoff Queue for your sales team.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                <TrendingUp size={15} />
              </div>
              <p className="text-sm font-bold text-slate-800">{out.headline_stat}</p>
            </div>
            {out.summary && <p className="text-sm text-slate-600 leading-relaxed">{out.summary}</p>}
            {out.recommended_next_step && (
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Recommended Next Step</p>
                <p className="text-sm text-slate-700">{out.recommended_next_step}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <h4 className="font-bold text-slate-800 text-sm mb-4">Campaign → Lead → Order Data</h4>
            {out.campaign_data.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No campaign data found</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th className="py-2 pr-3">Campaign</th>
                      <th className="py-2 pr-3">Channel</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Reached</th>
                      <th className="py-2 pr-3">Leads</th>
                      <th className="py-2 pr-3">Converted</th>
                      <th className="py-2 pr-3">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {out.campaign_data.map((c) => (
                      <tr key={c.id} className="border-b border-slate-50">
                        <td className="py-3 pr-3 text-xs font-medium text-slate-700 max-w-xs truncate">{c.name}</td>
                        <td className="py-3 pr-3">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">
                            {c.channel_type}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_TONE[c.status] || STATUS_TONE.draft}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-600">{c.audience_count}</td>
                        <td className="py-3 pr-3 text-xs text-slate-600">{c.lead_count}</td>
                        <td className="py-3 pr-3 text-xs text-slate-600">{c.converted_count}</td>
                        <td className="py-3 pr-3 text-xs font-semibold text-slate-700">
                          {'₹'}{Number(c.converted_revenue).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
