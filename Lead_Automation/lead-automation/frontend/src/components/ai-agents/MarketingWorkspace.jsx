'use client';
import { useMemo, useState } from 'react';
import {
  Megaphone, Sparkles, Users, Users2, Database, FileText,
  AlertTriangle, Send, TrendingUp, Clock, ChevronRight, Zap,
} from 'lucide-react';
import {
  useRunMarketingAgent, useMarketingRuns, useKnowledgeSources,
} from '@/lib/queries/aiAgents';
import { useLeads, useContacts, useCampaigns } from '@/lib/queries/crm';
import KpiCard from './KpiCard';
import KnowledgeUploadPanel from './KnowledgeUploadPanel';
import MarketingRunResult from './MarketingRunResult';

const CAMPAIGN_TYPES = ['Lead Generation', 'Product Launch', 'Re-engagement', 'Event Promotion', 'Brand Awareness'];
const GOALS = ['Get more leads', 'Increase awareness', 'Drive conversions', 'Nurture existing leads'];

const CHANNEL_COLORS = {
  whatsapp: 'bg-emerald-100 text-emerald-700',
  instagram: 'bg-pink-100 text-pink-700',
  email: 'bg-blue-100 text-blue-700',
  sms: 'bg-amber-100 text-amber-700',
  default: 'bg-slate-100 text-slate-600',
};

export default function MarketingWorkspace() {
  const run = useRunMarketingAgent();
  const { data: runs } = useMarketingRuns();
  const { data: leads } = useLeads();
  const { data: contacts } = useContacts();
  const { data: campaigns } = useCampaigns();
  const { data: knowledge } = useKnowledgeSources('marketing');

  const [campaignType, setCampaignType] = useState(CAMPAIGN_TYPES[0]);
  const [industry, setIndustry] = useState('');
  const [goal, setGoal] = useState(GOALS[0]);
  const [details, setDetails] = useState('');
  const [ragQuestion, setRagQuestion] = useState('');

  const leadCount = Array.isArray(leads) ? leads.length : undefined;
  const contactCount = Array.isArray(contacts) ? contacts.length : undefined;
  const campaignCount = Array.isArray(campaigns) ? campaigns.length : undefined;
  const chunkCount = Array.isArray(knowledge)
    ? knowledge.reduce((n, s) => n + (s.chunk_count || 0), 0)
    : undefined;
  const runCount = Array.isArray(runs) ? runs.length : undefined;

  const segments = useMemo(() => {
    const list = Array.isArray(contacts) ? contacts : [];
    const groups = new Map();
    for (const c of list) {
      const key = c.source || 'unknown';
      groups.set(key, (groups.get(key) || 0) + 1);
    }
    const total = list.length || 1;
    return Array.from(groups.entries())
      .map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  }, [contacts]);

  const generateCampaign = (e) => {
    e.preventDefault();
    const brief = [
      `Campaign type: ${campaignType}.`,
      industry.trim() && `Industry: ${industry.trim()}.`,
      `Goal: ${goal}.`,
      details.trim() && `Details: ${details.trim()}`,
    ].filter(Boolean).join(' ');
    run.mutate(brief);
  };

  const askRag = (e) => {
    e.preventDefault();
    if (ragQuestion.trim()) {
      run.mutate(ragQuestion.trim());
      setRagQuestion('');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 p-6 shadow-brand">
        <div className="absolute inset-0 opacity-20"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="absolute right-0 top-0 bottom-0 w-48 opacity-10"
          style={{ background: 'radial-gradient(ellipse at right, white, transparent)' }} />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30">
            <Megaphone size={22} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Marketing Agent</h3>
            <p className="text-blue-200 text-sm mt-0.5">AI-powered campaigns grounded in your knowledge base</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-white text-xs font-medium">Agent Online</span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { icon: Users, label: 'Total Leads', tone: 'brand', value: leadCount },
          { icon: Users2, label: 'Contacts', tone: 'emerald', value: contactCount },
          { icon: Megaphone, label: 'Campaigns', tone: 'amber', value: campaignCount },
          { icon: Database, label: 'Knowledge Chunks', tone: 'brand', value: chunkCount },
          { icon: Sparkles, label: 'AI Generations', tone: 'emerald', value: runCount },
        ].map(({ icon, label, tone, value }, i) => (
          <div key={label} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <KpiCard icon={icon} label={label} tone={tone} value={value} loading={value === undefined} />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* Left — generator + segmentation + results */}
        <div className="xl:col-span-2 space-y-6">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campaign Generator */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
                  <Sparkles size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Campaign Generator</h4>
                  <p className="text-[11px] text-slate-400">AI-powered, grounded in your docs</p>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

              <form onSubmit={generateCampaign} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Campaign Type
                  </label>
                  <select
                    value={campaignType}
                    onChange={(e) => setCampaignType(e.target.value)}
                    className="input-premium"
                  >
                    {CAMPAIGN_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Industry / Audience
                  </label>
                  <input
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    placeholder="e.g. college students, SaaS founders"
                    className="input-premium"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Goal
                  </label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="input-premium"
                  >
                    {GOALS.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Extra Details
                  </label>
                  <textarea
                    rows={2}
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="Optional context…"
                    className="input-premium resize-none"
                  />
                </div>

                {run.isError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                    <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    <p className="text-xs text-red-600">{run.error?.message}</p>
                  </div>
                )}

                <button disabled={run.isPending} className="btn-primary w-full">
                  <Sparkles size={14} />
                  {run.isPending ? 'Generating…' : 'Generate Campaign'}
                </button>
              </form>
            </div>

            {/* Audience Segmentation */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600">
                  <Users2 size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Audience Segments</h4>
                  <p className="text-[11px] text-slate-400">Contacts by acquisition channel</p>
                </div>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

              {segments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="p-3 rounded-2xl bg-slate-50 mb-2">
                    <Users2 size={20} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">No contacts yet</p>
                  <p className="text-xs text-slate-300 mt-0.5">Import contacts to see segments</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {segments.map((s, i) => {
                    const channelCls = CHANNEL_COLORS[s.source] || CHANNEL_COLORS.default;
                    return (
                      <div key={s.source} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${channelCls}`}>
                              {s.source}
                            </span>
                            <span className="text-xs font-medium text-slate-700">{s.count}</span>
                          </div>
                          <span className="text-xs font-semibold text-slate-500">{s.pct}%</span>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-fill bg-gradient-to-r from-blue-500 to-indigo-500"
                            style={{ width: `${s.pct}%`, transitionDelay: `${i * 100}ms` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* RAG Assistant */}
              <div className="mt-6 pt-5 border-t border-slate-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                    <Database size={13} />
                  </div>
                  <p className="text-xs font-bold text-slate-700">RAG Document Assistant</p>
                </div>
                <form onSubmit={askRag} className="flex gap-2">
                  <input
                    value={ragQuestion}
                    onChange={(e) => setRagQuestion(e.target.value)}
                    placeholder="Ask anything from your docs…"
                    className="input-premium flex-1 py-2 text-xs"
                  />
                  <button
                    disabled={run.isPending || !ragQuestion.trim()}
                    className="btn-primary btn-sm px-3 py-2 shrink-0"
                  >
                    <Send size={13} />
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* AI Loading state */}
          {run.isPending && (
            <div className="bg-white rounded-2xl border border-blue-100 shadow-card p-8 text-center animate-scale-in">
              <div className="relative inline-block mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
                  <Sparkles size={24} className="text-blue-500 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-blue-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Generating campaign…</p>
              <p className="text-xs text-slate-400 mt-1">Retrieving knowledge and composing content</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            </div>
          )}

          {run.data && (
            <MarketingRunResult
              out={run.data}
              contacts={Array.isArray(contacts) ? contacts : []}
              onGenerateIdea={(brief) => run.mutate(brief)}
              generating={run.isPending}
            />
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          {/* Content Drafts */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600">
                  <FileText size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Content Drafts</h4>
                  <p className="text-[11px] text-slate-400">Recent AI outputs</p>
                </div>
              </div>
              {runs?.length > 0 && (
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">
                  {runs.length}
                </span>
              )}
            </div>

            {!runs?.length ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-xl bg-slate-50 w-fit mx-auto mb-2">
                  <FileText size={18} className="text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-400">No drafts yet</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Generate a campaign to start</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(runs || []).slice(0, 6).map((r, i) => (
                  <div
                    key={r.id}
                    className="group flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-blue-50/50 border border-transparent hover:border-blue-100 transition-all duration-150 cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="p-1.5 rounded-lg bg-white shadow-sm shrink-0 mt-0.5">
                      <Zap size={11} className="text-blue-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate leading-snug">{r.brief}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1 group-hover:text-blue-400 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <KnowledgeUploadPanel agentType="marketing" />
        </div>
      </div>
    </div>
  );
}
