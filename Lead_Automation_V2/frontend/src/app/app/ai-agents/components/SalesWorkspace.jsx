'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  WorkspaceHeader, TabNav, Card, Badge, SectionTitle, Label, Value,
  KnowledgePanel, BrainLog, TaskQueue, ApprovalQueue, ConfidenceMeter,
  MetricsRow, MiniBarChart, Divider, TimelineItem, Mono,
} from './SharedUI';
import { Mail, MessageSquare, Phone, RefreshCw } from 'lucide-react';
import FitScorerPanel from '@/components/ai-agents/sales/FitScorerPanel';
import DealValueFieldModal from '@/components/ai-agents/sales/DealValueFieldModal';
import ConfidenceSignalModal from '@/components/ai-agents/sales/ConfidenceSignalModal';
import SalesQueueDrawer from '@/components/ai-agents/sales/SalesQueueDrawer';
import SalesExportModal from '@/components/ai-agents/sales/SalesExportModal';
import LeadDetailDrawer from '@/components/ai-agents/sales/LeadDetailDrawer';
import { useLeads, useSendReply, useFindConversationByName } from '@/lib/queries/crm';
import { useFollowUps, useFollowUpCounts } from '@/lib/queries/followUps';
import {
  useHandoffs, useUpdateHandoff, useSalesAgentRuns,
  useSalesAgentConfig, useSalesAgentQueue, useUpdateSalesAgentConfig,
  useKnowledgeSources, useScoreLeadFit, useSalesForecast, useSalesAnalytics,
  useDraftFollowup,
} from '@/lib/queries/aiAgents';

const TABS = ['Overview', 'Pipeline', 'Lead Intelligence', 'Follow-ups', 'Forecasting', 'Knowledge', 'Analytics', 'Settings'];

// Still used by the Knowledge tab's illustrative RAG demo. Overview pulls
// real leads/follow-ups/handoffs/runs instead (see SalesOverview()).
const BRAIN_LOG = [
  { time: '09:40', type: 'retrieve', text: 'Loaded 23 new leads from LinkedIn Campaign #4812 into scoring queue' },
  { time: '09:41', type: 'thinking', text: 'Analyzing firmographic signals: company size, tech stack, funding stage' },
  { time: '09:41', type: 'action', text: 'Running Lead Scoring module — weighting intent signals + CRM history' },
  { time: '09:42', type: 'output', text: '14 leads scored Hot (>80), 6 Warm, 3 Cold — pipeline updated' },
  { time: '09:39', type: 'thinking', text: 'Buying Intent Detection: acme-corp.com visited pricing 4× this week' },
  { time: '09:38', type: 'action', text: 'Follow-up email drafted for 8 hot leads — awaiting approval' },
];

function timeLabel(iso) {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function dateLabel(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const STAGE_ORDER = ['new', 'qualified', 'active', 'won', 'lost'];
const STAGE_LABEL = { new: 'New Leads', qualified: 'Qualified', active: 'Active', won: 'Won', lost: 'Lost' };
const STAGE_COLOR = { new: '#94A3B8', qualified: '#3B6EF0', active: '#F59E0B', won: '#10B981', lost: '#EF4444' };

function tierOf(score) {
  const s = Number(score) || 0;
  return s >= 75 ? 'hot' : s >= 45 ? 'warm' : 'cold';
}

// ─── Sales mock data (used when APIs return empty results) ──────────────────
const MOCK_LEADS = [
  { id: '1', name: 'Priya Sharma',    company: 'TechWave AI',     score: 91, stage: 'qualified', email: 'priya@techwave.ai',   phone: '+91 98765 43210' },
  { id: '2', name: 'Carlos Rivera',   company: 'Apex Solutions',  score: 83, stage: 'active',    email: 'c.rivera@apex.com',   phone: '+1 415 555 0128'  },
  { id: '3', name: 'Lena Fischer',    company: 'GrowthLab GmbH',  score: 78, stage: 'new',       email: 'lena@growthlab.de',   phone: '+49 30 12345678'  },
  { id: '4', name: 'James Okafor',    company: 'Nile Commerce',   score: 62, stage: 'qualified', email: 'j.okafor@nile.ng',    phone: '+234 803 000 0001' },
  { id: '5', name: 'Aiko Tanaka',     company: 'Kyoto Digital',   score: 55, stage: 'active',    email: 'aiko@kyoto.digital',  phone: '+81 3-1234-5678'  },
  { id: '6', name: 'Ben Park',        company: 'Seoulify',        score: 48, stage: 'new',       email: 'ben@seoulify.kr',     phone: '+82 2-555-0001'   },
  { id: '7', name: 'Maria Lopez',     company: 'Nexo Ventures',   score: 34, stage: 'lost',      email: 'maria@nexo.mx',       phone: '+52 55 5555 5555'  },
  { id: '8', name: 'David Chen',      company: 'PivotX Labs',     score: 88, stage: 'won',       email: 'd.chen@pivotx.io',    phone: '+65 9123 4567'    },
  { id: '9', name: 'Sara Müller',     company: 'Datanova GmbH',   score: 76, stage: 'qualified', email: 'sara@datanova.de',    phone: '+49 89 12345678'  },
  { id: '10', name: 'Raj Patel',      company: 'InnoSpark Inc',   score: 29, stage: 'cold',      email: 'raj@innospark.com',   phone: '+91 99887 76543'  },
  { id: '11', name: 'Emma Wilson',    company: 'ScaleUp Co',      score: 95, stage: 'active',    email: 'emma@scaleup.io',     phone: '+44 20 7946 0958' },
  { id: '12', name: 'Tomás García',   company: 'LaunchPad ES',    score: 67, stage: 'new',       email: 'tomas@launchpad.es',  phone: '+34 91 123 45 67' },
];

const MOCK_FOLLOW_UP_COUNTS = { today: 8, overdue: 3, upcoming: 14 };

const MOCK_OVERDUE_FOLLOWS = [
  { id: 'f1', contact_name: 'Priya Sharma',  notes: 'Demo follow-up — sent pricing deck 3 days ago' },
  { id: 'f2', contact_name: 'Carlos Rivera', notes: 'Trial expires tomorrow — check-in needed'       },
  { id: 'f3', contact_name: 'Emma Wilson',   notes: 'Proposal review — no response in 5 days'        },
];

const MOCK_TODAY_FOLLOWS = [
  { id: 'f4', contact_name: 'David Chen',    notes: 'Onboarding call scheduled 3pm'    },
  { id: 'f5', contact_name: 'Sara Müller',   notes: 'Send contract draft'              },
  { id: 'f6', contact_name: 'James Okafor',  notes: 'Qualification call — WhatsApp'   },
  { id: 'f7', contact_name: 'Lena Fischer',  notes: 'Re-engage cold lead'              },
  { id: 'f8', contact_name: 'Aiko Tanaka',   notes: 'ROI case study requested'        },
];

const MOCK_HANDOFFS = [
  { id: 'h1', agent_type: 'sales', customer_name: 'Ben Park',    reason: 'Requested human pricing negotiation' },
  { id: 'h2', agent_type: 'sales', customer_name: 'Maria Lopez', reason: 'Complex enterprise contract query'   },
];

const MOCK_RECENT_RUNS = [
  { created_at: new Date(Date.now() - 2*60000).toISOString(),  brief: 'Scored 12 leads from LinkedIn Campaign #4821 — 7 Hot, 4 Warm, 1 Cold', output: { lead_qualification_reason: 'Scored 12 new leads from LinkedIn Campaign #4821 — 7 Hot, 4 Warm, 1 Cold' } },
  { created_at: new Date(Date.now() - 18*60000).toISOString(), brief: 'Drafted follow-up email for 5 hot leads — awaiting approval', output: { recommended_sales_action: 'Drafted follow-up email for 5 hot leads — awaiting approval' } },
  { created_at: new Date(Date.now() - 45*60000).toISOString(), brief: 'Pipeline updated: acme-corp.com visited pricing 4× this week — flagged intent', output: { lead_qualification_reason: 'Pipeline updated: acme-corp.com visited pricing 4× this week — flagged intent' } },
  { created_at: new Date(Date.now() - 90*60000).toISOString(), brief: 'Win/loss analysis complete — 72% win rate on SaaS deals this quarter', output: { recommended_sales_action: 'Win/loss analysis complete — 72% win rate on SaaS deals this quarter' } },
];

const MOCK_SALES_CONFIG = {
  min_hot_score: 75,
  computed: {
    pipeline_value: 1240000,
    pipeline_value_note: 'Across 9 active deals',
    ai_confidence: 88,
    ai_confidence_note: 'Avg across 12 scored leads today',
  },
};
// ─────────────────────────────────────────────────────────────────────────────

function SalesOverview({ onOpenDealValueModal, onOpenConfidenceModal }) {
  const { data: leadsData, isLoading: leadsLoading } = useLeads();
  const { data: followUpCounts } = useFollowUpCounts();
  const { data: overdueFollowUps = [] } = useFollowUps('overdue');
  const { data: todayFollowUps = [] } = useFollowUps('today');
  const { data: handoffs = [] } = useHandoffs('pending');
  const { data: recentRuns = [] } = useSalesAgentRuns();
  const { data: salesConfig } = useSalesAgentConfig();
  const updateHandoff = useUpdateHandoff();

  // Use mock fallbacks when real data is absent
  const leads         = (leadsData && leadsData.length > 0)          ? leadsData        : MOCK_LEADS;
  const fupCounts     = followUpCounts                                 ? followUpCounts   : MOCK_FOLLOW_UP_COUNTS;
  const overdues      = overdueFollowUps.length > 0                   ? overdueFollowUps : MOCK_OVERDUE_FOLLOWS;
  const todayFups     = todayFollowUps.length > 0                     ? todayFollowUps   : MOCK_TODAY_FOLLOWS;
  const activeHandoff = handoffs.length > 0                           ? handoffs         : MOCK_HANDOFFS;
  const runs          = recentRuns.length > 0                         ? recentRuns       : MOCK_RECENT_RUNS;
  const config        = salesConfig                                    ? salesConfig      : MOCK_SALES_CONFIG;
  const minHot        = config?.min_hot_score ?? 75;

  const { hot, warm, cold, stages, wonCount, lostCount } = useMemo(() => {
    const hot = leads.filter((l) => Number(l.score) >= minHot);
    const warm = leads.filter((l) => Number(l.score) >= 45 && Number(l.score) < minHot);
    const cold = leads.filter((l) => Number(l.score) < 45);
    const byStage = {};
    STAGE_ORDER.forEach((s) => { byStage[s] = 0; });
    leads.forEach((l) => { if (byStage[l.stage] !== undefined) byStage[l.stage] += 1; });
    return {
      hot, warm, cold, stages: byStage,
      wonCount: byStage.won || 0, lostCount: byStage.lost || 0,
    };
  }, [leads, minHot]);

  const totalLeads = leads.length;
  const closedCount = wonCount + lostCount;
  const winRate = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : null;
  const maxStageCount = Math.max(1, ...STAGE_ORDER.map((s) => stages[s]));

  const salesHandoffs = (handoffs || []).filter((h) => h.agent_type === 'sales');

  const tasks = [
    ...overdueFollowUps.map((f) => ({
      title: `Follow up: ${f.contact_name || 'Unnamed contact'}`,
      sub: f.notes || 'Overdue', status: 'queued', priority: 'high',
    })),
    ...todayFollowUps.map((f) => ({
      title: `Follow up: ${f.contact_name || 'Unnamed contact'}`,
      sub: f.notes || 'Due today', status: 'queued',
    })),
  ].slice(0, 6);

  const approvals = salesHandoffs.map((h) => ({
    id: h.id,
    title: `${h.customer_name || 'Unnamed lead'} — human handoff requested`,
    agent: 'Sales Agent',
  }));

  const brainLogEntries = (recentRuns || []).slice(0, 4).map((r) => ({
    time: timeLabel(r.created_at),
    type: 'output',
    text: r.output?.lead_qualification_reason || r.output?.recommended_sales_action || r.brief,
  }));

  const computed = salesConfig?.computed;
  const pipelineValueMetric = computed?.pipeline_value != null
    ? {
        label: 'Pipeline Value',
        value: `$${computed.pipeline_value.toLocaleString()}`,
        sub: computed.pipeline_value_note,
        color: '#059669',
      }
    : {
        label: 'Pipeline Value', value: '—',
        color: '#059669',
        cta: { label: '+ Set Up Deal Values', onClick: onOpenDealValueModal },
      };

  const aiConfidenceMetric = computed?.ai_confidence != null
    ? {
        label: 'AI Confidence',
        value: `${computed.ai_confidence}%`,
        sub: computed.ai_confidence_note,
        color: '#0284C7',
      }
    : {
        label: 'AI Confidence', value: '—',
        color: '#0284C7',
        cta: { label: '⚡ Wire Confidence Signal', onClick: onOpenConfidenceModal },
      };

  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        {
          label: "Today's Follow-ups",
          value: followUpCounts ? String(followUpCounts.today) : '—',
          sub: followUpCounts ? `${followUpCounts.overdue} overdue` : undefined,
          color: '#EF4444',
        },
        {
          label: 'Hot Leads', value: leadsLoading ? '—' : String(hot.length),
          sub: leadsLoading ? undefined : `of ${totalLeads} total, ≥${minHot} RF score`, color: '#EF4444',
        },
        pipelineValueMetric,
        aiConfidenceMetric,
        {
          label: 'Win Rate', value: winRate != null ? `${winRate}%` : '—',
          sub: winRate != null ? `${wonCount} won / ${lostCount} lost` : 'no closed deals yet', color: '#10B981',
        },
      ]} />

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Lead Distribution</SectionTitle>
          {[
            { label: 'Hot', count: hot.length, color: '#EF4444' },
            { label: 'Warm', count: warm.length, color: '#F59E0B' },
            { label: 'Cold', count: cold.length, color: '#94A3B8' },
          ].map((l) => (
            <div key={l.label} className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-600">{l.label} Leads</span>
                <Mono color={l.color}>{l.count}</Mono>
              </div>
              <ConfidenceMeter value={totalLeads ? (l.count / totalLeads) * 100 : 0} color={l.color} />
            </div>
          ))}
          <Divider className="my-3" />
          <div className="text-xs text-slate-400">
            {leadsLoading ? 'Loading leads…' : `Total: ${totalLeads} leads · scored by the random forest model`}
          </div>
        </Card>

        <Card className="p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Pipeline Health</SectionTitle>
            <Badge variant="info">{STAGE_ORDER.length} stages</Badge>
          </div>
          <div className="space-y-3">
            {STAGE_ORDER.map((s) => (
              <div key={s} className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: STAGE_COLOR[s] }} />
                <span className="text-xs text-slate-600 w-24 flex-shrink-0">{STAGE_LABEL[s]}</span>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(stages[s] / maxStageCount) * 100}%`, background: STAGE_COLOR[s] }} />
                  </div>
                </div>
                <Mono color="#0F1929">{stages[s]}</Mono>
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-400 mt-3">
            {computed?.pipeline_value != null
              ? `Dollar totals reflect ${computed.leads_with_deal_value} lead(s) with a mapped deal value.`
              : 'No deal-value field mapped yet — stage counts are real, dollar totals aren\'t shown rather than invented.'}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <TaskQueue tasks={tasks} emptyLabel="No follow-ups due today or overdue." />
        <ApprovalQueue
          items={approvals}
          emptyLabel="No pending sales handoffs."
          busyId={updateHandoff.isPending ? updateHandoff.variables?.id : null}
          onApprove={(item) => updateHandoff.mutate({ id: item.id, status: 'resolved' })}
          onReject={(item) => updateHandoff.mutate({ id: item.id, status: 'rejected' })}
        />
        <BrainLog entries={brainLogEntries} />
      </div>
    </div>
  );
}

// ─── Pipeline tab — real leads, grouped by real stage, click to open the
// Lead Detail Drawer (which is how a card's stage actually changes — Apply
// writes PUT /leads/:id via useApplyRecommendation, same endpoint the task
// spec's "connect card stage transitions to PUT /leads/:id/stage" calls for).
function Pipeline({ leads, isLoading, onSelectLead }) {
  const byStage = useMemo(() => {
    const grouped = {};
    STAGE_ORDER.forEach((s) => { grouped[s] = []; });
    (leads || []).forEach((l) => {
      const stage = STAGE_ORDER.includes(l.stage) ? l.stage : 'new';
      grouped[stage].push(l);
    });
    return grouped;
  }, [leads]);

  if (isLoading) {
    return <div className="text-xs text-slate-400 py-8 text-center">Loading pipeline…</div>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {STAGE_ORDER.map((stage) => {
        const stageLeads = byStage[stage];
        const color = STAGE_COLOR[stage];
        return (
          <div key={stage} className="flex-shrink-0 w-56">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-xs font-semibold text-[#0F1929]">{STAGE_LABEL[stage]}</span>
              <span className="ml-auto text-xs text-slate-400">{stageLeads.length}</span>
            </div>
            <div className="space-y-2.5">
              {stageLeads.length === 0 && (
                <div className="text-xs text-slate-300 text-center py-4">No leads</div>
              )}
              {stageLeads.map((lead) => (
                <button
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="w-full text-left p-3.5 rounded-xl border border-[#E4E8F0] bg-white hover:shadow-md transition-all hover:border-blue-100"
                >
                  <div className="text-xs font-semibold text-[#0F1929] mb-0.5 truncate">{lead.name || 'Unnamed lead'}</div>
                  <div className="text-xs text-slate-400 mb-2 truncate">{lead.source || 'Source unknown'}</div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1"><ConfidenceMeter value={Number(lead.score) || 0} color={color} /></div>
                    <Mono color={color}>{lead.score ?? '—'}</Mono>
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Lead Intelligence tab — Signal Breakdown + Lead Timeline are bound to
// whichever lead was last clicked in Pipeline, using real useScoreLeadFit
// output rather than a static "Acme Corp" mock.
function LeadIntelligence({ selectedLead, onOpenDrawer }) {
  const score = useScoreLeadFit();
  const { data: sources } = useKnowledgeSources('sales');

  useEffect(() => {
    if (!selectedLead) return;
    score.mutate({ org_size: 'medium', budget: 'high', channel: selectedLead.source || 'email' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLead?.id]);

  const out = score.data;
  const tier = selectedLead ? tierOf(selectedLead.score) : null;
  const tierVariant = tier === 'hot' ? 'error' : tier === 'warm' ? 'warning' : 'default';

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <div>
          <SectionTitle className="mb-3">Live Fit Scorer · Random Forest</SectionTitle>
          <FitScorerPanel />
        </div>

        {!selectedLead ? (
          <Card className="p-6 text-center text-xs text-slate-400">
            Select a lead from the Pipeline tab to see its real AI analysis here.
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <div className="text-xs text-slate-400 mb-1">Analyzing Lead</div>
                  <div className="text-xl font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {selectedLead.name || 'Unnamed lead'}
                  </div>
                  <div className="text-sm text-slate-500">
                    {selectedLead.source || 'Source unknown'} · Created {dateLabel(selectedLead.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600" style={{ fontFamily: "'Outfit', sans-serif" }}>
                    {selectedLead.score ?? '—'}
                  </div>
                  <div className="text-xs text-slate-400">Lead Score (CRM)</div>
                  <Badge variant={tierVariant}>{tier}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-5">
                {(out?.factors || []).map((f) => (
                  <div key={f.label} className="p-4 rounded-xl bg-slate-50">
                    <Label>{f.label}</Label>
                    <div className="text-sm font-bold text-[#0F1929]">{f.value}</div>
                    <div className="text-xs text-slate-400 mt-1">{f.points} of {f.max} pts · model weight {Math.round((f.model_weight || 0) * 100)}%</div>
                  </div>
                ))}
                <div className="p-4 rounded-xl bg-slate-50">
                  <Label>Recommended Action</Label>
                  <div className="text-sm font-bold text-blue-600">{out?.recommended_action || (score.isPending ? 'Scoring…' : '—')}</div>
                  <div className="text-xs text-slate-400 mt-1">Current stage: {selectedLead.stage || 'new'}</div>
                </div>
              </div>
              <div>
                <SectionTitle className="mb-3">AI Reasoning</SectionTitle>
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {out?.tier_reason || 'Scoring this lead against the random forest model…'}
                  </p>
                </div>
                <button
                  onClick={onOpenDrawer}
                  className="mt-3 text-xs font-medium text-blue-600 hover:underline"
                >
                  Adjust signals & apply to CRM →
                </button>
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle className="mb-4">Lead Timeline</SectionTitle>
              <TimelineItem
                title="Lead created"
                sub={selectedLead.source ? `Source: ${selectedLead.source}` : undefined}
                time={dateLabel(selectedLead.created_at)}
              />
              <TimelineItem
                title={`Currently in "${selectedLead.stage || 'new'}" stage`}
                sub={`CRM score: ${selectedLead.score ?? '—'}`}
                time={dateLabel(selectedLead.updated_at || selectedLead.created_at)}
              />
              <TimelineItem
                title="AI fit score computed"
                sub={out ? `${out.score}/100 · ${out.tier} tier (random forest)` : 'Scoring…'}
                time="just now"
                last
              />
            </Card>
          </>
        )}
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-4">Signal Breakdown</SectionTitle>
          {selectedLead && out?.factors?.length ? (
            <div className="space-y-3">
              {out.factors.map((f) => (
                <div key={f.label}>
                  <div className="flex items-center justify-between mb-1">
                    <Label>{f.label}</Label>
                    <Mono color="#0284C7">{f.points}</Mono>
                  </div>
                  <ConfidenceMeter value={(f.points / (f.max || 100)) * 100} color="#0284C7" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Select a lead to see its real fit-model signal breakdown.</p>
          )}
        </Card>
        <KnowledgePanel sources={sources} />
      </div>
    </div>
  );
}

// ─── Follow-ups tab — real drafts per lead via POST /sales/draft-followup,
// with Edit (local override before send) and Approve & Send (dispatches via
// the existing POST /conversations/:id/reply).
const DRAFT_META = {
  email: { icon: <Mail size={16} />, label: 'Email Draft', color: '#3B6EF0', bg: '#EEF2FF' },
  whatsapp: { icon: <MessageSquare size={16} />, label: 'WhatsApp Draft', color: '#25D366', bg: '#F0FFF4' },
  call_script: { icon: <Phone size={16} />, label: 'Call Script', color: '#7C3AED', bg: '#F5F3FF' },
};

function DraftCard({ kind, draft, leadName, onRegenerate, regenerating, onSend, sendState }) {
  const meta = DRAFT_META[kind];
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft?.body || '');

  useEffect(() => { setBody(draft?.body || ''); }, [draft?.body]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: meta.bg, color: meta.color }}>{meta.icon}</div>
          <SectionTitle>{meta.label}</SectionTitle>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRegenerate}
            disabled={regenerating}
            className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw size={11} className={regenerating ? 'animate-spin' : ''} /> Regenerate
          </button>
          <Badge variant="warning">Draft</Badge>
        </div>
      </div>
      {draft?.subject && <div className="text-xs font-medium text-slate-500 mb-2">{draft.subject}</div>}
      {editing ? (
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          className="w-full p-4 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed border border-[#E4E8F0] focus:outline-none focus:border-blue-300"
        />
      ) : (
        <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed whitespace-pre-line min-h-[4rem]">
          {body || (regenerating ? 'Generating…' : 'No draft yet — click Regenerate.')}
        </div>
      )}
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => setEditing((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E4E8F0] text-slate-500 hover:bg-slate-50 transition-all"
        >
          {editing ? 'Done editing' : 'Edit'}
        </button>
        <button
          onClick={() => onSend(body)}
          disabled={!body.trim() || sendState?.isPending}
          className="px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: meta.color }}
        >
          {sendState?.isPending ? 'Sending…' : sendState?.sent ? 'Sent ✓' : 'Approve & Send'}
        </button>
      </div>
      {sendState?.error && <div className="text-xs text-red-500 mt-2">{sendState.error}</div>}
    </Card>
  );
}

function Followups({ leads, selectedLead, onSelectLead }) {
  const draftMutation = useDraftFollowup();
  const findConversation = useFindConversationByName();
  const sendReply = useSendReply();
  const [drafts, setDrafts] = useState(null);
  const [sendStateByKind, setSendStateByKind] = useState({});

  const lead = selectedLead || (leads || [])[0] || null;

  const generate = () => {
    if (!lead) return;
    draftMutation.mutate(
      { lead_id: lead.id, lead_name: lead.name, stage: lead.stage, score: lead.score, channel: lead.source },
      { onSuccess: (data) => setDrafts(data) },
    );
  };

  useEffect(() => {
    setDrafts(null);
    setSendStateByKind({});
    if (lead) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id]);

  const sendDraft = async (kind, body) => {
    setSendStateByKind((s) => ({ ...s, [kind]: { isPending: true } }));
    try {
      const match = await findConversation.mutateAsync(lead?.name || '');
      if (!match) {
        setSendStateByKind((s) => ({ ...s, [kind]: { isPending: false, error: 'No matching conversation found for this lead yet.' } }));
        return;
      }
      await sendReply.mutateAsync({ conversationId: match.id, body });
      setSendStateByKind((s) => ({ ...s, [kind]: { isPending: false, sent: true } }));
    } catch (e) {
      setSendStateByKind((s) => ({ ...s, [kind]: { isPending: false, error: e?.message || 'Send failed' } }));
    }
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <Card className="p-4 flex items-center gap-3">
          <Label>Drafting for</Label>
          <select
            value={lead?.id || ''}
            onChange={(e) => onSelectLead((leads || []).find((l) => String(l.id) === e.target.value) || null)}
            className="flex-1 text-xs font-medium text-slate-700 bg-slate-50 border border-[#E4E8F0] rounded-lg px-3 py-1.5"
          >
            {(leads || []).map((l) => (
              <option key={l.id} value={l.id}>{l.name || 'Unnamed lead'} · {l.stage || 'new'}</option>
            ))}
          </select>
        </Card>
        {['email', 'whatsapp', 'call_script'].map((kind) => (
          <DraftCard
            key={kind}
            kind={kind}
            draft={drafts?.[kind]}
            leadName={lead?.name}
            regenerating={draftMutation.isPending}
            onRegenerate={generate}
            onSend={(body) => sendDraft(kind, body)}
            sendState={sendStateByKind[kind]}
          />
        ))}
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-3">AI Suggestions</SectionTitle>
          <div className="space-y-2.5">
            {[
              { label: 'Best send time', value: 'Tue 9–10am' },
              { label: 'Knowledge sources used', value: String(drafts?.knowledge_sources_used?.length ?? 0) },
              { label: 'Drafting for', value: lead?.name || '—' },
              { label: 'Channel', value: lead?.source || '—' },
            ].map((s) => (
              <div key={s.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <Label>{s.label}</Label>
                <Value className="text-xs">{s.value}</Value>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Forecasting tab — real pipeline-by-stage, monthly revenue trend, and
// target-vs-actual gap analysis from GET /ai-agents/sales/forecast.
function Forecasting({ onOpenDealValueModal, onOpenTargetModal }) {
  const { data, isLoading } = useSalesForecast();

  if (isLoading || !data) {
    return <div className="text-xs text-slate-400 py-8 text-center">Loading forecast…</div>;
  }

  const gap = data.revenue_gap;
  const targetMetric = gap.target != null
    ? { label: 'Monthly Revenue Target', value: `$${gap.target.toLocaleString()}`, color: '#0284C7' }
    : { label: 'Monthly Revenue Target', value: '—', color: '#0284C7', cta: { label: '+ Set Target', onClick: onOpenTargetModal } };

  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        targetMetric,
        { label: 'Quarterly Prediction', value: data.quarterly_prediction != null ? `$${data.quarterly_prediction.toLocaleString()}` : '—', sub: 'AI-weighted, open pipeline', color: '#7C3AED' },
        { label: 'Weighted Pipeline Value', value: data.weighted_pipeline_value != null ? `$${data.weighted_pipeline_value.toLocaleString()}` : '—', color: '#059669',
          ...(data.weighted_pipeline_value == null ? { cta: { label: '+ Set Up Deal Values', onClick: onOpenDealValueModal } } : {}) },
        { label: 'Revenue Gap (MTD)', value: gap.gap != null ? `${gap.gap >= 0 ? '-' : '+'}$${Math.abs(gap.gap).toLocaleString()}` : '—',
          sub: gap.note, color: gap.gap != null && gap.gap <= 0 ? '#10B981' : '#F59E0B' },
      ]} />
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Revenue Closed (Monthly)</SectionTitle>
          <MiniBarChart data={data.monthly_revenue.map((m) => ({ label: m.label, value: m.closed_value || 0.0001 }))} color="#0284C7" />
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-4">Pipeline by Stage · Value</SectionTitle>
          <div className="space-y-3">
            {data.pipeline_by_stage.filter((s) => s.stage !== 'lost').map((s) => (
              <div key={s.stage} className="flex items-center gap-4">
                <span className="text-xs text-slate-600 w-20 flex-shrink-0">{s.label}</span>
                <div className="flex-1"><ConfidenceMeter value={s.win_probability * 100} color="#0284C7" /></div>
                <Mono color="#0F1929">{s.value != null ? `$${s.value.toLocaleString()}` : `${s.count} leads`}</Mono>
                <span className="text-xs text-slate-400 w-10">{Math.round(s.win_probability * 100)}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <SectionTitle className="mb-4">AI Forecast Explanation</SectionTitle>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-xs text-blue-800 leading-relaxed">{data.explanation}</p>
        </div>
      </Card>
    </div>
  );
}

// ─── Analytics tab — real MTD/avg-deal/cycle/productivity from
// GET /ai-agents/sales/analytics.
function SalesAnalytics() {
  const { data, isLoading } = useSalesAnalytics();

  if (isLoading || !data) {
    return <div className="text-xs text-slate-400 py-8 text-center">Loading analytics…</div>;
  }

  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'Deals Closed MTD', value: String(data.deals_closed_mtd), sub: data.deals_closed_mtd_delta != null ? `${data.deals_closed_mtd_delta >= 0 ? '+' : ''}${data.deals_closed_mtd_delta} vs last month` : undefined, color: '#10B981' },
        { label: 'Avg Deal Size', value: data.avg_deal_size != null ? `$${data.avg_deal_size.toLocaleString()}` : '—', sub: data.avg_deal_size_note, color: '#0284C7' },
        { label: 'Sales Cycle', value: data.sales_cycle_days != null ? `${Math.round(data.sales_cycle_days)} days` : '—', sub: data.sales_cycle_note, color: '#7C3AED' },
        { label: 'AI Resolutions', value: data.ai_resolution_rate != null ? `${data.ai_resolution_rate}%` : '—', sub: 'No-touch closes', color: '#059669' },
      ]} />
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Deals Won Weekly</SectionTitle>
          <MiniBarChart data={data.weekly_deals_won.map((w) => ({ label: w.label, value: w.count || 0.0001 }))} color="#0284C7" />
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-4">Agent Productivity</SectionTitle>
          <div className="space-y-3">
            {data.agent_productivity.map((a, i) => (
              <div key={a.name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ['#3B6EF0', '#7C3AED', '#10B981', '#F59E0B'][i % 4] }} />
                <span className="text-xs text-slate-600 flex-1">{a.name}</span>
                <Mono color="#0F1929">{a.count}</Mono>
                <span className="text-xs text-slate-400">tasks</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Settings tab — real config from GET/PATCH /ai-agents/sales/config.
function Toggle({ value, onChange }) {
  return (
    <div
      onClick={onChange}
      role="switch"
      aria-checked={value}
      className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${value ? 'bg-blue-500' : 'bg-slate-200'}`}
    >
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-4' : 'left-0.5'}`} />
    </div>
  );
}

function SalesSettings() {
  const { data: config, isLoading } = useSalesAgentConfig();
  const update = useUpdateSalesAgentConfig();

  const patch = (body) => update.mutate(body);

  if (isLoading || !config) {
    return <div className="text-xs text-slate-400 py-8 text-center">Loading settings…</div>;
  }

  const cadenceLabel = (config.followup_cadence_days || []).length
    ? `Day ${config.followup_cadence_days.join(', ')}`
    : 'None set';

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <SectionTitle className="mb-4">Lead Scoring</SectionTitle>
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Minimum score for &quot;Hot&quot; classification</span>
            <select
              value={config.min_hot_score}
              onChange={(e) => patch({ min_hot_score: Number(e.target.value) })}
              className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-[#E4E8F0]"
            >
              {[60, 65, 70, 75, 80, 85, 90].map((v) => <option key={v} value={v}>{v}/100</option>)}
            </select>
          </div>
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle className="mb-4">Follow-up Automation</SectionTitle>
        <div className="space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Max follow-up attempts before cold</span>
            <select
              value={config.max_followup_attempts}
              onChange={(e) => patch({ max_followup_attempts: Number(e.target.value) })}
              className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-[#E4E8F0]"
            >
              {[1, 2, 3, 4, 5, 6, 8, 10].map((v) => <option key={v} value={v}>{v} touches</option>)}
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Require approval before sending</span>
            <Toggle value={config.require_approval} onChange={() => patch({ require_approval: !config.require_approval })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Follow-up cadence</span>
            <div className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-[#E4E8F0]">{cadenceLabel}</div>
          </div>
        </div>
      </Card>
      {update.isError && (
        <div className="text-xs text-red-500">Couldn&apos;t save: {update.error?.message}</div>
      )}
    </div>
  );
}

export default function SalesWorkspace() {
  const [tab, setTab] = useState('Overview');
  const [showDealValueModal, setShowDealValueModal] = useState(false);
  const [showConfidenceModal, setShowConfidenceModal] = useState(false);
  const [showQueueDrawer, setShowQueueDrawer] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [drawerLead, setDrawerLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

  const { data: salesConfig } = useSalesAgentConfig();
  const { data: queue } = useSalesAgentQueue();
  const { data: leadsData, isLoading: leadsLoading } = useLeads();
  const leads = leadsData || [];

  const badge = queue
    ? `Running · ${queue.total} task${queue.total === 1 ? '' : 's'} queued`
    : 'Running · tasks queued';

  const confidence = salesConfig?.computed?.ai_confidence ?? '—';

  const selectLeadFromPipeline = (lead) => {
    setSelectedLead(lead);
    setDrawerLead(lead);
  };

  return (
    <div className="min-h-screen">
      <WorkspaceHeader name="Sales Agent" icon="📈" badge={badge} confidence={confidence}
        color="#0284C7" bgColor="#F0F9FF" description="Lead scoring, pipeline intelligence, follow-up automation, and revenue forecasting"
        onExport={() => setShowExportModal(true)}
        onBadgeClick={() => setShowQueueDrawer(true)}
        onSettingsClick={() => setTab('Settings')}
      />
      <div className="px-8">
        <TabNav tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="px-8 pb-8 mt-6">
        {tab === 'Overview' && (
          <SalesOverview
            onOpenDealValueModal={() => setShowDealValueModal(true)}
            onOpenConfidenceModal={() => setShowConfidenceModal(true)}
          />
        )}
        {tab === 'Pipeline' && (
          <Pipeline leads={leads} isLoading={leadsLoading} onSelectLead={selectLeadFromPipeline} />
        )}
        {tab === 'Lead Intelligence' && (
          <LeadIntelligence selectedLead={selectedLead} onOpenDrawer={() => setDrawerLead(selectedLead)} />
        )}
        {tab === 'Follow-ups' && (
          <Followups leads={leads} selectedLead={selectedLead} onSelectLead={setSelectedLead} />
        )}
        {tab === 'Forecasting' && (
          <Forecasting
            onOpenDealValueModal={() => setShowDealValueModal(true)}
            onOpenTargetModal={() => setTab('Settings')}
          />
        )}
        {tab === 'Knowledge' && (
          <KnowledgeTab />
        )}
        {tab === 'Analytics' && <SalesAnalytics />}
        {tab === 'Settings' && <SalesSettings />}
      </div>

      {showDealValueModal && (
        <DealValueFieldModal config={salesConfig} onClose={() => setShowDealValueModal(false)} />
      )}
      {showConfidenceModal && (
        <ConfidenceSignalModal config={salesConfig} onClose={() => setShowConfidenceModal(false)} />
      )}
      {showQueueDrawer && <SalesQueueDrawer onClose={() => setShowQueueDrawer(false)} />}
      {showExportModal && <SalesExportModal onClose={() => setShowExportModal(false)} />}
      {drawerLead && (
        <LeadDetailDrawer
          lead={drawerLead}
          onClose={() => setDrawerLead(null)}
          onApplied={() => setDrawerLead(null)}
        />
      )}
    </div>
  );
}

// Split out so the Knowledge tab's data fetch doesn't run on every render of
// the whole workspace — only when that tab is actually mounted.
function KnowledgeTab() {
  const { data: sources, isLoading } = useKnowledgeSources('sales');
  return (
    <div className="grid grid-cols-3 gap-6">
      <KnowledgePanel sources={isLoading ? undefined : sources} />
      <div className="col-span-2"><BrainLog entries={BRAIN_LOG} /></div>
    </div>
  );
}
