'use client';
import { useMemo, useState } from 'react';
import {
  TrendingUp, Sparkles, Target, Flame, Snowflake, Sun, ListChecks,
  HelpCircle, AlertTriangle, UserCheck, Mail, Users, Trophy, Gauge,
  Kanban, ChevronRight, ArrowRight, Zap,
} from 'lucide-react';
import { useRunSalesAgent, useSalesRuns } from '@/lib/queries/aiAgents';
import { useLeads } from '@/lib/queries/crm';
import KpiCard from './KpiCard';
import KnowledgeUploadPanel from './KnowledgeUploadPanel';

const STAGES = ['new', 'qualified', 'active', 'won'];

const STAGE_CONFIG = {
  new:       { color: 'bg-slate-100 text-slate-600',   dot: 'bg-slate-400',   bar: 'from-slate-400 to-slate-500' },
  qualified: { color: 'bg-blue-50 text-blue-700',      dot: 'bg-blue-500',    bar: 'from-blue-500 to-indigo-500' },
  active:    { color: 'bg-amber-50 text-amber-700',    dot: 'bg-amber-500',   bar: 'from-amber-500 to-orange-500' },
  won:       { color: 'bg-emerald-50 text-emerald-700',dot: 'bg-emerald-500', bar: 'from-emerald-500 to-teal-500' },
};

function scoreTone(score) {
  if (score >= 70) return { bg: 'bg-red-50 text-red-700', bar: 'bg-gradient-to-r from-red-500 to-rose-500', ring: 'ring-red-200' };
  if (score >= 40) return { bg: 'bg-amber-50 text-amber-700', bar: 'bg-gradient-to-r from-amber-500 to-orange-400', ring: 'ring-amber-200' };
  return { bg: 'bg-blue-50 text-blue-700', bar: 'bg-gradient-to-r from-blue-400 to-blue-500', ring: 'ring-blue-200' };
}

function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

function ResultSection({ icon: Icon, title, accentColor = 'text-emerald-600', children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`p-1.5 rounded-lg bg-emerald-50 ${accentColor}`}>
          <Icon size={14} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
      </div>
      {children}
    </div>
  );
}

export default function SalesWorkspace() {
  const run = useRunSalesAgent();
  const { data: runsData } = useSalesRuns();
  const { data: leadsData } = useLeads();

  const [brief, setBrief] = useState('');
  const [leadName, setLeadName] = useState('');
  const [company, setCompany] = useState('');

  const leads = Array.isArray(leadsData) ? leadsData : [];
  const runs = Array.isArray(runsData) ? runsData : [];

  const { temperature, byStage, avgScore } = useMemo(() => {
    const temp = { hot: 0, warm: 0, cold: 0 };
    const stages = Object.fromEntries(STAGES.map((s) => [s, []]));
    let scoreSum = 0, scored = 0;
    for (const lead of leads) {
      if (lead.score != null) {
        scoreSum += lead.score;
        scored += 1;
        if (lead.score >= 70) temp.hot += 1;
        else if (lead.score >= 40) temp.warm += 1;
        else temp.cold += 1;
      }
      if (lead.stage in stages) stages[lead.stage].push(lead);
    }
    return { temperature: temp, byStage: stages, avgScore: scored ? Math.round(scoreSum / scored) : null };
  }, [leads]);

  const sortedLeads = useMemo(
    () => [...leads].sort((a, b) => (b.score ?? -1) - (a.score ?? -1)).slice(0, 6),
    [leads],
  );

  const submit = (e) => {
    e.preventDefault();
    if (!brief.trim()) return;
    run.mutate({ brief: brief.trim(), lead_name: leadName.trim() || null, company: company.trim() || null });
  };

  const out = run.data;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 p-6 shadow-emerald">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 30% 70%, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30">
            <TrendingUp size={22} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Sales Agent</h3>
            <p className="text-emerald-200 text-sm mt-0.5">Qualify, score, and close deals with AI precision</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-white text-xs font-medium">Agent Online</span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { icon: Users,    label: 'Total Leads',    tone: 'brand',   value: leads.length, loading: leadsData === undefined },
          { icon: Gauge,    label: 'Avg Lead Score', tone: 'amber',   value: avgScore ?? '—', loading: leadsData === undefined },
          { icon: Target,   label: 'Qualified',      tone: 'emerald', value: byStage.qualified?.length ?? 0, loading: leadsData === undefined },
          { icon: Trophy,   label: 'Won',            tone: 'emerald', value: byStage.won?.length ?? 0, loading: leadsData === undefined },
          { icon: Sparkles, label: 'AI Analyses',    tone: 'brand',   value: runs.length, loading: runsData === undefined },
        ].map(({ icon, label, tone, value, loading }, i) => (
          <div key={label} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <KpiCard icon={icon} label={label} tone={tone} value={value} loading={loading} />
          </div>
        ))}
      </div>

      {/* Pipeline overview row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Lead Scoring */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
              <Gauge size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Lead Scoring</h4>
              <p className="text-[11px] text-slate-400">Ranked by AI score</p>
            </div>
          </div>
          {sortedLeads.length === 0 ? (
            <div className="text-center py-8">
              <div className="p-3 rounded-xl bg-slate-50 w-fit mx-auto mb-2"><Users size={18} className="text-slate-300" /></div>
              <p className="text-xs text-slate-400">No leads yet</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {sortedLeads.map((lead) => {
                const tone = scoreTone(lead.score ?? 0);
                const pct = Math.min(lead.score ?? 0, 100);
                return (
                  <div key={lead.id} className="group">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-slate-700 truncate flex-1 mr-2">{lead.name || 'Unnamed'}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ring-1 ${tone.bg} ${tone.ring}`}>
                        {lead.score ?? '—'}
                      </span>
                    </div>
                    <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full ${tone.bar} transition-all duration-700`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Temperature */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-50 to-orange-100 text-red-500">
              <Flame size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Lead Temperature</h4>
              <p className="text-[11px] text-slate-400">Hot ≥70 · Warm 40–69 · Cold &lt;40</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { icon: Flame,     label: 'Hot Leads',  value: temperature.hot,  bg: 'bg-gradient-to-r from-red-50 to-rose-50', border: 'border-red-100',    icon_bg: 'bg-red-100 text-red-600',    val_cls: 'text-red-700 bg-red-100' },
              { icon: Sun,       label: 'Warm Leads', value: temperature.warm, bg: 'bg-gradient-to-r from-amber-50 to-orange-50', border: 'border-amber-100', icon_bg: 'bg-amber-100 text-amber-600', val_cls: 'text-amber-700 bg-amber-100' },
              { icon: Snowflake, label: 'Cold Leads', value: temperature.cold, bg: 'bg-gradient-to-r from-blue-50 to-sky-50',  border: 'border-blue-100',   icon_bg: 'bg-blue-100 text-blue-500',  val_cls: 'text-blue-700 bg-blue-100' },
            ].map(({ icon: Ic, label, value, bg, border, icon_bg, val_cls }) => (
              <div key={label} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${bg} ${border}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-lg ${icon_bg}`}>
                    <Ic size={14} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{label}</span>
                </div>
                <span className={`text-sm font-bold px-2.5 py-0.5 rounded-lg ${val_cls}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Board */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
              <Kanban size={15} />
            </div>
            <div>
              <h4 className="font-bold text-slate-800 text-sm">Pipeline Board</h4>
              <p className="text-[11px] text-slate-400">{leads.length} leads across stages</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {STAGES.map((stage) => {
              const cfg = STAGE_CONFIG[stage];
              const count = byStage[stage]?.length ?? 0;
              return (
                <div key={stage} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 hover:bg-white hover:shadow-card transition-all duration-150">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="text-[10px] font-bold uppercase text-slate-500 tracking-wide">{stage}</span>
                    </div>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${cfg.color}`}>{count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-slate-200 overflow-hidden mb-2">
                    <div className={`h-full rounded-full bg-gradient-to-r ${cfg.bar} transition-all duration-700`}
                      style={{ width: leads.length ? `${(count / leads.length) * 100}%` : '0%' }} />
                  </div>
                  {(byStage[stage] || []).slice(0, 2).map((lead) => (
                    <p key={lead.id} className="text-[10px] text-slate-500 truncate">{lead.name || 'Unnamed'}</p>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-2 space-y-6">

          {/* Analyze a Lead */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
                <Sparkles size={15} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Analyze a Lead</h4>
                <p className="text-[11px] text-slate-400">AI scores the lead and drafts a follow-up from your documents</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />
            <form onSubmit={submit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Lead Name</label>
                  <input value={leadName} onChange={(e) => setLeadName(e.target.value)} placeholder="Optional" className="input-premium" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Company</label>
                  <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Optional" className="input-premium" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Lead Context *</label>
                <textarea
                  required rows={3} value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  placeholder="e.g. Asked about enterprise pricing twice this week, mentioned a Q3 budget…"
                  className="input-premium resize-none"
                />
              </div>
              {run.isError && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                  <AlertTriangle size={13} className="text-red-500 shrink-0" />
                  <p className="text-xs text-red-600">{run.error?.message}</p>
                </div>
              )}
              <button disabled={run.isPending || !brief.trim()} className="btn-emerald w-full">
                <Sparkles size={14} />
                {run.isPending ? 'Analyzing…' : 'Analyze Lead'}
              </button>
            </form>
          </div>

          {/* Loading */}
          {run.isPending && (
            <div className="bg-white rounded-2xl border border-emerald-100 shadow-card p-8 text-center animate-scale-in">
              <div className="relative inline-block mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
                  <Sparkles size={24} className="text-emerald-500 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-emerald-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Scoring lead…</p>
              <p className="text-xs text-slate-400 mt-1">Retrieving knowledge and analysing buying signals</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {out && (
            <div className="space-y-4 animate-slide-up">
              {out.human_handoff && (
                <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <UserCheck size={16} className="text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-800 font-medium">This lead needs human review before acting.</p>
                </div>
              )}

              {/* Score card */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <div className="flex items-center gap-5">
                  {(() => {
                    const tone = scoreTone(out.lead_score ?? 0);
                    return (
                      <div className={`w-20 h-20 rounded-2xl flex flex-col items-center justify-center font-bold shrink-0 ring-2 ${tone.bg} ${tone.ring}`}>
                        <span className="text-3xl leading-none">{out.lead_score ?? '—'}</span>
                        <span className="text-[9px] uppercase tracking-widest mt-0.5 opacity-70">Score</span>
                      </div>
                    );
                  })()}
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1">AI Lead Score</p>
                    <p className="text-sm text-slate-700">{out.lead_qualification_reason}</p>
                    {out.opportunity_stage && (
                      <span className="inline-flex items-center gap-1 mt-2 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 capitalize">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        {out.opportunity_stage}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {!isEmpty(out.buying_intent_summary) && (
                <ResultSection icon={Flame} title="Buying Intent">
                  <p className="text-sm text-slate-600 leading-relaxed">{out.buying_intent_summary}</p>
                </ResultSection>
              )}
              {!isEmpty(out.recommended_sales_action) && (
                <ResultSection icon={Target} title="Recommended Action">
                  <p className="text-sm text-slate-600 leading-relaxed">{out.recommended_sales_action}</p>
                </ResultSection>
              )}
              {!isEmpty(out.follow_up_message) && (
                <ResultSection icon={Mail} title="Follow-up Draft">
                  <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line border border-slate-100">
                    {out.follow_up_message}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-amber-400" />
                    AI-generated — review before sending via Unified Inbox.
                  </p>
                </ResultSection>
              )}
              {!isEmpty(out.next_best_actions) && (
                <ResultSection icon={ListChecks} title="Next Best Actions">
                  <ul className="space-y-2">
                    {(out.next_best_actions || []).map((a, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
              {!isEmpty(out.follow_up_questions) && (
                <ResultSection icon={HelpCircle} title="Follow-up Questions">
                  <ul className="space-y-2">
                    {(out.follow_up_questions || []).map((q, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <span className="flex-shrink-0 text-amber-500 font-bold mt-0.5">?</span>
                        {q}
                      </li>
                    ))}
                  </ul>
                </ResultSection>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
                <Sparkles size={15} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">AI Sales Insights</h4>
                <p className="text-[11px] text-slate-400">Past analyses</p>
              </div>
            </div>
            {!runs.length ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-xl bg-slate-50 w-fit mx-auto mb-2">
                  <Sparkles size={18} className="text-slate-300" />
                </div>
                <p className="text-xs text-slate-400">No analyses yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 6).map((r, i) => (
                  <div key={r.id}
                    className="group p-3 rounded-xl bg-slate-50 hover:bg-emerald-50/50 border border-transparent hover:border-emerald-100 transition-all duration-150 cursor-pointer"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="flex items-start gap-2 mb-1.5">
                      <div className="p-1 rounded-md bg-white shadow-sm shrink-0 mt-0.5">
                        <Zap size={10} className="text-emerald-500" />
                      </div>
                      <p className="text-xs font-semibold text-slate-700 truncate">{r.brief}</p>
                    </div>
                    {r.output?.recommended_sales_action && (
                      <p className="text-[10px] text-slate-500 line-clamp-2 pl-6">{r.output.recommended_sales_action}</p>
                    )}
                    <div className="flex items-center justify-between mt-2 pl-6">
                      {r.output?.lead_score != null && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${scoreTone(r.output.lead_score).bg}`}>
                          Score {r.output.lead_score}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">{new Date(r.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <KnowledgeUploadPanel agentType="sales" />
        </div>
      </div>
    </div>
  );
}
