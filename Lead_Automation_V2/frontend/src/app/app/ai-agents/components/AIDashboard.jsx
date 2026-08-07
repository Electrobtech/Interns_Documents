'use client';
import { useState } from 'react';
import {
  Play, Pause, FileText, Settings, Activity, AlertTriangle,
  CheckCircle2, Clock, Database, Globe, Cpu, Users, Zap,
  ArrowUpRight, BarChart3, ChevronRight, TrendingUp,
} from 'lucide-react';
import { StatusDot, ConfidenceMeter, Badge } from './SharedUI';
import { useAgentStatus, fmt } from '@/lib/queries/aiAgents';

// ─── Animated workflow graph background ───────────────────────────────────────
function WorkflowViz() {
  const nodes = [
    { x: 60, y: 55 }, { x: 160, y: 105 }, { x: 270, y: 48 },
    { x: 380, y: 95 }, { x: 490, y: 50 }, { x: 590, y: 115 },
    { x: 700, y: 55 }, { x: 800, y: 100 }, { x: 900, y: 45 },
    { x: 980, y: 110 }, { x: 130, y: 175 }, { x: 320, y: 182 },
    { x: 530, y: 168 }, { x: 730, y: 180 }, { x: 930, y: 170 },
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
    [1, 10], [2, 11], [4, 12], [6, 13], [8, 14],
    [10, 11], [11, 12], [12, 13], [13, 14],
  ];
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 1000 230" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B6EF0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g opacity="0.14">
        {edges.map(([from, to], i) => (
          <line key={i}
            x1={nodes[from].x} y1={nodes[from].y}
            x2={nodes[to].x} y2={nodes[to].y}
            stroke="url(#edgeGrad)" strokeWidth="1"
            strokeDasharray="5 8"
            style={{ animation: `dash-flow ${3.2 + (i % 5) * 0.6}s linear infinite`, animationDelay: `${i * 0.18}s` }}
          />
        ))}
        {nodes.map((node, i) => (
          <g key={i}>
            <circle cx={node.x} cy={node.y} r="4" fill="#3B6EF0" opacity="0.9" />
            <circle cx={node.x} cy={node.y} r="4" fill="none" stroke="#3B6EF0" strokeWidth="1.5"
              style={{ animation: `ping-slow ${2.5 + (i % 4) * 0.6}s ease-out infinite`, animationDelay: `${i * 0.25}s`, transformOrigin: `${node.x}px ${node.y}px` }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

// ─── Presentation-only fallbacks ──────────────────────────────────────────────
// Colour/icon per workspace. These are styling, not data — the backend supplies
// them too, but keeping local defaults means the grid still renders correctly
// during the first load before /ai-agents/status resolves.
const AGENT_SKIN = {
  marketing: { name: 'Marketing Agent', icon: '📣', color: '#7C3AED', bgColor: '#F5F3FF' },
  sales:     { name: 'Sales Agent',     icon: '📈', color: '#0284C7', bgColor: '#F0F9FF' },
  support:   { name: 'Support Agent',   icon: '🎧', color: '#059669', bgColor: '#F0FDF4' },
};
const WORKSPACE_IDS = ['marketing', 'sales', 'support'];

// Skeleton shown while the first fetch is in flight. Deliberately empty of
// numbers: showing zeros would read as "measured and zero" rather than
// "not loaded yet".
const PLACEHOLDER_AGENTS = WORKSPACE_IDS.map((id) => ({
  id,
  ...AGENT_SKIN[id],
  status: 'loading',
  currentTask: null,
  confidence: null,
  queue: null,
  completed: null,
  avgRuntime: null,
  knowledgeUsed: null,
  lastActivity: null,
  capabilities: [],
}));

// Mock data for when backend is unavailable - shows realistic demo data
const MOCK_AGENTS = [
  {
    id: 'marketing',
    ...AGENT_SKIN.marketing,
    status: 'active',
    currentTask: 'Generating Q3 marketing campaign recommendations',
    confidence: 87,
    queue: 12,
    completed: 156,
    avgRuntime: 45,
    knowledgeUsed: 28,
    lastActivity: '2 minutes ago',
    capabilities: ['Campaign Planning', 'Content Generation', 'SEO Analysis', 'Social Media', 'Email Marketing'],
  },
  {
    id: 'sales',
    ...AGENT_SKIN.sales,
    status: 'active',
    currentTask: 'Qualifying leads from WhatsApp campaign',
    confidence: 92,
    queue: 8,
    completed: 243,
    avgRuntime: 32,
    knowledgeUsed: 35,
    lastActivity: '5 minutes ago',
    capabilities: ['Lead Qualification', 'Deal Scoring', 'Follow-up Automation', 'CRM Integration'],
  },
  {
    id: 'support',
    ...AGENT_SKIN.support,
    status: 'idle',
    currentTask: null,
    confidence: 89,
    queue: 3,
    completed: 89,
    avgRuntime: 28,
    knowledgeUsed: 42,
    lastActivity: '15 minutes ago',
    capabilities: ['Ticket Triage', 'Knowledge Base', 'Auto-responses', 'Escalation'],
  },
];

const MOCK_SUMMARY = {
  agentsActive: 2,
  tasksToday: 488,
  pendingApprovals: 12,
  avgConfidence: 89,
  completedToday: 445,
  creditsToday: 15240,
  activeTasks: 23,
  humanEscalations: 8,
  knowledgeSources: 156,
  connectedChannels: 6,
  leadsProcessed: 2840,
  revenueInfluenced: 842000,
};

// Status label + colour. Derived from real activity, so an idle agent looks
// idle rather than claiming to be running.
const STATUS_STYLE = {
  active:  { label: 'Running', text: 'text-green-600' },
  idle:    { label: 'Idle',    text: 'text-slate-400' },
  loading: { label: 'Loading…', text: 'text-slate-300' },
  error:   { label: 'Unavailable', text: 'text-red-500' },
};

// ─── Agent Card ───────────────────────────────────────────────────────────────
function AgentCard({ agent, onOpen }) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E8F0] shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${agent.color}, ${agent.color}60)` }} />
      <div className="p-6">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: agent.bgColor }}>{agent.icon}</div>
            <div>
              <h3 className="font-semibold text-[#0F1929] text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>{agent.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusDot status={agent.status} />
                {/* Reflects the real state: an agent with no runs in the last
                    24h is idle, not "Running". */}
                <span className={`text-xs font-medium ${STATUS_STYLE[agent.status]?.text || 'text-slate-400'}`}>
                  {STATUS_STYLE[agent.status]?.label || 'Unknown'}
                </span>
              </div>
            </div>
          </div>
          <div className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ fontFamily: "'JetBrains Mono', monospace", background: `${agent.color}12`, color: agent.color }}>
            {fmt(agent.confidence, { suffix: '%' })}
          </div>
        </div>

        <div className="rounded-xl p-3 mb-5" style={{ background: agent.bgColor }}>
          <div className="text-xs text-slate-400 mb-1 font-medium">Current Task</div>
          <div className="text-xs text-slate-700 leading-relaxed line-clamp-2">
            {agent.currentTask || <span className="text-slate-400 italic">No recent activity</span>}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">AI Confidence</span>
            <span className="text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: agent.color }}>
              {fmt(agent.confidence, { suffix: '%' })}
            </span>
          </div>
          <ConfidenceMeter value={agent.confidence ?? 0} color={agent.color} />
        </div>

        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: 'Queue', value: fmt(agent.queue) },
            { label: 'Completed', value: fmt(agent.completed) },
            { label: 'Avg Runtime', value: fmt(agent.avgRuntime) },
            { label: 'Knowledge', value: fmt(agent.knowledgeUsed) },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 bg-slate-50">
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className="text-sm font-semibold text-[#0F1929]">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 mb-5">
          {(agent.capabilities || []).map(c => (
            <span key={c} className="text-xs px-2 py-1 rounded-lg border border-[#E4E8F0] text-slate-500 bg-white">{c}</span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[#E4E8F0]">
          <span className="text-xs text-slate-400">Last activity: {fmt(agent.lastActivity, { fallback: 'never' })}</span>
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200"
            style={{ background: `${agent.color}12`, color: agent.color }}
            onMouseEnter={e => { e.currentTarget.style.background = agent.color; e.currentTarget.style.color = '#FFFFFF'; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${agent.color}12`; e.currentTarget.style.color = agent.color; }}
          >
            Open Workspace <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── Dashboard ────────────────────────────────────────────────────────────────
export default function Dashboard({ onNavigate }) {
  // Polls every 15s and refetches on window focus — the dashboard stays live
  // without a manual refresh.
  const { data, isLoading, isError, error, dataUpdatedAt } = useAgentStatus();

  // Use mock data when: (1) backend is unreachable/errored, or (2) backend
  // returned a response but zero agents (empty DB / services not seeded yet)
  const useMock = isError || (!isLoading && (!data?.agents || data.agents.length === 0));

  const agents = useMock
    ? MOCK_AGENTS
    : data.agents.map((a) => {
        const id = a.id ?? a.type;
        return {
          ...PLACEHOLDER_AGENTS.find((p) => p.id === id),
          ...AGENT_SKIN[id],
          ...a,
          id,
          capabilities: Array.isArray(a.capabilities) ? a.capabilities : [],
        };
      });

  const s = useMock ? MOCK_SUMMARY : (data?.summary ?? {});
  const activeCount = s.agentsActive ?? 0;

  return (
    <div className="p-8 max-w-screen-2xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>AI Operations Center</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isLoading
              ? 'Loading agent status…'
              : useMock
                ? 'Demo mode — showing sample data'
                : `${activeCount} of 3 agents active`}
            {' · '}
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 border border-[#E4E8F0] bg-white hover:bg-slate-50 transition-all shadow-sm">
            <FileText size={14} /> View Logs
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-slate-600 border border-[#E4E8F0] bg-white hover:bg-slate-50 transition-all shadow-sm">
            <Settings size={14} /> AI Settings
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-amber-700 border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-all shadow-sm">
            <Pause size={14} /> Pause AI
          </button>
          <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white transition-all shadow-sm hover:opacity-90" style={{ background: 'linear-gradient(135deg, #3B6EF0 0%, #5B3AED 100%)' }}>
            <Play size={14} /> Run AI
          </button>
        </div>
      </div>

      {/* Command center hero */}
      <div className="relative rounded-2xl overflow-hidden mb-8 border border-[#E4E8F0]" style={{ background: 'linear-gradient(135deg, #0C1628 0%, #12213A 55%, #1A2E50 100%)', minHeight: 220 }}>
        <WorkflowViz />
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        <div className="relative z-10 p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <div className={`w-2.5 h-2.5 rounded-full ${useMock ? 'bg-amber-400' : 'bg-green-400'}`} />
              {!useMock && <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping-slow" />}
            </div>
            <span className={`text-xs font-semibold tracking-wide ${useMock ? 'text-amber-400' : 'text-green-400'}`}>
              {useMock ? 'DEMO MODE - SHOWING MOCK DATA' : 'ALL SYSTEMS OPERATIONAL'}
            </span>
            {dataUpdatedAt > 0 && (
              <span className="text-xs text-white/25 ml-4">
                Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </div>
          <h2 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
            {isLoading ? 'Loading…' : `${activeCount} AI Agent${activeCount === 1 ? '' : 's'} Active`}
          </h2>
          <p className="text-white/45 text-sm max-w-lg leading-relaxed">
            {useMock
              ? `AI service is currently unavailable. Showing demo data to illustrate functionality. Connect AI backend to see real-time metrics.`
              : s.avgConfidence != null
                ? `Marketing, Sales, and Support agents ground every response in your company knowledge via RAG, at an average confidence of ${s.avgConfidence}%.`
                : 'Marketing, Sales, and Support agents ground every response in your company knowledge via RAG. No runs recorded in the last 24 hours.'}
          </p>
          <div className="flex items-center gap-10 mt-7">
            {[
              { label: 'Tasks Today', value: fmt(s.tasksToday) },
              { label: 'Pending Approval', value: fmt(s.pendingApprovals), accent: true },
              { label: 'Avg Confidence', value: fmt(s.avgConfidence, { suffix: '%' }) },
              { label: 'Completed Today', value: fmt(s.completedToday) },
              { label: 'Credits Used', value: fmt(s.creditsToday) },
            ].map(stat => (
              <div key={stat.label}>
                <div className="text-3xl font-bold" style={{ fontFamily: "'Outfit', sans-serif", color: stat.accent ? '#FCD34D' : '#FFFFFF' }}>{stat.value}</div>
                <div className="text-xs text-white/35 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics grid.
          Metrics marked `pending` are owned by the Node CRM/campaign services,
          not the AI layer, so the backend returns null for them. They render an
          em-dash with a "not connected" note — an invented number here would be
          indistinguishable from a measured one. */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Active Tasks', value: s.activeTasks, icon: <Activity size={15} />, color: '#3B6EF0' },
          { label: 'Pending Approvals', value: s.pendingApprovals, icon: <Clock size={15} />, color: '#F59E0B', urgent: (s.pendingApprovals ?? 0) > 0 },
          { label: 'Tasks Today', value: s.tasksToday, icon: <Zap size={15} />, color: '#7C3AED' },
          { label: 'Human Escalations', value: s.humanEscalations, icon: <AlertTriangle size={15} />, color: '#EF4444' },
          { label: 'Avg Confidence', value: s.avgConfidence, suffix: '%', icon: <Cpu size={15} />, color: '#10B981' },
          { label: 'Knowledge Sources', value: s.knowledgeSources, icon: <Database size={15} />, color: '#0284C7' },
          { label: 'Connected Channels', value: s.connectedChannels, icon: <Globe size={15} />, color: '#7C3AED' },
          { label: 'Completed Today', value: s.completedToday, icon: <CheckCircle2 size={15} />, color: '#10B981' },
          { label: 'Leads Processed', value: s.leadsProcessed, icon: <Users size={15} />, color: '#3B6EF0' },
          { label: 'Revenue Influenced', value: s.revenueInfluenced, prefix: '$', icon: <BarChart3 size={15} />, color: '#059669' },
        ].map(m => (
          <div key={m.label} className="bg-white rounded-2xl border border-[#E4E8F0] p-5 shadow-sm hover:shadow-md transition-all duration-200 group cursor-default">
            <div className="flex items-center justify-between mb-3">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${m.color}14`, color: m.color }}>{m.icon}</div>
              {m.urgent && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
            </div>
            <div
              className={`text-2xl font-bold mb-0.5 ${m.value == null ? 'text-slate-300' : 'text-[#0F1929]'}`}
              style={{ fontFamily: "'Outfit', sans-serif" }}
            >
              {isLoading ? '·' : fmt(m.value, { suffix: m.suffix || '', prefix: m.value != null ? (m.prefix || '') : '' })}
            </div>
            <div className="text-xs text-slate-500">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Agent cards */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>AI Agent Status</h2>
          <p className="text-xs text-slate-400 mt-0.5">Live status · updates every 15 seconds</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
          View All Activity <TrendingUp size={12} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} onOpen={() => onNavigate(agent.id)} />
        ))}
      </div>
    </div>
  );
}