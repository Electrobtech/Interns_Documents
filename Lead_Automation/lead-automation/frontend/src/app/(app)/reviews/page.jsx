'use client';
import { Suspense, useState } from 'react';
import { Star, Megaphone, Sparkles, AlertTriangle, Smile, MessageSquareReply, TrendingUp } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import GoogleReviewsPanel from '@/components/googleReviews/GoogleReviewsPanel';
import { reviews, social } from '@/lib/resources';
import { useRunMarketingAgent, useMarketingRuns } from '@/lib/queries/aiAgents';

/* ─── Marketing Agent sentiment + reply panel ─ */
function MarketingAgentPanel() {
  const run = useRunMarketingAgent();
  const { data: runsData } = useMarketingRuns();
  const [brief, setBrief] = useState('');
  const runs = Array.isArray(runsData) ? runsData : [];
  const out  = run.data;

  const submit = (e) => {
    e.preventDefault();
    if (!brief.trim()) return;
    run.mutate(brief.trim());
  };

  const SENTIMENT_CFG = {
    positive: { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', label: 'Positive ✓' },
    neutral:  { cls: 'text-amber-700  bg-amber-50  border-amber-200',  label: 'Neutral'   },
    negative: { cls: 'text-red-700    bg-red-50    border-red-200',    label: 'Negative !'  },
    unknown:  { cls: 'text-slate-600  bg-slate-100 border-slate-200',  label: 'Unknown'   },
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
      {/* form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
            <Sparkles size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Marketing Agent — Review Analyser</h4>
            <p className="text-[11px] text-slate-400">Paste a review or social comment — AI analyses sentiment and drafts a reply</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />
        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
              Review / Comment / Scenario *
            </label>
            <textarea required rows={5} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Analyse sentiment and draft a reply for: 'Delivery was late and packaging was damaged…'"
              className="input-premium resize-none" />
          </div>
          {run.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{run.error?.message}</p>
            </div>
          )}
          <button disabled={run.isPending || !brief.trim()} className="btn-primary w-full">
            <Sparkles size={14} />
            {run.isPending ? 'Analysing…' : 'Analyse & Draft Reply'}
          </button>
        </form>
      </div>

      {/* result */}
      <div className="space-y-4">
        {run.isPending && (
          <div className="bg-white rounded-2xl border border-blue-100 shadow-card p-8 text-center animate-scale-in">
            <div className="relative inline-block mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                <Sparkles size={22} className="text-blue-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-blue-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Analysing sentiment…</p>
            <div className="flex justify-center gap-1.5 mt-3">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {out && (
          <div className="space-y-3 animate-slide-up">
            {/* sentiment */}
            {out.sentiment_analysis?.overall && (() => {
              const cfg = SENTIMENT_CFG[out.sentiment_analysis.overall] || SENTIMENT_CFG.unknown;
              return (
                <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.cls}`}>
                  <Smile size={15} className="shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{cfg.label}</p>
                    {out.sentiment_analysis.notes && (
                      <p className="text-xs mt-0.5 opacity-80">{out.sentiment_analysis.notes}</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* review replies */}
            {out.review_replies?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <MessageSquareReply size={14} className="text-blue-500" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Reply Drafts</p>
                </div>
                <div className="space-y-3">
                  {out.review_replies.map((r, i) => (
                    <div key={i} className="rounded-xl border border-slate-100 overflow-hidden">
                      <div className="bg-slate-50 px-3 py-1.5">
                        <p className="text-[10px] font-bold text-slate-500 uppercase">{r.scenario}</p>
                      </div>
                      <div className="px-3 py-2.5">
                        <p className="text-sm text-slate-700 leading-relaxed">{r.reply}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">AI-generated — review before publishing.</p>
              </div>
            )}

            {/* campaign summary */}
            {out.campaign_summary && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">Campaign Insight</p>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{out.campaign_summary}</p>
              </div>
            )}

            {/* next best actions */}
            {out.next_best_actions?.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Next Best Actions</p>
                <ul className="space-y-1.5">
                  {out.next_best_actions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[9px] font-bold mt-0.5">{i+1}</span>
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!out && !run.isPending && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col items-center justify-center py-14 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 mb-3">
              <Smile size={22} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">Paste a review to get AI sentiment + reply draft</p>
          </div>
        )}
      </div>

      {/* recent runs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
            <Megaphone size={14} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">Recent Analyses</p>
            <p className="text-[11px] text-slate-400">{runs.length} total</p>
          </div>
        </div>
        {!runs.length
          ? <p className="text-xs text-slate-400 text-center py-6">No analyses yet</p>
          : (
            <div className="space-y-2">
              {runs.slice(0, 6).map((r) => {
                const s = r.output?.sentiment_analysis?.overall;
                const sentCls = s === 'positive' ? 'bg-emerald-50 text-emerald-700'
                  : s === 'negative' ? 'bg-red-50 text-red-700'
                  : 'bg-slate-100 text-slate-500';
                return (
                  <div key={r.id}
                    className="p-3 rounded-xl bg-slate-50 hover:bg-blue-50/40 border border-transparent hover:border-blue-100 transition-all">
                    <div className="flex items-center gap-2 mb-1">
                      {s && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${sentCls}`}>{s}</span>}
                      <span className="text-[10px] text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs text-slate-700 truncate">{r.brief}</p>
                  </div>
                );
              })}
            </div>
          )
        }
      </div>
    </div>
  );
}

/* ─── page ──────────────────────────── */
export default function ReviewsPage() {
  return (
    <Tabs title="Reviews & Social" icon={Star} tabs={[
      {
        label: 'Google Reviews',
        icon: Star,
        render: () => (
          <Suspense fallback={<p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}>
            <GoogleReviewsPanel />
          </Suspense>
        ),
      },
      { label: 'Reviews',         render: () => <CrudPage {...reviews} header={false} /> },
      { label: 'Social Comments', icon: MessageSquareReply, render: () => <CrudPage {...social} header={false} /> },
      { label: 'AI Sentiment',    icon: Sparkles, render: () => <MarketingAgentPanel /> },
    ]} />
  );
}
