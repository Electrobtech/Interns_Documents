'use client';
import { useState } from 'react';
import {
  WorkspaceHeader, TabNav, Card, CardHover, Badge, SectionTitle, Label, Value,
  KnowledgePanel, BrainLog, TaskQueue, ApprovalQueue, ConfidenceMeter,
  MetricsRow, MiniBarChart, Divider, TimelineItem, Mono,
} from './SharedUI';
import {
  Inbox, AlertTriangle, CheckCircle2, Clock, RefreshCw,
  MessageSquare, Mail, Search, BookOpen, TrendingUp, XCircle
} from 'lucide-react';

const TABS = ['Overview', 'Inbox', 'Tickets', 'Knowledge', 'Escalations', 'Analytics', 'Settings'];

const BRAIN_LOG = [
  { time: '09:41', type: 'retrieve', text: 'Classified ticket #1142: Billing dispute — Priority High, routed to finance queue' },
  { time: '09:41', type: 'thinking', text: 'CSAT risk detected for ticket #1138: Customer sentiment declining across 3 messages' },
  { time: '09:42', type: 'action', text: 'Generating suggested reply for ticket #1139 — referencing KB article #A-84' },
  { time: '09:42', type: 'output', text: 'Reply drafted with 94% confidence — pending agent review' },
  { time: '09:40', type: 'action', text: 'SLA monitoring: ticket #1135 escalated — 2h to breach' },
  { time: '09:39', type: 'thinking', text: 'Analyzing customer history: 3 previous tickets, avg CSAT 3.2 — handle with care' },
];

const TASKS = [
  { title: 'Classify 8 incoming tickets', status: 'running', priority: 'high' },
  { title: 'Draft replies for 5 open tickets', status: 'queued' },
  { title: 'SLA alert: ticket #1135 escalate', status: 'queued', priority: 'high' },
  { title: 'CSAT risk: follow up with Maria Lopez', status: 'queued' },
  { title: 'Knowledge base update: new pricing FAQ', status: 'queued' },
];

function SupportOverview() {
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'Open Tickets', value: '47', sub: '+8 today', color: '#3B6EF0' },
        { label: 'Pending Replies', value: '12', sub: '3 overdue', color: '#EF4444' },
        { label: 'CSAT Score', value: '4.3/5', sub: '+0.2 this week', color: '#10B981' },
        { label: 'Avg Resolution', value: '4h 12m', sub: '−28 min', color: '#059669' },
        { label: 'AI Confidence', value: '94%', color: '#7C3AED' },
        { label: 'Escalations', value: '2', sub: 'Active', color: '#F59E0B' },
      ]} />

      <div className="grid grid-cols-3 gap-6">
        <Card className="p-5 col-span-2">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Recent Tickets</SectionTitle>
            <Badge variant="error">3 SLA at risk</Badge>
          </div>
          <div className="space-y-2.5">
            {[
              { id: '#1142', customer: 'Maria Lopez', subject: 'Invoice discrepancy — charged twice for Pro plan', priority: 'High', status: 'Open' },
              { id: '#1141', customer: 'Ben Park', subject: 'API integration not working after update v2.4', priority: 'Medium', status: 'In Progress' },
              { id: '#1140', customer: 'Aiko Tanaka', subject: 'Cannot export leads to Salesforce', priority: 'Medium', status: 'Replied' },
              { id: '#1139', customer: 'Carlos Rivera', subject: 'Feature request: bulk email import', priority: 'Low', status: 'Open' },
              { id: '#1138', customer: 'Lena Fischer', subject: 'Account access revoked without notice', priority: 'High', status: 'Escalated' },
            ].map(t => (
              <div key={t.id} className="grid grid-cols-6 gap-3 items-center p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-default text-xs">
                <Mono color="#94A3B8">{t.id}</Mono>
                <span className="text-slate-700 font-medium">{t.customer}</span>
                <span className="col-span-2 text-slate-500 truncate">{t.subject}</span>
                <Badge variant={t.priority === 'High' ? 'error' : t.priority === 'Medium' ? 'warning' : 'default'}>{t.priority}</Badge>
                <Badge variant={t.status === 'Escalated' ? 'error' : t.status === 'Replied' ? 'success' : 'info'}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle className="mb-4">Ticket Categories</SectionTitle>
            <div className="space-y-3">
              {[
                { cat: 'Billing & Payments', count: 14, color: '#EF4444' },
                { cat: 'Technical Issues', count: 18, color: '#3B6EF0' },
                { cat: 'Feature Requests', count: 9, color: '#7C3AED' },
                { cat: 'Account Access', count: 6, color: '#F59E0B' },
              ].map(c => (
                <div key={c.cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">{c.cat}</span>
                    <Mono color={c.color}>{c.count}</Mono>
                  </div>
                  <ConfidenceMeter value={(c.count / 18) * 100} color={c.color} />
                </div>
              ))}
            </div>
          </Card>
          <TaskQueue tasks={TASKS} />
        </div>
      </div>
    </div>
  );
}

function SupportInbox() {
  const [selected, setSelected] = useState('#1142');
  const tickets = [
    { id: '#1142', customer: 'Maria Lopez', subject: 'Invoice discrepancy', time: '09:31', unread: true, sentiment: 'Frustrated', priority: 'High' },
    { id: '#1141', customer: 'Ben Park', subject: 'API issue v2.4', time: '09:18', unread: false, sentiment: 'Neutral', priority: 'Medium' },
    { id: '#1139', customer: 'Carlos Rivera', subject: 'Bulk email import', time: '08:54', unread: false, sentiment: 'Positive', priority: 'Low' },
    { id: '#1138', customer: 'Lena Fischer', subject: 'Account access revoked', time: '08:30', unread: true, sentiment: 'Very Frustrated', priority: 'High' },
  ];

  return (
    <div className="flex gap-5 h-[calc(100vh-260px)] min-h-96">
      <Card className="w-72 flex-shrink-0 overflow-y-auto p-3">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 mb-3">
          <Search size={13} className="text-slate-400" />
          <input className="bg-transparent text-xs outline-none flex-1 text-slate-600 placeholder-slate-300" placeholder="Search tickets..." />
        </div>
        <div className="space-y-1.5">
          {tickets.map(t => (
            <div
              key={t.id}
              onClick={() => setSelected(t.id)}
              className={`p-3 rounded-xl cursor-pointer transition-all ${selected === t.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between mb-1">
                <span className={`text-xs font-medium ${t.unread ? 'text-[#0F1929]' : 'text-slate-500'}`}>{t.customer}</span>
                <Mono color="#94A3B8">{t.time}</Mono>
              </div>
              <div className="text-xs text-slate-400 truncate">{t.subject}</div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <Badge variant={t.priority === 'High' ? 'error' : t.priority === 'Medium' ? 'warning' : 'default'}>{t.priority}</Badge>
                {t.unread && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex-1 flex flex-col gap-4 min-w-0">
        <Card className="flex-1 p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold text-[#0F1929] text-sm">Maria Lopez</div>
              <div className="text-xs text-slate-400">Invoice discrepancy — charged twice for Pro plan · <span className="text-red-500">High Priority</span></div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="error">Frustrated</Badge>
              <Badge variant="warning">CSAT Risk</Badge>
            </div>
          </div>
          <Divider className="mb-4" />
          <div className="space-y-4">
            {[
              { from: 'Maria Lopez', text: "Hi, I was charged twice for the Pro plan this month. I can see two transactions of $299 on my card ending in 4521. This is really frustrating — please fix this ASAP.", time: '09:31', type: 'customer' },
              { from: 'AI Draft (Review before sending)', text: "Hi Maria, thank you for reaching out. I completely understand how frustrating a double charge is. I've looked into your account and can confirm we detected a duplicate payment. I've escalated this to our billing team for an immediate refund — you'll receive the $299 back within 3–5 business days. I'm so sorry for the inconvenience.", time: 'Draft', type: 'draft' },
            ].map((msg, i) => (
              <div key={i} className={`flex ${msg.type === 'draft' ? 'flex-row-reverse' : ''} gap-3`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${msg.type === 'draft' ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                  {msg.from.charAt(0)}
                </div>
                <div className={`max-w-sm ${msg.type === 'draft' ? 'items-end' : ''} flex flex-col gap-1`}>
                  <div className="text-xs text-slate-400">{msg.from}</div>
                  <div className={`p-3.5 rounded-xl text-xs leading-relaxed ${msg.type === 'draft' ? 'bg-green-50 border border-green-200 text-green-900' : 'bg-slate-100 text-slate-700'}`}>
                    {msg.text}
                  </div>
                  <Mono color="#94A3B8">{msg.time}</Mono>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-green-50 flex items-center justify-center">
                <span className="text-green-600 text-xs">✨</span>
              </div>
              <span className="text-xs font-medium text-slate-600">AI suggested reply ready · 94% confidence</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1"><RefreshCw size={11} /> Regenerate</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E4E8F0] text-slate-600 hover:bg-slate-50 transition-all">Edit</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition-all">Approve & Send</button>
            </div>
          </div>
        </Card>
      </div>

      <Card className="w-60 flex-shrink-0 p-4 overflow-y-auto">
        <SectionTitle className="mb-4">Customer Details</SectionTitle>
        <div className="space-y-3">
          {[
            { label: 'Name', value: 'Maria Lopez' },
            { label: 'Company', value: 'Bloom Markets' },
            { label: 'Plan', value: 'Pro · $299/mo' },
            { label: 'Customer since', value: 'Jan 2025' },
            { label: 'Previous tickets', value: '3 total' },
            { label: 'Avg CSAT', value: '3.2 / 5' },
          ].map(f => (
            <div key={f.label}>
              <Label>{f.label}</Label>
              <Value className="text-xs">{f.value}</Value>
            </div>
          ))}
        </div>
        <Divider className="my-4" />
        <SectionTitle className="mb-3">KB Suggestions</SectionTitle>
        <div className="space-y-1.5">
          {[
            'Billing dispute resolution process',
            'Refund policy — duplicate charges',
            'How to download invoices',
          ].map(kb => (
            <div key={kb} className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-500 hover:bg-slate-100 cursor-pointer transition-colors">
              {kb}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Tickets() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle>Ticket #1142 · Detailed View</SectionTitle>
            <div className="flex items-center gap-2">
              <Badge variant="error">High Priority</Badge>
              <Badge variant="warning">SLA: 2h remaining</Badge>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-5">
            {[
              { label: 'Category', value: 'Billing & Payments' },
              { label: 'Resolution Path', value: 'Refund + apology' },
              { label: 'Risk Level', value: 'CSAT Risk Detected' },
              { label: 'SLA Deadline', value: 'Aug 3 · 11:42 AM' },
            ].map(f => (
              <div key={f.label} className="p-3.5 rounded-xl bg-slate-50">
                <Label>{f.label}</Label>
                <Value className="text-xs">{f.value}</Value>
              </div>
            ))}
          </div>

          <div className="mb-5">
            <Label>AI Summary</Label>
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 mt-1">
              <p className="text-xs text-blue-800 leading-relaxed">Customer was double-charged for Pro plan due to a billing system error on Aug 1. The customer is frustrated (CSAT risk). Recommended path: immediate refund via Stripe, compensation email with $50 credit, and escalate root cause to engineering. Resolution confidence: 94%.</p>
            </div>
          </div>

          <div>
            <Label>Resolution Steps</Label>
            <div className="space-y-2 mt-1">
              {[
                { step: 'Verify duplicate charge in Stripe dashboard', done: true },
                { step: 'Issue refund of $299 to card ending 4521', done: true },
                { step: 'Send apology email with refund confirmation', done: false },
                { step: 'Add $50 credit to account as compensation', done: false },
                { step: 'Close ticket and request CSAT feedback', done: false },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 p-2.5 rounded-lg bg-slate-50">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${s.done ? 'bg-green-500' : 'bg-slate-200'}`}>
                    {s.done && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className={`text-xs ${s.done ? 'line-through text-slate-400' : 'text-slate-600'}`}>{s.step}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-3">Customer Sentiment</SectionTitle>
          <div className="space-y-2.5">
            {[
              { label: 'Message 1', score: 2, label2: 'Frustrated' },
              { label: 'Message 2', score: 1.5, label2: 'Very Frustrated' },
            ].map(s => (
              <div key={s.label} className="p-3 rounded-xl bg-red-50">
                <div className="flex items-center justify-between mb-1">
                  <Label>{s.label}</Label>
                  <Badge variant="error">{s.label2}</Badge>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <span key={star} className={`text-sm ${star <= s.score ? 'text-red-400' : 'text-slate-200'}`}>★</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-3">Customer History</SectionTitle>
          <div className="space-y-2">
            {[
              { id: '#1108', issue: 'API error', resolved: true, csat: 4 },
              { id: '#1089', issue: 'Billing query', resolved: true, csat: 3 },
              { id: '#1067', issue: 'Feature request', resolved: true, csat: 5 },
            ].map(h => (
              <div key={h.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 text-xs">
                <Mono color="#94A3B8">{h.id}</Mono>
                <span className="text-slate-500">{h.issue}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(s => (
                    <span key={s} className={`${s <= h.csat ? 'text-amber-400' : 'text-slate-200'}`}>★</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
        <KnowledgePanel />
      </div>
    </div>
  );
}

function Escalations() {
  const escalations = [
    {
      id: '#1138', customer: 'Lena Fischer',
      reason: 'Account access revoked without notice — customer threatening legal action',
      tags: ['Legal Mention', 'Account Access', 'High Priority'],
      assigned: 'Manager Queue', sla: '45 min remaining', risk: 'Critical', color: '#EF4444',
    },
    {
      id: '#1129', customer: 'Ahmad Karim',
      reason: 'Refund request > $1,000 — beyond agent authority',
      tags: ['Refund Request', 'Finance Review'],
      assigned: 'Finance Queue', sla: '2h 15min remaining', risk: 'High', color: '#F59E0B',
    },
  ];
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-2xl border border-red-200 bg-red-50 flex items-start gap-3">
        <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-red-700 leading-relaxed"><strong>2 Active Escalations</strong> — These tickets require immediate human attention. AI has paused automated responses.</p>
      </div>

      {escalations.map(e => (
        <Card key={e.id} className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm" style={{ background: e.color }}><AlertTriangle size={16} /></div>
              <div>
                <div className="text-sm font-semibold text-[#0F1929]">{e.customer}</div>
                <Mono color="#94A3B8">{e.id}</Mono>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={e.risk === 'Critical' ? 'error' : 'warning'}>{e.risk}</Badge>
              <span className="text-xs text-red-500 font-medium">SLA: {e.sla}</span>
            </div>
          </div>
          <div className="p-4 bg-red-50 rounded-xl mb-4">
            <p className="text-xs text-slate-700 leading-relaxed">{e.reason}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {e.tags.map(tag => <Badge key={tag} variant="error">{tag}</Badge>)}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-400">Routed to: <span className="font-medium text-slate-600">{e.assigned}</span></div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#E4E8F0] text-slate-600 hover:bg-slate-50 transition-all">View Ticket</button>
              <button className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all">Take Ownership</button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SupportKnowledge() {
  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-5">
        <Card className="p-5">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 mb-4">
            <Search size={14} className="text-slate-400" />
            <input className="bg-transparent text-sm outline-none flex-1 text-slate-600 placeholder-slate-400" placeholder="Search knowledge base..." />
          </div>
          <SectionTitle className="mb-4">Recently Used Articles</SectionTitle>
          <div className="space-y-2.5">
            {[
              { title: 'Billing dispute resolution process', uses: 14, confidence: 96, category: 'Billing' },
              { title: 'Refund policy — Pro and Enterprise plans', uses: 9, confidence: 94, category: 'Billing' },
              { title: 'API integration troubleshooting guide', uses: 22, confidence: 91, category: 'Technical' },
              { title: 'Account access and permissions FAQ', uses: 11, confidence: 88, category: 'Account' },
            ].map(a => (
              <div key={a.title} className="flex items-center gap-4 p-3.5 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0"><BookOpen size={14} className="text-blue-500" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[#0F1929]">{a.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">Used {a.uses}× this week</div>
                </div>
                <Badge variant="default">{a.category}</Badge>
                <Mono color="#10B981">{a.confidence}%</Mono>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="space-y-5">
        <Card className="p-5">
          <SectionTitle className="mb-4">Knowledge Coverage</SectionTitle>
          <div className="space-y-3">
            {[
              { label: 'Billing Topics', coverage: 92 },
              { label: 'Technical Support', coverage: 78 },
              { label: 'Account Management', coverage: 85 },
            ].map(k => (
              <div key={k.label}>
                <div className="flex items-center justify-between mb-1">
                  <Label>{k.label}</Label>
                  <Mono color={k.coverage >= 85 ? '#10B981' : '#F59E0B'}>{k.coverage}%</Mono>
                </div>
                <ConfidenceMeter value={k.coverage} />
              </div>
            ))}
          </div>
        </Card>
        <BrainLog entries={BRAIN_LOG.slice(0, 4)} />
      </div>
    </div>
  );
}

function SupportAnalytics() {
  const weeklyTickets = [
    { label: 'Mon', value: 18 }, { label: 'Tue', value: 24 }, { label: 'Wed', value: 21 },
    { label: 'Thu', value: 31 }, { label: 'Fri', value: 28 }, { label: 'Sat', value: 8 },
    { label: 'Sun', value: 5 },
  ];
  return (
    <div className="space-y-6">
      <MetricsRow metrics={[
        { label: 'CSAT Score', value: '4.3/5', sub: '+0.2 this week', color: '#10B981' },
        { label: 'Avg Resolution Time', value: '4h 12m', sub: '−28 min', color: '#0284C7' },
        { label: 'Escalation Rate', value: '4.2%', sub: '−1.1%', color: '#059669' },
        { label: 'AI Resolution %', value: '68%', sub: 'No human needed', color: '#7C3AED' },
      ]} />
      <div className="grid grid-cols-2 gap-6">
        <Card className="p-5">
          <SectionTitle className="mb-4">Tickets by Day</SectionTitle>
          <MiniBarChart data={weeklyTickets} color="#059669" />
        </Card>
        <Card className="p-5">
          <SectionTitle className="mb-4">Resolution by Channel</SectionTitle>
          <div className="space-y-3">
            {[
              { channel: 'Email', tickets: 28, ai: '72%', color: '#3B6EF0' },
              { channel: 'Chat', tickets: 14, ai: '81%', color: '#059669' },
              { channel: 'WhatsApp', tickets: 5, ai: '60%', color: '#25D366' },
            ].map(c => (
              <div key={c.channel} className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                <span className="text-xs text-slate-600 flex-1">{c.channel}</span>
                <Mono color="#0F1929">{c.tickets}</Mono>
                <Badge variant="success">AI {c.ai}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function SupportSettings() {
  return (
    <div className="max-w-2xl space-y-5">
      {[
        { title: 'Auto-Response', fields: [
          { label: 'Auto-reply with AI drafts', type: 'toggle', value: false },
          { label: 'Confidence threshold for auto-send', type: 'select', value: '95%' },
          { label: 'Require approval for escalations', type: 'toggle', value: true },
        ]},
        { title: 'SLA & Escalation', fields: [
          { label: 'First response SLA', type: 'select', value: '4 hours' },
          { label: 'Escalate on legal mentions', type: 'toggle', value: true },
          { label: 'CSAT risk threshold', type: 'select', value: 'Score < 3.0' },
        ]},
      ].map(section => (
        <Card key={section.title} className="p-5">
          <SectionTitle className="mb-4">{section.title}</SectionTitle>
          <div className="space-y-3.5">
            {section.fields.map(f => (
              <div key={f.label} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">{f.label}</span>
                {f.type === 'toggle' ? (
                  <div className={`w-9 h-5 rounded-full relative cursor-pointer transition-colors ${f.value ? 'bg-green-500' : 'bg-slate-200'}`}>
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

export default function SupportWorkspace() {
  const [tab, setTab] = useState('Overview');
  return (
    <div className="min-h-screen">
      <WorkspaceHeader name="Support Agent" icon="🎧" badge="Running · 5 tasks queued" confidence={94}
        color="#059669" bgColor="#F0FDF4" description="Ticket classification, suggested replies, CSAT risk detection, and SLA monitoring" />
      <div className="px-8">
        <TabNav tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="px-8 pb-8 mt-6">
        {tab === 'Overview' && <SupportOverview />}
        {tab === 'Inbox' && <SupportInbox />}
        {tab === 'Tickets' && <Tickets />}
        {tab === 'Knowledge' && <SupportKnowledge />}
        {tab === 'Escalations' && <Escalations />}
        {tab === 'Analytics' && <SupportAnalytics />}
        {tab === 'Settings' && <SupportSettings />}
      </div>
    </div>
  );
}
