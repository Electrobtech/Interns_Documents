import { useState } from 'react'
import type { AppView } from '../../App'
import {
  WorkspaceHeader, TabNav, Card, CardHover, Badge, SectionTitle, Label, Value,
  KnowledgePanel, BrainLog, TaskQueue, ApprovalQueue, ConfidenceMeter,
  MetricsRow, MiniBarChart, Divider, TimelineItem, Mono,
} from '../shared/ui'
import { ArrowRight, TrendingUp, Users, Mail, MessageSquare, Phone, RefreshCw, ChevronRight } from 'lucide-react'

const TABS = ['Overview', 'Pipeline', 'Lead Intelligence', 'Follow-ups', 'Forecasting', 'Knowledge', 'Analytics', 'Settings']

const BRAIN_LOG = [
  { time: '09:40', type: 'retrieve' as const, text: 'Loaded 23 new leads from LinkedIn Campaign #4812 into scoring queue' },
  { time: '09:41', type: 'thinking' as const, text: 'Analyzing firmographic signals: company size, tech stack, funding stage' },
  { time: '09:41', type: 'action' as const, text: 'Running Lead Scoring module — weighting intent signals + CRM history' },
  { time: '09:42', type: 'output' as const, text: '14 leads scored Hot (>80), 6 Warm, 3 Cold — pipeline updated' },
  { time: '09:39', type: 'thinking' as const, text: 'Buying Intent Detection: acme-corp.com visited pricing 4× this week' },
  { time: '09:38', type: 'action' as const, text: 'Follow-up email drafted for 8 hot leads — awaiting approval' },
]

const TASKS = [
  { title: 'Score 23 new LinkedIn leads', status: 'running' as const, priority: 'high' as const },
  { title: 'Draft follow-up emails for 8 hot leads', status: 'queued' as const },
  { title: 'Cold lead revival: 34 dormant Q2 contacts', status: 'queued' as const },
  { title: 'Update pipeline forecast model', status: 'queued' as const },
  { title: 'Sales handoff: Acme Corp — ready for AE', status: 'queued' as const, priority: 'high' as const },
]

const APPROVALS = [
  { title: 'Follow-up sequence: 8 hot leads (email + WA)', agent: 'Sales Agent', confidence: 87 },
  { title: 'Cold Lead Revival Campaign — 34 contacts', agent: 'Sales Agent', confidence: 79 },
]

// ─── Overview ────────────────────────────────────────────────────────────────

function SalesOverview() {
  const leads = [
    { label: 'Hot', count: 28, color: '#EF4444', pct: 18 },
    { label: 'Warm', count: 71, color: '#F59E0B', pct: 45 },
    { label: 'Cold', count: 57, color: '#94A3B8', pct: 37 },
  ]
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: "Today's Follow-ups", value: '12', sub: '4 overdue', color: '#EF4444' },
        { label: 'Hot Leads', value: '28', sub: '+6 from AI scoring', color: '#EF4444' },
        { label: 'Pipeline Value', value: '$1.24M', sub: 'Q4 active', color: '#059669' },
        { label: 'AI Confidence', value: '87%', color: '#0284C7' },
        { label: 'Win Rate', value: '34%', sub: '+4% vs last Q', color: '#10B981' },
      ]} />

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Lead Distribution</SectionTitle>
          {leads.map(l => (
            <div key={l.label} className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-600">{l.label} Leads</span>
                <Mono color={l.color}>{l.count}</Mono>
              </div>
              <ConfidenceMeter value={l.pct * 2} color={l.color} />
            </div>
          ))}
          <Divider className="my-3" />
          <div className="text-xs text-slate-400">Total: 156 leads · AI scored today</div>
        </Card>

        <Card className="p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Pipeline Health</SectionTitle>
            <Badge variant="info">6 stages</Badge>
          </div>
          <div className="space-y-3">
            {[
              { stage: 'New Leads', count: 52, value: '$0', color: '#94A3B8' },
              { stage: 'Qualified', count: 28, value: '$340K', color: '#3B6EF0' },
              { stage: 'Proposal Sent', count: 14, value: '$480K', color: '#7C3AED' },
              { stage: 'Negotiation', count: 8, value: '$290K', color: '#F59E0B' },
              { stage: 'Won', count: 12, value: '$130K', color: '#10B981' },
              { stage: 'Lost', count: 9, value: '—', color: '#EF4444' },
            ].map(s => (
              <div key={s.stage} className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                <span className="text-xs text-slate-600 w-28 flex-shrink-0">{s.stage}</span>
                <div className="flex-1">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(s.count / 52) * 100}%`, background: s.color }} />
                  </div>
                </div>
                <Mono color="#0F1929">{s.count}</Mono>
                <span className="text-xs text-slate-400 w-16 text-right">{s.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <TaskQueue tasks={TASKS} />
        <ApprovalQueue items={APPROVALS} />
        <BrainLog entries={BRAIN_LOG.slice(0, 4)} />
      </div>
    </div>
  )
}

// ─── Pipeline (Kanban) ────────────────────────────────────────────────────────

function Pipeline() {
  const stages = [
    {
      label: 'New Leads', color: '#94A3B8', bg: '#F8FAFC',
      leads: [
        { name: 'TechFlow Inc.', contact: 'Sarah Chen, CTO', score: 72 },
        { name: 'Glasswork Studio', contact: 'Marco Vega, RevOps', score: 65 },
        { name: 'NorthStar Analytics', contact: 'Priya Mehta, CMO', score: 58 },
      ],
    },
    {
      label: 'Qualified', color: '#3B6EF0', bg: '#EEF2FF',
      leads: [
        { name: 'Acme Corp', contact: 'James Liu, VP Sales', score: 88 },
        { name: 'Prisma SaaS', contact: 'Diana Okafor, CEO', score: 82 },
      ],
    },
    {
      label: 'Proposal', color: '#7C3AED', bg: '#F5F3FF',
      leads: [
        { name: 'Vertex AI Co.', contact: 'Tom Burke, Director', score: 91 },
        { name: 'Bloom Markets', contact: 'Ana Santos, COO', score: 85 },
      ],
    },
    {
      label: 'Negotiation', color: '#F59E0B', bg: '#FFFBEB',
      leads: [
        { name: 'FinCore Ltd.', contact: 'Alex Rand, CFO', score: 94 },
      ],
    },
    {
      label: 'Won', color: '#10B981', bg: '#F0FDF4',
      leads: [
        { name: 'Cloudify Inc.', contact: 'Ben Park, CEO', score: 97 },
        { name: 'DataMesh Pro', contact: 'Lena Fischer, CTO', score: 95 },
      ],
    },
  ]
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {stages.map(stage => (
        <div key={stage.label} className="flex-shrink-0 w-56">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
            <span className="text-xs font-semibold text-[#0F1929]">{stage.label}</span>
            <span className="ml-auto text-xs text-slate-400">{stage.leads.length}</span>
          </div>
          <div className="space-y-2.5">
            {stage.leads.map(lead => (
              <div
                key={lead.name}
                className="p-3.5 rounded-xl border border-[#E4E8F0] bg-white hover:shadow-md transition-all cursor-default hover:border-blue-100"
              >
                <div className="text-xs font-semibold text-[#0F1929] mb-0.5">{lead.name}</div>
                <div className="text-xs text-slate-400 mb-2">{lead.contact}</div>
                <div className="flex items-center justify-between">
                  <ConfidenceMeter value={lead.score} color={stage.color} />
                  <Mono color={stage.color} >{lead.score}</Mono>
                </div>
              </div>
            ))}
            <button
              className="w-full p-2 rounded-xl border border-dashed border-[#E4E8F0] text-xs text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all"
            >
              + Add lead
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Lead Intelligence ────────────────────────────────────────────────────────

function LeadIntelligence() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <Card className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-xs text-slate-400 mb-1">Analyzing Lead</div>
              <div className="text-xl font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>Acme Corp</div>
              <div className="text-sm text-slate-500">James Liu · VP Sales · 340 employees · Series B</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-blue-600" style={{ fontFamily: "'Outfit', sans-serif" }}>88</div>
              <div className="text-xs text-slate-400">Lead Score</div>
              <Badge variant="error" >Hot</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            {[
              { label: 'Buying Intent', value: 'Very High', detail: 'Visited pricing 4× this week', color: '#EF4444' },
              { label: 'Qualification', value: 'Qualified', detail: 'Meets ICP: B2B SaaS, 200+ employees', color: '#10B981' },
              { label: 'Opportunity Stage', value: 'Proposal', detail: 'Demo completed on Aug 1, 2026', color: '#7C3AED' },
              { label: 'Recommended Action', value: 'Send Proposal', detail: 'Optimal window: next 48 hours', color: '#3B6EF0' },
            ].map(f => (
              <div key={f.label} className="p-4 rounded-xl bg-slate-50">
                <Label>{f.label}</Label>
                <div className="text-sm font-bold" style={{ color: f.color }}>{f.value}</div>
                <div className="text-xs text-slate-400 mt-1">{f.detail}</div>
              </div>
            ))}
          </div>

          <div>
            <SectionTitle className="mb-3">AI Reasoning — Why This Lead Is Ready</SectionTitle>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-800 leading-relaxed">
                Acme Corp has visited the pricing page 4 times in the last 7 days and downloaded the ROI calculator twice. Their CRM profile shows budget authority ($50K+ deal size typical for their segment), and they recently hired a new RevOps director — a strong buying signal. Their Q3 earnings call mentioned "automating top-of-funnel" as a priority. I recommend assigning to an Account Executive within 24 hours.
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle className="mb-4">Lead Timeline</SectionTitle>
          <TimelineItem title="First website visit" sub="Pricing page · 12 min session" time="Jul 26" />
          <TimelineItem title="Email opened (outbound seq. #3)" sub="Clicked: 'See pricing' CTA" time="Jul 28" />
          <TimelineItem title="Demo scheduled & completed" sub="45 min · attended by CTO + VP Sales" time="Aug 1" />
          <TimelineItem title="Pricing page revisited (4×)" sub="ROI calculator downloaded" time="Aug 2" />
          <TimelineItem title="AI Lead Score updated: 88 (Hot)" sub="Assigned to AE queue" time="Aug 3" last />
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-4">Signal Breakdown</SectionTitle>
          <div className="space-y-3">
            {[
              { label: 'Web Engagement', score: 94 },
              { label: 'Email Interaction', score: 78 },
              { label: 'Firmographic Fit', score: 88 },
              { label: 'Budget Signals', score: 82 },
              { label: 'Timing Urgency', score: 91 },
            ].map(s => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1">
                  <Label>{s.label}</Label>
                  <Mono color="#0284C7">{s.score}</Mono>
                </div>
                <ConfidenceMeter value={s.score} color="#0284C7" />
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-3">Similar Won Deals</SectionTitle>
          <div className="space-y-2.5">
            {[
              { name: 'Cloudify Inc.', value: '$48K', days: '34 days' },
              { name: 'DataMesh Pro', value: '$62K', days: '41 days' },
              { name: 'PixelStream', value: '$29K', days: '28 days' },
            ].map(d => (
              <div key={d.name} className="p-3 rounded-xl bg-green-50 flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium text-[#0F1929]">{d.name}</div>
                  <div className="text-xs text-slate-400">{d.days} to close</div>
                </div>
                <Mono color="#059669">{d.value}</Mono>
              </div>
            ))}
          </div>
        </Card>
        <KnowledgePanel />
      </div>
    </div>
  )
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

function Followups() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        {[
          {
            icon: <Mail size={16} />, label: 'Email Draft', color: '#3B6EF0', bg: '#EEF2FF',
            subject: 'Following up on your Orbq demo, James',
            body: "Hi James,\n\nThanks for joining the demo on Aug 1. Based on what you shared about your team's goals around automating lead qualification, I think Orbq could deliver significant ROI within the first 60 days.\n\nI've put together a custom proposal tailored to Acme Corp's RevOps use case — happy to walk you through it on a 20-min call.\n\nAre you available Thursday or Friday this week?\n\nBest,\nSarah from Orbq",
          },
          {
            icon: <MessageSquare size={16} />, label: 'WhatsApp Draft', color: '#25D366', bg: '#F0FFF4',
            subject: 'WhatsApp message · James Liu',
            body: "Hi James! 👋 This is Sarah from Orbq. Just following up on our demo from last week. I've put together a proposal for Acme Corp — mind if I send it over? Happy to answer any questions on a quick call too.",
          },
          {
            icon: <Phone size={16} />, label: 'Call Script', color: '#7C3AED', bg: '#F5F3FF',
            subject: 'Call prep · Acme Corp · James Liu',
            body: "Opening: Confirm they saw the demo recording.\nCore message: Orbq reduces lead qualification time by 70%.\nObjection handling: 'We already have HubSpot' → Orbq integrates natively, adds AI on top.\nClose: Propose a 2-week pilot at no cost.\nTalk time target: 12 minutes.",
          },
        ].map(draft => (
          <Card key={draft.label} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: draft.bg, color: draft.color }}>
                  {draft.icon}
                </div>
                <SectionTitle>{draft.label}</SectionTitle>
              </div>
              <div className="flex items-center gap-2">
                <button className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><RefreshCw size={11} /> Regenerate</button>
                <Badge variant="warning">Draft</Badge>
              </div>
            </div>
            <div className="text-xs font-medium text-slate-500 mb-2">{draft.subject}</div>
            <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-600 leading-relaxed whitespace-pre-line font-mono" style={{ fontFamily: "'Inter', sans-serif" }}>
              {draft.body}
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E4E8F0] text-slate-500 hover:bg-slate-50 transition-all">Edit</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-lg text-white transition-all hover:opacity-90" style={{ background: draft.color }}>
                Approve & Send
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-3">AI Suggestions</SectionTitle>
          <div className="space-y-2.5">
            {[
              { label: 'Best send time', value: 'Tue 9–10am CET' },
              { label: 'Subject line A/B', value: 'Test 3 variants' },
              { label: 'Follow-up cadence', value: 'Day 1, 3, 7' },
              { label: 'Meeting suggestion', value: 'Thu Aug 7, 10am' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <Label>{s.label}</Label>
                <Value className="text-xs">{s.value}</Value>
              </div>
            ))}
          </div>
        </Card>
        <TaskQueue tasks={TASKS} />
      </div>
    </div>
  )
}

// ─── Forecasting ──────────────────────────────────────────────────────────────

function Forecasting() {
  const monthlyData = [
    { label: 'Aug', value: 42 },
    { label: 'Sep', value: 61 },
    { label: 'Oct', value: 78 },
    { label: 'Nov', value: 94 },
    { label: 'Dec', value: 112 },
  ]
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'Monthly Revenue Target', value: '$120K', color: '#0284C7' },
        { label: 'Quarterly Prediction', value: '$340K', sub: 'AI forecast', color: '#7C3AED' },
        { label: 'Pipeline Value', value: '$1.24M', color: '#059669' },
        { label: 'Avg Win Probability', value: '34%', color: '#F59E0B' },
        { label: 'Forecast Confidence', value: '82%', color: '#10B981' },
      ]} />

      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Revenue Forecast (Monthly)</SectionTitle>
          <MiniBarChart data={monthlyData} color="#0284C7" />
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-4">Pipeline by Stage · Value</SectionTitle>
          <div className="space-y-3">
            {[
              { stage: 'Qualified', value: '$340K', prob: 30 },
              { stage: 'Proposal', value: '$480K', prob: 60 },
              { stage: 'Negotiation', value: '$290K', prob: 75 },
              { stage: 'Committed', value: '$130K', prob: 90 },
            ].map(s => (
              <div key={s.stage} className="flex items-center gap-4">
                <span className="text-xs text-slate-600 w-24 flex-shrink-0">{s.stage}</span>
                <div className="flex-1">
                  <ConfidenceMeter value={s.prob} color="#0284C7" />
                </div>
                <Mono color="#0F1929">{s.value}</Mono>
                <span className="text-xs text-slate-400 w-8">{s.prob}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionTitle className="mb-4">AI Forecast Explanation</SectionTitle>
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
          <p className="text-xs text-blue-800 leading-relaxed">
            Based on current pipeline velocity, win rates by stage, and seasonal patterns from Q4 2024–2025, the AI forecasts $340K in Q4 revenue. Key drivers: 8 active negotiations totaling $290K (75% close probability), strong intent signals from 14 hot leads in proposal stage. Risk: 2 enterprise deals with long legal review cycles may slip to Q1 2027. Recommendation: accelerate Acme Corp and FinCore proposals this week.
          </p>
        </div>
      </Card>
    </div>
  )
}

// ─── Sales Analytics ──────────────────────────────────────────────────────────

function SalesAnalytics() {
  const weeklyDeals = [
    { label: 'W35', value: 5 },
    { label: 'W36', value: 8 },
    { label: 'W37', value: 6 },
    { label: 'W38', value: 11 },
    { label: 'W39', value: 14 },
    { label: 'W40', value: 12 },
  ]
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'Deals Closed MTD', value: '12', sub: '+4 vs last month', color: '#10B981' },
        { label: 'Avg Deal Size', value: '$38K', sub: '+12%', color: '#0284C7' },
        { label: 'Sales Cycle', value: '32 days', sub: '−5 days', color: '#7C3AED' },
        { label: 'AI Resolutions', value: '74%', sub: 'No-touch closes', color: '#059669' },
      ]} />
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Deals Won Weekly</SectionTitle>
          <MiniBarChart data={weeklyDeals} color="#0284C7" />
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-4">Agent Productivity</SectionTitle>
          <div className="space-y-3">
            {[
              { name: 'Lead Scoring', calls: 156, color: '#3B6EF0' },
              { name: 'Follow-up Generation', calls: 47, color: '#7C3AED' },
              { name: 'Cold Lead Revival', calls: 34, color: '#F59E0B' },
              { name: 'Sales Handoffs', calls: 12, color: '#10B981' },
            ].map(a => (
              <div key={a.name} className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: a.color }} />
                <span className="text-xs text-slate-600 flex-1">{a.name}</span>
                <Mono color="#0F1929">{a.calls}</Mono>
                <span className="text-xs text-slate-400">tasks</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ─── Sales Handoff ────────────────────────────────────────────────────────────

function SalesHandoff() {
  const steps = [
    { label: 'Campaign Exposure', sub: 'Q3 SaaS LinkedIn campaign', icon: '📣', done: true },
    { label: 'Lead Generated', sub: 'Form fill — pricing page', icon: '🎯', done: true },
    { label: 'AI Qualified', sub: 'Score: 88 · Hot · ICP match', icon: '🤖', done: true },
    { label: 'Sales Assigned', sub: 'Routed to Sarah M. (AE)', icon: '👤', done: true },
    { label: 'Demo Scheduled', sub: 'Aug 1 · 45 min · attended', icon: '📅', done: true },
    { label: 'Proposal Stage', sub: 'AI-drafted proposal pending', icon: '📄', done: false },
    { label: 'Closed Deal', sub: 'Target: Aug 15, 2026', icon: '🏆', done: false },
  ]
  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-6">
        <SectionTitle className="mb-2">Sales Handoff Journey · Acme Corp</SectionTitle>
        <p className="text-xs text-slate-400 mb-6">AI-tracked deal progression from first touch to close</p>
        <div className="space-y-0">
          {steps.map((s, i) => (
            <TimelineItem
              key={s.label}
              title={s.label}
              sub={s.sub}
              time={s.done ? '✓' : '—'}
              last={i === steps.length - 1}
              icon={<span className="text-sm">{s.icon}</span>}
            />
          ))}
        </div>
        <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <div className="text-xs text-blue-800 font-semibold mb-1">AI Handoff Summary</div>
          <p className="text-xs text-blue-700 leading-relaxed">
            Acme Corp is ready for sales. Lead score 88 (Hot), ICP match confirmed (200+ employee SaaS company, RevOps buyer, Series B budget). They attended a 45-min demo, revisited pricing 4×, and downloaded the ROI calculator. Recommended: send custom proposal within 24 hours. High close probability window: next 7 days.
          </p>
        </div>
      </Card>
    </div>
  )
}

// ─── Settings ────────────────────────────────────────────────────────────────

function SalesSettings() {
  return (
    <div className="max-w-2xl space-y-5">
      {[
        {
          title: 'Lead Scoring',
          fields: [
            { label: 'Minimum score for "Hot" classification', type: 'select', value: '80/100' },
            { label: 'Include intent signals in scoring', type: 'toggle', value: true },
            { label: 'Auto-route hot leads to AE queue', type: 'toggle', value: true },
          ],
        },
        {
          title: 'Follow-up Automation',
          fields: [
            { label: 'Max follow-up attempts before cold', type: 'select', value: '5 touches' },
            { label: 'Require approval before sending', type: 'toggle', value: true },
            { label: 'Follow-up cadence', type: 'select', value: 'Day 1, 3, 7, 14' },
          ],
        },
      ].map(section => (
        <Card key={section.title} className="p-5">
          <SectionTitle className="mb-4">{section.title}</SectionTitle>
          <div className="space-y-3.5">
            {section.fields.map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{f.label}</span>
                {f.type === 'toggle' ? (
                  <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${f.value ? 'bg-blue-500' : 'bg-slate-200'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${f.value ? 'left-4' : 'left-0.5'}`} />
                  </div>
                ) : (
                  <div className="px-3 py-1.5 bg-slate-50 rounded-lg text-xs text-slate-600 border border-[#E4E8F0]">{f.value}</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function SalesWorkspace({ onNavigate: _onNavigate }: { onNavigate: (v: AppView) => void }) {
  const [tab, setTab] = useState('Overview')

  return (
    <div className="min-h-screen">
      <WorkspaceHeader
        name="Sales Agent"
        icon="📈"
        badge="Running · 12 tasks queued"
        confidence={87}
        color="#0284C7"
        bgColor="#F0F9FF"
        description="Lead scoring, pipeline intelligence, follow-up automation, and revenue forecasting"
      />
      <div className="px-8">
        <TabNav tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="px-8 pb-8 mt-6 tab-panel">
        {tab === 'Overview' && <SalesOverview />}
        {tab === 'Pipeline' && <Pipeline />}
        {tab === 'Lead Intelligence' && <LeadIntelligence />}
        {tab === 'Follow-ups' && <Followups />}
        {tab === 'Forecasting' && <Forecasting />}
        {tab === 'Knowledge' && (
          <div className="grid grid-cols-3 gap-6">
            <KnowledgePanel />
            <div className="col-span-2"><BrainLog entries={BRAIN_LOG} /></div>
          </div>
        )}
        {tab === 'Analytics' && <SalesAnalytics />}
        {tab === 'Settings' && <SalesSettings />}
      </div>
    </div>
  )
}
