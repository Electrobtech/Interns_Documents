'use client';
import { useMemo, useState } from 'react';
import {
  Bot, Megaphone, TrendingUp, Headphones, UserCheck, Database,
  Activity, LayoutDashboard,
} from 'lucide-react';
import {
  useAgentStatus, useMarketingRuns, useSalesRuns, useSupportRuns, useHandoffs,
} from '@/lib/queries/aiAgents';
import KpiCard from '@/components/ai-agents/KpiCard';
import AgentsOverview from '@/components/ai-agents/AgentsOverview';
import MarketingWorkspace from '@/components/ai-agents/MarketingWorkspace';
import SalesWorkspace from '@/components/ai-agents/SalesWorkspace';
import SupportWorkspace from '@/components/ai-agents/SupportWorkspace';
import HandoffQueue from '@/components/ai-agents/HandoffQueue';

const AGENT_CONFIG = {
  marketing: {
    label: 'Marketing Agent', type: 'Marketing', icon: Megaphone,
    iconBg: 'bg-gradient-to-br from-violet-50 to-purple-100', iconColor: 'text-violet-600',
    accent: 'from-violet-500 to-purple-600', description: 'Attracts & nurtures leads',
  },
  sales: {
    label: 'Sales Agent', type: 'Sales', icon: TrendingUp,
    iconBg: 'bg-gradient-to-br from-emerald-50 to-teal-100', iconColor: 'text-emerald-600',
    accent: 'from-emerald-500 to-teal-600', description: 'Qualifies & converts deals',
  },
  support: {
    label: 'Support Agent', type: 'Support', icon: Headphones,
    iconBg: 'bg-gradient-to-br from-violet-50 to-purple-100', iconColor: 'text-violet-600',
    accent: 'from-violet-500 to-purple-600', description: 'Resolves & retains customers',
  },
};

function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/* ─── left pane: Agents table row ──────────────────────── */
function AgentRow({ agentKey, statusRow, runs, active, onSelect }) {
  const cfg = AGENT_CONFIG[agentKey];
  const Icon = cfg.icon;
  const isLive = statusRow?.status === 'active';
  const lastRun = runs?.[0]?.created_at;

  return (
    <button
      onClick={() => onSelect(agentKey)}
      className={`
        w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150
        ${active ? 'bg-violet-50 border border-violet-100' : 'border border-transparent hover:bg-slate-50'}
      `}
    >
      <div className={`p-2 rounded-lg shrink-0 ${cfg.iconBg} ${cfg.iconColor}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-semibold text-slate-700 truncate">{cfg.label}</p>
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">
          {runs?.length ?? 0} runs · last {timeAgo(lastRun)}
        </p>
      </div>
    </button>
  );
}

export default function AIAgentsPage() {
  const [selected, setSelected] = useState('overview'); // 'overview' | 'marketing' | 'sales' | 'support' | 'handoff'

  const { data: status, isLoading: statusLoading } = useAgentStatus();
  const { data: marketingRuns } = useMarketingRuns();
  const { data: salesRuns } = useSalesRuns();
  const { data: supportRuns } = useSupportRuns();
  const { data: pendingHandoffs } = useHandoffs('pending');

  const agents = status?.agents || [];
  const statusByType = useMemo(() => {
    const map = {};
    for (const a of agents) map[a.type] = a;
    return map;
  }, [agents]);

  const runsByAgent = { marketing: marketingRuns, sales: salesRuns, support: supportRuns };
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const pendingCount = Array.isArray(pendingHandoffs) ? pendingHandoffs.length : 0;

  const currentCfg = AGENT_CONFIG[selected];

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6 animate-fade-in">

      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600 shadow-sm">
            <Bot size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">AI Agents & Automation</h1>
            <p className="text-xs text-slate-400 mt-0.5">Marketing, Sales & Support agents — status, runs, and handoffs</p>
          </div>
        </div>
        <button
          onClick={() => setSelected('handoff')}
          className={`
            flex items-center gap-2 text-xs font-semibold px-3.5 py-2.5 rounded-xl border transition-colors
            ${selected === 'handoff'
              ? 'bg-violet-50 border-violet-200 text-violet-700'
              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}
          `}
        >
          <UserCheck size={14} /> Handoff Queue
          {pendingCount > 0 && (
            <span className="text-[10px] font-bold text-white bg-red-500 px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {pendingCount}
            </span>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">

        {/* ── left pane ─────────────────────────────── */}
        <div className="space-y-4 lg:sticky lg:top-6">

          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={Bot} label="Active" tone="brand" loading={statusLoading}
              value={activeCount} sublabel={`of ${agents.length || 3}`} />
            <KpiCard icon={Database} label="Chunks" tone="emerald" loading={statusLoading}
              value={status?.knowledge_base?.total_chunks ?? 0} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <KpiCard icon={Activity} label="LLM" tone={status?.provider?.healthy ? 'emerald' : 'amber'} loading={statusLoading}
              value={status?.provider?.healthy ? 'Healthy' : 'Degraded'} />
            <KpiCard icon={UserCheck} label="Handoffs" tone="amber"
              value={pendingCount} sublabel="pending" />
          </div>

          {/* Agents table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-3">
            <p className="px-2 pt-1 pb-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Agents</p>
            <button
              onClick={() => setSelected('overview')}
              className={`
                w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 mb-1
                ${selected === 'overview' ? 'bg-violet-50 border border-violet-100' : 'border border-transparent hover:bg-slate-50'}
              `}
            >
              <div className="p-2 rounded-lg shrink-0 bg-slate-100 text-slate-500">
                <LayoutDashboard size={14} />
              </div>
              <p className="text-xs font-semibold text-slate-700">Overview</p>
            </button>
            {Object.keys(AGENT_CONFIG).map((key) => (
              <AgentRow
                key={key}
                agentKey={key}
                statusRow={statusByType[key]}
                runs={runsByAgent[key]}
                active={selected === key}
                onSelect={setSelected}
              />
            ))}
          </div>
        </div>

        {/* ── right pane (detail) ───────────────────── */}
        <div className="min-w-0">
          {selected === 'overview' && <AgentsOverview compact />}

          {currentCfg && (
            <div className="space-y-4">
              {/* agent header strip */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl shrink-0 ${currentCfg.iconBg} ${currentCfg.iconColor}`}>
                  <currentCfg.icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-800 text-sm">{currentCfg.label}</h2>
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      statusByType[selected]?.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusByType[selected]?.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                      {statusByType[selected]?.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">{currentCfg.description}</p>
                </div>
              </div>

              {selected === 'marketing' && <MarketingWorkspace />}
              {selected === 'sales' && <SalesWorkspace />}
              {selected === 'support' && <SupportWorkspace />}
            </div>
          )}

          {selected === 'handoff' && <HandoffQueue />}
        </div>
      </div>
    </div>
  );
}
