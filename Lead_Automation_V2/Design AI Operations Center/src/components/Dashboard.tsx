import type { AppView } from '../App'
import {
  Play, Pause, FileText, Settings, Activity, AlertTriangle,
  CheckCircle2, Clock, Database, Globe, Cpu, Users, Zap,
  ArrowUpRight, BarChart3, ChevronRight, TrendingUp,
} from 'lucide-react'
import { StatusDot, ConfidenceMeter, Badge } from './shared/ui'

// ─── Animated workflow graph background ──────────────────────────────────────

function WorkflowViz() {
  const nodes = [
    { x: 60, y: 55 }, { x: 160, y: 105 }, { x: 270, y: 48 },
    { x: 380, y: 95 }, { x: 490, y: 50 }, { x: 590, y: 115 },
    { x: 700, y: 55 }, { x: 800, y: 100 }, { x: 900, y: 45 },
    { x: 980, y: 110 }, { x: 130, y: 175 }, { x: 320, y: 182 },
    { x: 530, y: 168 }, { x: 730, y: 180 }, { x: 930, y: 170 },
  ]
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9],
    [1, 10], [2, 11], [4, 12], [6, 13], [8, 14],
    [10, 11], [11, 12], [12, 13], [13, 14],
  ]
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 1000 230"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B6EF0" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7C3AED" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g opacity="0.14">
        {edges.map(([from, to], i) => (
          <line
            key={i}
            x1={nodes[from].x} y1={nodes[from].y}
            x2={nodes[to].x} y2={nodes[to].y}
            stroke="url(#edgeGrad)" strokeWidth="1"
            strokeDasharray="5 8"
            style={{
              animation: `dash-flow ${3.2 + (i % 5) * 0.6}s linear infinite`,
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
        {nodes.map((node, i) => (
          <g key={i}>
            <circle cx={node.x} cy={node.y} r="4" fill="#3B6EF0" opacity="0.9" />
            <circle
              cx={node.x} cy={node.y} r="4" fill="none" stroke="#3B6EF0" strokeWidth="1.5"
              style={{
                animation: `ping-slow ${2.5 + (i % 4) * 0.6}s ease-out infinite`,
                animationDelay: `${i * 0.25}s`,
                transformOrigin: `${node.x}px ${node.y}px`,
              }}
            />
          </g>
        ))}
      </g>
    </svg>
  )
}

// ─── Agent card data ─────────────────────────────────────────────────────────

const AGENTS = [
  {
    id: 'marketing' as AppView,
    name: 'Marketing Agent',
    icon: '📣',
    status: 'active' as const,
    currentTask: 'Generating Q4 SaaS campaign brief — targeting mid-market segment',
    confidence: 92,
    queue: 7,
    completed: 14,
    pending: 7,
    avgRuntime: '3m 24s',
    knowledgeUsed: '4 sources',
    lastActivity: '2 min ago',
    color: '#7C3AED',
    bgColor: '#F5F3FF',
    capabilities: ['Campaign Planner', 'SEO / AEO Optimizer', 'Content Generator', 'Competitor Intel'],
  },
  {
    id: 'sales' as AppView,
    name: 'Sales Agent',
    icon: '📈',
    status: 'active' as const,
    currentTask: 'Scoring 23 new leads from LinkedIn campaign · detecting buying intent',
    confidence: 87,
    queue: 12,
    completed: 31,
    pending: 12,
    avgRuntime: '1m 48s',
    knowledgeUsed: '6 sources',
    lastActivity: '45 sec ago',
    color: '#0284C7',
    bgColor: '#F0F9FF',
    capabilities: ['Lead Scoring', 'Buying Intent', 'Pipeline Analysis', 'Follow-up Generator'],
  },
  {
    id: 'support' as AppView,
    name: 'Support Agent',
    icon: '🎧',
    status: 'active' as const,
    currentTask: 'Classifying 8 tickets · drafting suggested replies with KB context',
    confidence: 94,
    queue: 5,
    completed: 47,
    pending: 5,
    avgRuntime: '58s',
    knowledgeUsed: '5 sources',
    lastActivity: '1 min ago',
    color: '#059669',
    bgColor: '#F0FDF4',
    capabilities: ['Ticket Classification', 'Suggested Replies', 'CSAT Risk', 'SLA Monitor'],
  },
]

// ─── Dashboard ───────────────────────────────────────────────────────────────

interface DashboardProps {
  onNavigate: (view: AppView) => void
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  return (
    <div className="p-8 max-w-screen-2xl">
      {/* Page header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
            AI Operations Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            3 agents active · Monday, 3 Aug 2026 · 09:42 AM
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
          <button
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white transition-all shadow-sm hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #3B6EF0 0%, #5B3AED 100%)' }}
          >
            <Play size={14} /> Run AI
          </button>
        </div>
      </div>

      {/* Command center hero banner */}
      <div
        className="relative rounded-2xl overflow-hidden mb-8 border border-[#E4E8F0]"
        style={{
          background: 'linear-gradient(135deg, #0C1628 0%, #12213A 55%, #1A2E50 100%)',
          minHeight: 220,
        }}
      >
        <WorkflowViz />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="relative z-10 p-8">
          <div className="flex items-center gap-3 mb-5">
            <div className="relative">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <div className="absolute inset-0 w-2.5 h-2.5 rounded-full bg-green-400 animate-ping-slow" />
            </div>
            <span className="text-xs font-semibold text-green-400 tracking-wide">ALL SYSTEMS OPERATIONAL</span>
            <span className="text-xs text-white/25 ml-4">97.8% uptime this month</span>
          </div>

          <h2 className="text-4xl font-bold text-white mb-2" style={{ fontFamily: "'Outfit', sans-serif" }}>
            3 AI Agents Active
          </h2>
          <p className="text-white/45 text-sm max-w-lg leading-relaxed">
            Marketing, Sales, and Support agents are running autonomously, grounding every response in your company knowledge via RAG with an average confidence of 91%.
          </p>

          {/* Inline stats */}
          <div className="flex items-center gap-10 mt-7">
            {[
              { label: 'Tasks Today', value: '92' },
              { label: 'Pending Approval', value: '4', accent: true },
              { label: 'Avg Confidence', value: '91%' },
              { label: "Today's Automations", value: '247' },
              { label: 'Revenue Influenced', value: '$84K' },
            ].map(stat => (
              <div key={stat.label}>
                <div
                  className="text-3xl font-bold"
                  style={{ fontFamily: "'Outfit', sans-serif", color: stat.accent ? '#FCD34D' : '#FFFFFF' }}
                >
                  {stat.value}
                </div>
                <div className="text-xs text-white/35 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        {[
          { label: 'Active Tasks', value: '24', icon: <Activity size={15} />, change: '+3', color: '#3B6EF0' },
          { label: 'Pending Approvals', value: '4', icon: <Clock size={15} />, color: '#F59E0B', urgent: true },
          { label: "Today's Automations", value: '247', icon: <Zap size={15} />, change: '+31', color: '#7C3AED' },
          { label: 'Human Escalations', value: '2', icon: <AlertTriangle size={15} />, color: '#EF4444' },
          { label: 'Avg Confidence', value: '91%', icon: <Cpu size={15} />, change: '+2%', color: '#10B981' },
          { label: 'Knowledge Sources', value: '18', icon: <Database size={15} />, color: '#0284C7' },
          { label: 'Connected Channels', value: '9', icon: <Globe size={15} />, color: '#7C3AED' },
          { label: 'Completed Today', value: '92', icon: <CheckCircle2 size={15} />, change: '+14', color: '#10B981' },
          { label: 'Leads Processed', value: '156', icon: <Users size={15} />, change: '+23', color: '#3B6EF0' },
          { label: 'Revenue Influenced', value: '$84K', icon: <BarChart3 size={15} />, change: '+12%', color: '#059669' },
        ].map(m => (
          <div
            key={m.label}
            className="bg-white rounded-2xl border border-[#E4E8F0] p-5 shadow-sm hover:shadow-md transition-all duration-200 group cursor-default"
          >
            <div className="flex items-center justify-between mb-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: `${m.color}14`, color: m.color }}
              >
                {m.icon}
              </div>
              {m.urgent && (
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              )}
            </div>
            <div className="text-2xl font-bold text-[#0F1929] mb-0.5" style={{ fontFamily: "'Outfit', sans-serif" }}>
              {m.value}
            </div>
            <div className="text-xs text-slate-500">{m.label}</div>
            {m.change && (
              <div className="flex items-center gap-0.5 text-xs font-medium text-green-600 mt-1">
                <ArrowUpRight size={10} /> {m.change} today
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Agent cards */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
            AI Agent Status
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Live status · updates every 30 seconds</p>
        </div>
        <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors">
          View All Activity <TrendingUp size={12} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {AGENTS.map(agent => (
          <AgentCard key={agent.id} agent={agent} onOpen={() => onNavigate(agent.id)} />
        ))}
      </div>
    </div>
  )
}

// ─── Agent card ───────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  onOpen,
}: {
  agent: (typeof AGENTS)[0]
  onOpen: () => void
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#E4E8F0] shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden group">
      {/* Top color accent */}
      <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${agent.color}, ${agent.color}60)` }} />

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: agent.bgColor }}>
              {agent.icon}
            </div>
            <div>
              <h3 className="font-semibold text-[#0F1929] text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>{agent.name}</h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                <StatusDot status={agent.status} />
                <span className="text-xs font-medium text-green-600">Running</span>
              </div>
            </div>
          </div>
          <div
            className="text-xs font-semibold px-2 py-1 rounded-lg"
            style={{ fontFamily: "'JetBrains Mono', monospace", background: `${agent.color}12`, color: agent.color }}
          >
            {agent.confidence}%
          </div>
        </div>

        {/* Current task */}
        <div className="rounded-xl p-3 mb-5" style={{ background: agent.bgColor }}>
          <div className="text-xs text-slate-400 mb-1 font-medium">Current Task</div>
          <div className="text-xs text-slate-700 leading-relaxed">{agent.currentTask}</div>
        </div>

        {/* Confidence bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400">AI Confidence</span>
            <span className="text-xs font-semibold" style={{ fontFamily: "'JetBrains Mono', monospace", color: agent.color }}>
              {agent.confidence}%
            </span>
          </div>
          <ConfidenceMeter value={agent.confidence} color={agent.color} />
        </div>

        {/* Stats 2×2 */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          {[
            { label: 'Queue', value: String(agent.queue) },
            { label: 'Completed', value: String(agent.completed) },
            { label: 'Avg Runtime', value: agent.avgRuntime },
            { label: 'Knowledge', value: agent.knowledgeUsed },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3 bg-slate-50">
              <div className="text-xs text-slate-400 mb-1">{s.label}</div>
              <div className="text-sm font-semibold text-[#0F1929]">{s.value}</div>
            </div>
          ))}
        </div>

        {/* Capability pills */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {agent.capabilities.map(c => (
            <span key={c} className="text-xs px-2 py-1 rounded-lg border border-[#E4E8F0] text-slate-500 bg-white">
              {c}
            </span>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-[#E4E8F0]">
          <span className="text-xs text-slate-400">Last activity: {agent.lastActivity}</span>
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all duration-200"
            style={{ background: `${agent.color}12`, color: agent.color }}
            onMouseEnter={e => {
              ;(e.currentTarget as HTMLElement).style.background = agent.color
              ;(e.currentTarget as HTMLElement).style.color = '#FFFFFF'
            }}
            onMouseLeave={e => {
              ;(e.currentTarget as HTMLElement).style.background = `${agent.color}12`
              ;(e.currentTarget as HTMLElement).style.color = agent.color
            }}
          >
            Open Workspace <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}
