'use client';
import { useState } from 'react';
import {
  BarChart3, Sparkles, Search, UserRound, CalendarClock, Target, Activity,
} from 'lucide-react';
import { useMarketingPerformance } from '@/lib/queries/marketingAgent';

const RANGES = [7, 30, 90];

const ARTIFACT_META = [
  { key: 'content_runs', label: 'Content Runs', icon: Sparkles, tone: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'seo_briefs', label: 'SEO Briefs', icon: Search, tone: 'text-emerald-600', bg: 'bg-emerald-50' },
  { key: 'personas', label: 'Persona Sets', icon: UserRound, tone: 'text-violet-600', bg: 'bg-violet-50' },
  { key: 'campaign_plans', label: 'Campaign Plans', icon: CalendarClock, tone: 'text-amber-600', bg: 'bg-amber-50' },
  { key: 'competitor_reports', label: 'Competitor Reports', icon: Target, tone: 'text-rose-600', bg: 'bg-rose-50' },
];

export default function PerformancePanel() {
  const [days, setDays] = useState(30);
  const { data, isLoading } = useMarketingPerformance(days);

  const counts = data?.artifact_counts || {};
  const providers = data?.usage?.providers || [];
  const totalCalls = providers.reduce((n, p) => n + (p.calls || 0), 0);
  const totalFallbacks = providers.reduce((n, p) => n + (p.fallbacks || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600">
            <BarChart3 size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Performance Analytics</h4>
            <p className="text-[11px] text-slate-400">Real usage and reliability — no fabricated metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setDays(r)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                days === r ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {ARTIFACT_META.map(({ key, label, icon: Icon, tone, bg }, i) => (
          <div
            key={key}
            className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`p-2 rounded-xl ${bg} ${tone} w-fit mb-3`}>
              <Icon size={14} />
            </div>
            {isLoading ? (
              <div className="h-6 w-10 skeleton rounded" />
            ) : (
              <p className="text-xl font-bold text-slate-800">{counts[key] ?? 0}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-sky-50 to-violet-100 text-sky-600">
            <Activity size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">LLM Provider Usage</h4>
            <p className="text-[11px] text-slate-400">Marketing agent calls over the last {days} days</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <div key={i} className="h-10 skeleton rounded-xl" />)}
          </div>
        ) : providers.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No provider calls recorded yet for this range</p>
        ) : (
          <>
            <div className="flex items-center gap-6 mb-4">
              <div>
                <p className="text-lg font-bold text-slate-800">{totalCalls}</p>
                <p className="text-[10px] text-slate-400">Total calls</p>
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{totalFallbacks}</p>
                <p className="text-[10px] text-slate-400">Fallback calls</p>
              </div>
            </div>
            <div className="space-y-2">
              {providers.map((p) => (
                <div key={p.provider} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-50">
                  <span className="text-xs font-semibold text-slate-700 capitalize">{p.provider}</span>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>{p.calls} calls</span>
                    {p.fallbacks > 0 && <span className="text-amber-600">{p.fallbacks} fallback</span>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
