'use client';
import { useMemo, useState } from 'react';
import {
  Megaphone, Sparkles, Users2, Database, FileText,
  AlertTriangle, Send, ChevronRight, Zap, LayoutDashboard, Search,
  UserRound, CalendarClock, Target, BarChart3,
  Bot, ShieldCheck, MessageCircle, Radar, Radio,
} from 'lucide-react';
import {
  useRunMarketingAgent, useMarketingRuns, useKnowledgeSources,
} from '@/lib/queries/aiAgents';
import { useLeads, useContacts, useCampaigns } from '@/lib/queries/crm';
import WorkspaceHeader from './shared/WorkspaceHeader';
import WorkspaceNav from './shared/WorkspaceNav';
import MarketingRunResult from './MarketingRunResult';
import MarketingOverview from './marketing/MarketingOverview';
import SEOPanel from './marketing/SEOPanel';
import AEOPanel from './marketing/AEOPanel';
import AntiBanPanel from './marketing/AntiBanPanel';
import ClickToWhatsAppPanel from './marketing/ClickToWhatsAppPanel';
import ColdRevivalPanel from './marketing/ColdRevivalPanel';
import PersonaPanel from './marketing/PersonaPanel';
import CampaignPlannerPanel from './marketing/CampaignPlannerPanel';
import BroadcastComposer from './marketing/BroadcastComposer';
import CompetitorPanel from './marketing/CompetitorPanel';
import PerformancePanel from './marketing/PerformancePanel';

const CAMPAIGN_TYPES = ['Lead Generation', 'Product Launch', 'Re-engagement', 'Event Promotion', 'Brand Awareness'];
const GOALS = ['Get more leads', 'Increase awareness', 'Drive conversions', 'Nurture existing leads'];

const CHANNEL_COLORS = {
  whatsapp: 'bg-emerald-100 text-emerald-700',
  instagram: 'bg-pink-100 text-pink-700',
  email: 'bg-violet-100 text-violet-700',
  sms: 'bg-amber-100 text-amber-700',
  default: 'bg-slate-100 text-slate-600',
};

// Two-tier navigation: 11 tools grouped into 6 logical categories so the
// workspace reads as a structured toolkit instead of a flat pill soup.
// Top tier = category; second tier = the tools inside the active category
// (shown only when a category holds more than one tool).
const NAV_GROUPS = [
  {
    key: 'overview', label: 'Overview', icon: LayoutDashboard,
    items: [{ key: 'overview', label: 'Overview', icon: LayoutDashboard }],
  },
  {
    key: 'create', label: 'Create', icon: Sparkles,
    hint: 'Generate & optimize content',
    items: [
      { key: 'content', label: 'Content Generator', icon: Sparkles },
      { key: 'seo', label: 'SEO & Briefs', icon: Search },
      { key: 'aeo', label: 'AEO Citation Engine', icon: Bot },
    ],
  },
  {
    key: 'distribute', label: 'Distribute', icon: Send,
    hint: 'Reach & re-engage leads',
    items: [
      { key: 'broadcast', label: 'Broadcast Composer', icon: Radio },
      { key: 'ctwa', label: 'Click-to-WhatsApp Ads', icon: MessageCircle },
      { key: 'planner', label: 'Campaign Planner', icon: CalendarClock },
      { key: 'revival', label: 'Cold Lead Revival', icon: Radar },
    ],
  },
  {
    key: 'safeguard', label: 'Safeguard', icon: ShieldCheck,
    hint: 'Deliverability protection',
    items: [{ key: 'antiban', label: 'Meta Anti-Ban Check', icon: ShieldCheck }],
  },
  {
    key: 'research', label: 'Research', icon: Target,
    hint: 'Know your audience & rivals',
    items: [
      { key: 'personas', label: 'Personas & ICP', icon: UserRound },
      { key: 'competitor', label: 'Competitor Intelligence', icon: Target },
    ],
  },
  {
    key: 'analyze', label: 'Analyze', icon: BarChart3,
    hint: 'Measure performance',
    items: [{ key: 'performance', label: 'Performance Analytics', icon: BarChart3 }],
  },
];


export default function MarketingWorkspace() {
  const [tab, setTab] = useState('overview');

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

      <WorkspaceHeader
        agent="marketing"
        icon={Megaphone}
        title="Marketing Agent"
        subtitle="AI-powered campaigns grounded in your knowledge base"
      />

      <WorkspaceNav groups={NAV_GROUPS} active={tab} onSelect={setTab} />

      {tab === 'overview' && (
        <MarketingOverview
          leadCount={leadCount}
          contactCount={contactCount}
          campaignCount={campaignCount}
          chunkCount={chunkCount}
          runCount={runCount}
          runs={runs}
        />
      )}

      {tab === 'seo' && <SEOPanel />}
      {tab === 'aeo' && <AEOPanel />}
      {tab === 'antiban' && <AntiBanPanel />}
      {tab === 'broadcast' && <BroadcastComposer />}
      {tab === 'ctwa' && <ClickToWhatsAppPanel />}
      {tab === 'revival' && <ColdRevivalPanel />}
      {tab === 'personas' && <PersonaPanel />}
      {tab === 'planner' && <CampaignPlannerPanel />}
      {tab === 'competitor' && <CompetitorPanel />}
      {tab === 'performance' && <PerformancePanel />}

      {/* Content Generator */}
      {tab === 'content' && (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* Left — generator + segmentation + results */}
        <div className="xl:col-span-2 space-y-6">

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campaign Generator */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
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
                            className="progress-fill bg-gradient-to-r from-violet-500 to-purple-500"
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
            <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-8 text-center animate-scale-in">
              <div className="relative inline-block mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
                  <Sparkles size={24} className="text-violet-500 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-violet-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Generating campaign…</p>
              <p className="text-xs text-slate-400 mt-1">Retrieving knowledge and composing content</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
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
                    className="group flex items-start gap-3 p-3 rounded-xl bg-slate-50 hover:bg-violet-50/50 border border-transparent hover:border-violet-100 transition-all duration-150 cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}
                  >
                    <div className="p-1.5 rounded-lg bg-white shadow-sm shrink-0 mt-0.5">
                      <Zap size={11} className="text-violet-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-700 truncate leading-snug">{r.brief}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <ChevronRight size={13} className="text-slate-300 shrink-0 mt-1 group-hover:text-violet-400 transition-colors" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
