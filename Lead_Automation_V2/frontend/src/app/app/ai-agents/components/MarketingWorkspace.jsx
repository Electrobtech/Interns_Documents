'use client';
import { useState } from 'react';
import {
  WorkspaceHeader, TabNav, Card, CardHover, Badge, SectionTitle, Label, Value,
  KnowledgePanel, BrainLog, TaskQueue, ApprovalQueue, ConfidenceMeter,
  MetricsRow, MiniBarChart, ScoreBar, Divider, TimelineItem, Mono,
} from './SharedUI';
import {
  Target, Globe, Sparkles, RefreshCw, TrendingUp, Download,
  ChevronRight, AlertCircle, ArrowUpRight, Search,
  Mail, MessageSquare, LayoutGrid, List,
} from 'lucide-react';

const TABS = ['Overview', 'Campaign Studio', 'Content Studio', 'SEO', 'AEO', 'Personas', 'Competitor Intel', 'CTWA Ads', 'Calendar', 'Analytics', 'Knowledge', 'Settings'];

const BRAIN_LOG = [
  { time: '09:41', type: 'retrieve', text: 'Retrieved 47 product docs + Q3 campaign history from knowledge base' },
  { time: '09:41', type: 'thinking', text: 'Analyzing target audience signals: mid-market SaaS, 50–500 employees, EU/US regions' },
  { time: '09:42', type: 'action', text: 'Generating campaign brief using Campaign Planner module' },
  { time: '09:42', type: 'output', text: 'Draft brief ready — confidence 92% — pending human approval' },
  { time: '09:40', type: 'thinking', text: 'SEO gap analysis: identified 12 low-competition keywords with high intent' },
  { time: '09:38', type: 'action', text: 'Persona Builder: updated ICP "Tech Lead EMEA" with latest CRM signals' },
];

const TASKS = [
  { title: 'Generate Q4 SaaS campaign brief', status: 'running', priority: 'high' },
  { title: 'Update SEO meta for 8 product pages', status: 'queued' },
  { title: 'Draft email sequence — cold lead revival', status: 'queued' },
  { title: 'AEO optimization for FAQ section', status: 'queued', priority: 'high' },
  { title: 'Competitor pricing matrix update', status: 'queued' },
  { title: 'Instagram ad copy — Q4 launch', status: 'queued' },
  { title: 'Brand tone analysis — new website copy', status: 'queued' },
];

const APPROVALS = [
  { title: 'Q4 SaaS Campaign Brief — Launch approval', agent: 'Marketing Agent', confidence: 92 },
  { title: 'Email sequence: Cold Lead Revival Series (5 emails)', agent: 'Marketing Agent', confidence: 86 },
];

function MarketingOverview() {
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'Campaign Health', value: '87%', sub: '3 active campaigns', color: '#10B981' },
        { label: 'AI Confidence', value: '92%', sub: 'Avg across tasks', color: '#7C3AED' },
        { label: 'Leads Generated', value: '342', sub: 'This month', color: '#3B6EF0' },
        { label: 'Content Published', value: '28', sub: 'This month' },
        { label: 'Approval Rate', value: '94%', sub: '17/18 approved', color: '#059669' },
      ]} />

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5 col-span-1">
          <SectionTitle className="mb-4">Current Workflow</SectionTitle>
          <div className="space-y-0">
            {[
              { label: 'Campaign Brief', status: 'done', time: '09:30' },
              { label: 'Audience Analysis', status: 'done', time: '09:35' },
              { label: 'Content Generation', status: 'active', time: '09:42' },
              { label: 'SEO Optimization', status: 'queued', time: '—' },
              { label: 'Human Review', status: 'queued', time: '—' },
              { label: 'Publish', status: 'queued', time: '—' },
            ].map((step, i, arr) => (
              <TimelineItem key={step.label} title={step.label} time={step.time} last={i === arr.length - 1}
                icon={step.status === 'done' ? <span className="text-green-500 text-xs">✓</span> :
                  step.status === 'active' ? <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse block" /> :
                  <span className="w-2 h-2 rounded-full bg-slate-200 block" />}
              />
            ))}
          </div>
        </Card>

        <Card className="p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Recent Campaigns</SectionTitle>
            <Badge variant="info">3 Active</Badge>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Q3 SaaS Mid-Market Outreach', status: 'Active', channel: 'Email + LinkedIn', reach: '4,200', conv: '3.8%', health: 84 },
              { name: 'EMEA Product Launch — Orbq Pro', status: 'Active', channel: 'Meta + Search', reach: '18,000', conv: '2.1%', health: 91 },
              { name: 'Cold Lead Revival — Q2 Churned', status: 'Active', channel: 'Email + WhatsApp', reach: '620', conv: '6.2%', health: 78 },
              { name: 'Webinar: AI in Sales 2026', status: 'Scheduled', channel: 'Email + LinkedIn', reach: '—', conv: '—', health: 0 },
            ].map(c => (
              <div key={c.name} className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-default">
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#0F1929] truncate">{c.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{c.channel}</div>
                </div>
                <Badge variant={c.status === 'Active' ? 'success' : 'warning'}>{c.status}</Badge>
                <div className="text-center hidden lg:block">
                  <div className="text-xs font-semibold text-[#0F1929]">{c.reach}</div>
                  <div className="text-xs text-slate-400">reach</div>
                </div>
                <div className="text-center hidden xl:block">
                  <div className="text-xs font-semibold text-[#0F1929]">{c.conv}</div>
                  <div className="text-xs text-slate-400">conv.</div>
                </div>
                {c.health > 0 && <div className="w-20 hidden lg:block"><ConfidenceMeter value={c.health} color="#7C3AED" /></div>}
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
  );
}

function CampaignStudio() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-5">
            <SectionTitle>Campaign Brief</SectionTitle>
            <div className="flex items-center gap-2">
              <Badge variant="warning">Draft</Badge>
              <button className="text-xs text-[#7C3AED] font-medium flex items-center gap-1"><RefreshCw size={11} /> Regenerate</button>
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Campaign Name', value: 'Q4 SaaS Mid-Market Expansion' },
              { label: 'Campaign Goal', value: 'Generate 120 qualified leads in Q4, drive 15% MoM pipeline growth' },
              { label: 'Target Audience', value: 'B2B SaaS companies, 50–500 employees, CTO/RevOps/Marketing personas, EMEA & US' },
              { label: 'Channels', value: 'Email, LinkedIn Ads, Meta CTWA, Google Search' },
              { label: 'Budget', value: '$28,000 / month · AI-optimized allocation' },
              { label: 'Duration', value: 'Oct 1 – Dec 31, 2026 (13 weeks)' },
            ].map(f => (
              <div key={f.label} className="grid grid-cols-3 gap-3">
                <Label>{f.label}</Label>
                <div className="col-span-2 text-sm text-slate-700">{f.value}</div>
              </div>
            ))}
          </div>
          <Divider className="my-5" />
          <div>
            <Label>Expected Performance</Label>
            <div className="grid grid-cols-4 gap-3 mt-2">
              {[
                { label: 'Impressions', value: '380K' },
                { label: 'Clicks', value: '12,400' },
                { label: 'Leads', value: '148' },
                { label: 'Pipeline Value', value: '$740K' },
              ].map(m => (
                <div key={m.label} className="p-3 rounded-xl bg-purple-50 text-center">
                  <div className="text-lg font-bold text-purple-700" style={{ fontFamily: "'Outfit', sans-serif" }}>{m.value}</div>
                  <div className="text-xs text-purple-400">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle className="mb-4">Campaign Timeline</SectionTitle>
          <div className="relative">
            <div className="h-1 bg-slate-100 rounded-full mb-4" />
            <div className="grid grid-cols-4 gap-2">
              {[
                { phase: 'Awareness', weeks: 'Wk 1–4', desc: 'LinkedIn + Meta reach campaigns' },
                { phase: 'Consideration', weeks: 'Wk 5–8', desc: 'Email nurture + retargeting' },
                { phase: 'Conversion', weeks: 'Wk 9–11', desc: 'Demo outreach + CTWA' },
                { phase: 'Retention', weeks: 'Wk 12–13', desc: 'Onboarding + upsell flows' },
              ].map((p, i) => (
                <div key={p.phase} className="p-3.5 rounded-xl border border-[#E4E8F0] relative">
                  <div className="absolute top-0 left-4 -translate-y-1/2 w-4 h-4 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center">
                    <span className="text-purple-600 text-xs font-bold">{i + 1}</span>
                  </div>
                  <div className="mt-1 font-semibold text-xs text-[#0F1929]">{p.phase}</div>
                  <div className="text-xs text-purple-600 font-mono mt-0.5">{p.weeks}</div>
                  <div className="text-xs text-slate-400 mt-1.5">{p.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-4">Approval Status</SectionTitle>
          <div className="space-y-2.5">
            {[
              { item: 'Campaign Brief', status: 'approved' },
              { item: 'Audience Targeting', status: 'approved' },
              { item: 'Creative Assets', status: 'pending' },
              { item: 'Budget Allocation', status: 'pending' },
              { item: 'Launch Authorization', status: 'waiting' },
            ].map(a => (
              <div key={a.item} className="flex items-center justify-between">
                <span className="text-xs text-slate-600">{a.item}</span>
                <Badge variant={a.status === 'approved' ? 'success' : a.status === 'pending' ? 'warning' : 'default'}>{a.status}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <TaskQueue tasks={TASKS.slice(0, 4)} />
        <KnowledgePanel />
      </div>
    </div>
  );
}

function ContentStudio() {
  const tools = [
    { icon: <Mail size={18} />, label: 'Email Generator', desc: 'AI-crafted email sequences and newsletters', color: '#3B6EF0', bg: '#EEF2FF' },
    { icon: <Globe size={18} />, label: 'Social Media Posts', desc: 'LinkedIn, X, Instagram captions and threads', color: '#E1306C', bg: '#FFF0F5' },
    { icon: <MessageSquare size={18} />, label: 'WhatsApp Broadcasts', desc: 'Personalized WA messages at scale', color: '#25D366', bg: '#F0FFF4' },
    { icon: <Target size={18} />, label: 'Ad Copy', desc: 'High-converting headlines and descriptions', color: '#F59E0B', bg: '#FFFBEB' },
    { icon: <Globe size={18} />, label: 'Landing Page Copy', desc: 'Full-page persuasive copy with CTA', color: '#7C3AED', bg: '#F5F3FF' },
    { icon: <Sparkles size={18} />, label: 'Blog Generator', desc: 'Long-form SEO-optimized articles', color: '#0284C7', bg: '#F0F9FF' },
    { icon: <ArrowUpRight size={18} />, label: 'CTA Generator', desc: 'Action-driven button and banner copy', color: '#059669', bg: '#F0FDF4' },
    { icon: <Search size={18} />, label: 'Review Replies', desc: 'Respond to G2 / Trustpilot reviews', color: '#6366F1', bg: '#EEF2FF' },
    { icon: <TrendingUp size={18} />, label: 'Content Variations', desc: 'A/B test variants from a single brief', color: '#DC2626', bg: '#FFF1F2' },
    { icon: <Download size={18} />, label: 'Export Assets', desc: 'Download all content in CSV or PDF', color: '#64748B', bg: '#F8FAFC' },
  ];
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
        {tools.map(t => (
          <CardHover key={t.label} className="p-5 cursor-pointer group">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110" style={{ background: t.bg, color: t.color }}>{t.icon}</div>
            <div className="text-sm font-semibold text-[#0F1929] mb-1">{t.label}</div>
            <div className="text-xs text-slate-400 leading-relaxed">{t.desc}</div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: t.color }}>
              Generate <ChevronRight size={11} />
            </div>
          </CardHover>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>Recent AI Outputs</SectionTitle>
          <Badge variant="info">12 this week</Badge>
        </div>
        <div className="space-y-2.5">
          {[
            { type: 'Email', title: 'Cold Lead Revival — Series 1 of 5', created: '2h ago', status: 'approved' },
            { type: 'LinkedIn', title: 'Q4 Thought Leadership Post — AI in RevOps', created: '3h ago', status: 'pending' },
            { type: 'Blog', title: 'How AI Agents Replace 3 Marketing Hires', created: 'Yesterday', status: 'approved' },
            { type: 'Ad Copy', title: 'Meta Q4 Campaign — 4 headline variants', created: 'Yesterday', status: 'pending' },
          ].map(o => (
            <div key={o.title} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
              <Badge variant="purple">{o.type}</Badge>
              <span className="text-xs text-slate-700 flex-1">{o.title}</span>
              <span className="text-xs text-slate-400">{o.created}</span>
              <Badge variant={o.status === 'approved' ? 'success' : 'warning'}>{o.status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SEOWorkspace() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <MetricsRow metrics={[
          { label: 'SEO Score', value: '74/100', color: '#F59E0B' },
          { label: 'Keywords Tracked', value: '148', sub: '+12 new' },
          { label: 'Search Visibility', value: '38%', sub: '+4% MoM', color: '#10B981' },
          { label: 'Backlinks', value: '1,240', sub: '+34 this month' },
        ]} />

        <Card className="p-5">
          <SectionTitle className="mb-4">Keyword Opportunities</SectionTitle>
          <div className="space-y-3">
            {[
              { keyword: 'AI lead automation software', volume: '4,400/mo', difficulty: 32, opportunity: 'High' },
              { keyword: 'sales agent AI platform', volume: '2,900/mo', difficulty: 28, opportunity: 'High' },
              { keyword: 'best CRM automation tool 2026', volume: '1,800/mo', difficulty: 41, opportunity: 'Medium' },
              { keyword: 'AI for marketing automation', volume: '6,600/mo', difficulty: 55, opportunity: 'Medium' },
              { keyword: 'lead scoring automation', volume: '880/mo', difficulty: 19, opportunity: 'High' },
            ].map(k => (
              <div key={k.keyword} className="grid grid-cols-5 gap-3 items-center p-3 rounded-xl bg-slate-50">
                <div className="col-span-2 text-xs font-medium text-[#0F1929]">{k.keyword}</div>
                <div className="text-xs text-slate-500">{k.volume}</div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 flex-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${k.difficulty}%`, background: k.difficulty > 45 ? '#EF4444' : k.difficulty > 30 ? '#F59E0B' : '#10B981' }} />
                  </div>
                  <span className="text-xs text-slate-400">{k.difficulty}</span>
                </div>
                <Badge variant={k.opportunity === 'High' ? 'success' : 'warning'}>{k.opportunity}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-3">Content Optimization</SectionTitle>
          <div className="space-y-3">
            <ScoreBar label="Keyword Density" value={72} color="#7C3AED" />
            <ScoreBar label="Readability Score" value={84} color="#0284C7" />
            <ScoreBar label="Content Length" value={68} color="#F59E0B" />
            <ScoreBar label="Media Richness" value={45} color="#EF4444" />
          </div>
        </Card>
        <KnowledgePanel />
      </div>
    </div>
  );
}

function AEOWorkspace() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <MetricsRow metrics={[
          { label: 'AI Readiness Score', value: '61/100', color: '#F59E0B' },
          { label: 'Google AI Overview', value: '3/10', color: '#EF4444' },
          { label: 'ChatGPT Visibility', value: '4/10', color: '#F59E0B' },
          { label: 'Perplexity Score', value: '5/10', color: '#F59E0B' },
        ]} />
        <Card className="p-5">
          <SectionTitle className="mb-4">AI Engine Visibility</SectionTitle>
          <div className="space-y-4">
            {[
              { engine: 'Google AI Overviews', score: 3, max: 10, status: 'Low', tip: 'Add structured FAQ schema and direct answers' },
              { engine: 'ChatGPT / GPT-4o', score: 4, max: 10, status: 'Low', tip: 'Increase citation-worthy content and stats' },
              { engine: 'Perplexity AI', score: 5, max: 10, status: 'Medium', tip: 'Improve domain authority and data freshness' },
              { engine: 'Bing Copilot', score: 6, max: 10, status: 'Medium', tip: 'Optimize Bing Webmaster and structured data' },
              { engine: 'Claude / Anthropic', score: 4, max: 10, status: 'Low', tip: 'Focus on authoritative, well-cited content' },
            ].map(e => (
              <div key={e.engine} className="p-4 rounded-xl border border-[#E4E8F0]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-[#0F1929]">{e.engine}</span>
                  <div className="flex items-center gap-2">
                    <Mono color="#0F1929">{e.score}/{e.max}</Mono>
                    <Badge variant={e.status === 'Low' ? 'error' : 'warning'}>{e.status}</Badge>
                  </div>
                </div>
                <ConfidenceMeter value={(e.score / e.max) * 100} color={e.score <= 4 ? '#EF4444' : '#F59E0B'} />
                <div className="text-xs text-slate-400 mt-2 flex items-start gap-1.5">
                  <Sparkles size={11} className="text-purple-400 flex-shrink-0 mt-0.5" />
                  {e.tip}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-4">AI Recommendations</SectionTitle>
          <div className="space-y-3">
            {[
              'Add "What is" definitions to all product pages',
              'Include structured Q&A schema on blog posts',
              'Cite proprietary data and research stats',
              'Reduce jargon — write for AI-readable summaries',
              'Add "In summary" sections to long-form content',
            ].map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-slate-600">
                <span className="w-5 h-5 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 font-bold flex-shrink-0 text-xs">{i + 1}</span>
                {r}
              </div>
            ))}
          </div>
        </Card>
        <KnowledgePanel />
      </div>
    </div>
  );
}

function PersonaWorkspace() {
  const personas = [
    { name: 'Tech Lead · EMEA', role: 'Head of RevOps', company: 'SaaS 50–200 employees', goals: 'Automate manual CRM tasks, reduce sales cycle', pains: 'Too much manual data entry, poor lead quality from marketing', channels: 'LinkedIn, Email, Webinars', conversion: 68, color: '#7C3AED', bg: '#F5F3FF' },
    { name: 'CMO · Growth Stage', role: 'Chief Marketing Officer', company: 'B2B SaaS 200–500 employees', goals: 'Scale content output, improve MQL quality', pains: 'Content team bottleneck, attribution unclear', channels: 'Email, Events, Paid Search', conversion: 52, color: '#0284C7', bg: '#F0F9FF' },
    { name: 'Sales Director · US', role: 'VP of Sales', company: 'Enterprise 500+ employees', goals: 'Increase win rate, shorten deal cycles', pains: 'Reps waste time on unqualified leads', channels: 'Outbound, Referrals, LinkedIn', conversion: 74, color: '#059669', bg: '#F0FDF4' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-6">
        {personas.map(p => (
          <Card key={p.name} className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white text-sm" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}AA)` }}>{p.name.charAt(0)}</div>
              <div>
                <div className="text-sm font-semibold text-[#0F1929]">{p.name}</div>
                <div className="text-xs text-slate-400">{p.role}</div>
              </div>
            </div>
            <div className="space-y-3 mb-4">
              {[
                { label: 'Company Size', value: p.company },
                { label: 'Goals', value: p.goals },
                { label: 'Pain Points', value: p.pains },
                { label: 'Channels', value: p.channels },
              ].map(f => (
                <div key={f.label}>
                  <Label>{f.label}</Label>
                  <Value className="text-xs font-normal text-slate-600 leading-relaxed">{f.value}</Value>
                </div>
              ))}
            </div>
            <Divider className="mb-3" />
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-400">Conversion Potential</span>
                <Mono color={p.color}>{p.conversion}%</Mono>
              </div>
              <ConfidenceMeter value={p.conversion} color={p.color} />
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <SectionTitle className="mb-4">Customer Journey Map</SectionTitle>
        <div className="grid grid-cols-5 gap-4">
          {['Awareness', 'Interest', 'Consideration', 'Intent', 'Purchase'].map((stage, i) => (
            <div key={stage} className="text-center">
              <div className="w-8 h-8 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-white text-xs" style={{ background: `hsl(${220 + i * 20}, 70%, ${50 - i * 3}%)` }}>{i + 1}</div>
              <div className="text-xs font-semibold text-[#0F1929] mb-1">{stage}</div>
              <div className="text-xs text-slate-400 leading-relaxed">{['Content discovery · SEO', 'Webinar · Blog', 'Demo request · Trial', 'Proposal · Pricing', 'Signed contract'][i]}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CompetitorIntel() {
  const competitors = ['HubSpot AI', 'Salesforce Einstein', 'Marketo Engage', 'Lemlist'];
  const features = [
    { feature: 'AI Lead Scoring', orbq: true, hub: true, sf: true, mk: false, lm: false },
    { feature: 'Multi-Agent Architecture', orbq: true, hub: false, sf: false, mk: false, lm: false },
    { feature: 'WhatsApp (CTWA) Ads', orbq: true, hub: false, sf: false, mk: false, lm: true },
    { feature: 'AEO Optimization', orbq: true, hub: false, sf: false, mk: false, lm: false },
    { feature: 'RAG-Grounded Responses', orbq: true, hub: false, sf: true, mk: false, lm: false },
    { feature: 'Cold Lead Revival AI', orbq: true, hub: true, sf: false, mk: true, lm: true },
    { feature: 'Support + Sales + Marketing unified', orbq: true, hub: true, sf: true, mk: false, lm: false },
  ];
  return (
    <div className="space-y-6">
      <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50 flex items-start gap-3">
        <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-700 leading-relaxed"><strong>Disclaimer:</strong> Insights are AI-generated from publicly available data and should be verified before strategic decisions. Last updated: Aug 3, 2026.</p>
      </div>
      <Card className="p-5 overflow-x-auto">
        <SectionTitle className="mb-4">Feature Comparison Matrix</SectionTitle>
        <table className="w-full min-w-[600px]">
          <thead>
            <tr>
              <th className="text-left text-xs text-slate-400 font-medium pb-3 w-48">Feature</th>
              <th className="text-center text-xs font-bold text-purple-700 pb-3 px-3">Orbq</th>
              {competitors.map(c => <th key={c} className="text-center text-xs text-slate-500 font-medium pb-3 px-3">{c}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F4F6FA]">
            {features.map(row => (
              <tr key={row.feature}>
                <td className="py-2.5 text-xs text-slate-600">{row.feature}</td>
                {[row.orbq, row.hub, row.sf, row.mk, row.lm].map((has, i) => (
                  <td key={i} className="text-center py-2.5 px-3">{has ? <span className="text-green-500">✓</span> : <span className="text-slate-200">—</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function CTWAWorkspace() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <Card className="p-6">
          <SectionTitle className="mb-5">Meta Campaign Builder · Click-to-WhatsApp</SectionTitle>
          <div className="space-y-4">
            {[
              { label: 'Ad Objective', value: 'Lead Generation via WhatsApp' },
              { label: 'Headline', value: 'Automate Your Sales Pipeline — AI Does the Heavy Lifting' },
              { label: 'Primary Text', value: "Stop chasing cold leads. Orbq's AI agents qualify, score, and engage leads automatically — 24/7. Start your free trial." },
              { label: 'CTA Button Text', value: 'Chat on WhatsApp' },
            ].map(f => (
              <div key={f.label} className="grid grid-cols-3 gap-4">
                <Label>{f.label}</Label>
                <div className="col-span-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-700 leading-relaxed">{f.value}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-3">Ad Preview</SectionTitle>
          <div className="rounded-xl overflow-hidden border border-[#E4E8F0]">
            <div className="bg-slate-100 h-28 flex items-center justify-center text-slate-300 text-sm">[Ad Creative]</div>
            <div className="p-3 bg-white">
              <div className="text-xs text-slate-400 mb-0.5">orbq.ai · Sponsored</div>
              <div className="text-sm font-semibold text-[#0F1929] leading-tight">Automate Your Sales Pipeline — AI Does the Heavy Lifting</div>
              <div className="text-xs text-slate-500 mt-1">Trusted by 400+ B2B teams · RAG-powered</div>
              <button className="mt-2 w-full py-2 rounded-lg bg-green-500 text-white text-xs font-semibold">Chat on WhatsApp</button>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-3">Expected Performance</SectionTitle>
          <div className="space-y-2.5">
            {[
              { label: 'Expected CTR', value: '3.2%', color: '#10B981' },
              { label: 'Est. CPL', value: '$18.40', color: '#0284C7' },
              { label: 'Compliance Score', value: '96/100', color: '#7C3AED' },
              { label: 'WA Opt-in Rate', value: '~42%', color: '#F59E0B' },
            ].map(m => (
              <div key={m.label} className="flex items-center justify-between">
                <Label>{m.label}</Label>
                <Mono color={m.color}>{m.value}</Mono>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MarketingCalendar() {
  const [view, setView] = useState('month');
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  const events = {
    3: [{ label: 'Campaign Brief', color: '#7C3AED' }],
    7: [{ label: 'Email Sequence', color: '#3B6EF0' }],
    10: [{ label: 'LinkedIn Ads', color: '#0284C7' }],
    14: [{ label: 'Webinar: AI in Sales', color: '#059669' }],
    17: [{ label: 'Meta CTWA Launch', color: '#25D366' }],
    21: [{ label: 'SEO Audit', color: '#F59E0B' }],
    24: [{ label: 'Q4 Review', color: '#EF4444' }],
    28: [{ label: 'Newsletter', color: '#3B6EF0' }],
  };
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>October 2026</h3>
          <p className="text-xs text-slate-400 mt-0.5">8 events scheduled · 3 pending approval</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView('month')} className={`p-2 rounded-lg transition-all ${view === 'month' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:bg-slate-50'}`}><LayoutGrid size={15} /></button>
          <button onClick={() => setView('list')} className={`p-2 rounded-lg transition-all ${view === 'list' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:bg-slate-50'}`}><List size={15} /></button>
        </div>
      </div>
      <Card className="p-5">
        {view === 'month' ? (
          <>
            <div className="grid grid-cols-7 mb-2">
              {DOW.map(d => <div key={d} className="text-center text-xs font-medium text-slate-400 pb-2">{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map(day => (
                <div key={day} className={`min-h-[64px] p-1.5 rounded-xl border text-xs ${day === 3 ? 'border-purple-200 bg-purple-50' : 'border-transparent hover:border-[#E4E8F0]'} transition-all cursor-default`}>
                  <div className={`text-xs font-medium mb-1 ${day === 3 ? 'text-purple-700' : 'text-slate-500'}`}>{day}</div>
                  {events[day]?.map(e => (
                    <div key={e.label} className="text-xs px-1.5 py-0.5 rounded mb-0.5 truncate text-white" style={{ background: e.color, fontSize: 9 }}>{e.label}</div>
                  ))}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            {Object.entries(events).sort(([a], [b]) => Number(a) - Number(b)).map(([day, evs]) =>
              evs.map(e => (
                <div key={`${day}-${e.label}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                  <div className="w-1 h-6 rounded-full" style={{ background: e.color }} />
                  <div>
                    <div className="text-xs font-medium text-[#0F1929]">{e.label}</div>
                    <div className="text-xs text-slate-400">Oct {day}, 2026</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function MarketingAnalytics() {
  const weeklyLeads = [
    { label: 'W35', value: 38 }, { label: 'W36', value: 52 }, { label: 'W37', value: 47 },
    { label: 'W38', value: 61 }, { label: 'W39', value: 74 }, { label: 'W40', value: 70 },
  ];
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'Total Reach', value: '42,000', sub: '+18% MoM', color: '#3B6EF0' },
        { label: 'Engagement Rate', value: '4.8%', sub: '+0.6pp', color: '#7C3AED' },
        { label: 'Conversions', value: '342', sub: '+28% MoM', color: '#10B981' },
        { label: 'Pipeline Value', value: '$1.24M', sub: '+32%', color: '#059669' },
        { label: 'Avg CAC', value: '$186', sub: '−14%', color: '#0284C7' },
      ]} />
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Weekly Lead Generation</SectionTitle>
          <MiniBarChart data={weeklyLeads} color="#7C3AED" />
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-4">Top Performing Channels</SectionTitle>
          <div className="space-y-3">
            {[
              { channel: 'Email Sequences', leads: 128, conv: '7.4%', color: '#3B6EF0' },
              { channel: 'LinkedIn Ads', leads: 89, conv: '3.8%', color: '#0284C7' },
              { channel: 'Meta CTWA', leads: 74, conv: '5.2%', color: '#25D366' },
              { channel: 'Organic SEO', leads: 51, conv: '2.1%', color: '#F59E0B' },
            ].map(c => (
              <div key={c.channel} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="text-xs text-slate-600 flex-1">{c.channel}</span>
                <Mono color="#0F1929">{c.leads}</Mono>
                <Badge variant="success">{c.conv}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MarketingSettings() {
  return (
    <div className="max-w-2xl space-y-5">
      {[
        { title: 'Agent Behavior', fields: [
          { label: 'Auto-publish approved content', type: 'toggle', value: false },
          { label: 'Require human approval for campaigns over $10K', type: 'toggle', value: true },
          { label: 'Confidence threshold for auto-execution', type: 'select', value: '90%' },
        ]},
        { title: 'Brand & Tone', fields: [
          { label: 'Default brand voice', type: 'select', value: 'Professional & concise' },
          { label: 'Prohibited words list', type: 'text', value: '12 words configured' },
          { label: 'Target reading level', type: 'select', value: 'Grade 9 (B2B standard)' },
        ]},
        { title: 'Notifications', fields: [
          { label: 'Email on task completion', type: 'toggle', value: true },
          { label: 'Slack alert on pending approval', type: 'toggle', value: true },
          { label: 'Weekly performance digest', type: 'toggle', value: true },
        ]},
      ].map(section => (
        <Card key={section.title} className="p-5">
          <SectionTitle className="mb-4">{section.title}</SectionTitle>
          <div className="space-y-3.5">
            {section.fields.map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{f.label}</span>
                {f.type === 'toggle' ? (
                  <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${f.value ? 'bg-purple-500' : 'bg-slate-200'}`}>
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
  );
}

export default function MarketingWorkspace() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="min-h-screen">
      <WorkspaceHeader name="Marketing Agent" icon="📣" badge="Running · 7 tasks queued" confidence={92}
        color="#7C3AED" bgColor="#F5F3FF" description="Campaign automation, content generation, SEO/AEO, and market intelligence" />
      <div className="px-8">
        <TabNav tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="px-8 pb-8 mt-6">
        {tab === 'Overview' && <MarketingOverview />}
        {tab === 'Campaign Studio' && <CampaignStudio />}
        {tab === 'Content Studio' && <ContentStudio />}
        {tab === 'SEO' && <SEOWorkspace />}
        {tab === 'AEO' && <AEOWorkspace />}
        {tab === 'Personas' && <PersonaWorkspace />}
        {tab === 'Competitor Intel' && <CompetitorIntel />}
        {tab === 'CTWA Ads' && <CTWAWorkspace />}
        {tab === 'Calendar' && <MarketingCalendar />}
        {tab === 'Analytics' && <MarketingAnalytics />}
        {tab === 'Knowledge' && (
          <div className="grid grid-cols-3 gap-6">
            <KnowledgePanel />
            <div className="col-span-2"><BrainLog entries={BRAIN_LOG} /></div>
          </div>
        )}
        {tab === 'Settings' && <MarketingSettings />}
      </div>
    </div>
  );
}
