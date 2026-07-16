'use client';
import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, Area, AreaChart,
} from 'recharts';
import {
  Bot, Database, Activity, Sparkles, ShieldAlert, TrendingUp,
  CheckCircle2, AlertCircle, Clock, Zap,
} from 'lucide-react';
import { useAgentStatus, useMarketingRuns, useAgentAnalytics } from '@/lib/queries/aiAgents';
import KpiCard from './KpiCard';

const AGENT_CONFIG = {
  marketing: {
    label: 'Marketing Agent',
    color: '#2563eb',
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-gradient-to-br from-blue-50 to-indigo-100',
    iconColor: 'text-blue-600',
    description: 'Attracts & nurtures leads',
  },
  sales: {
    label: 'Sales Agent',
    color: '#059669',
    gradient: 'from-emerald-500 to-teal-600',
    iconBg: 'bg-gradient-to-br from-emerald-50 to-teal-100',
    iconColor: 'text-emerald-600',
    description: 'Qualifies & converts deals',
  },
  support: {
    label: 'Support Agent',
    color: '#7c3aed',
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-gradient-to-br from-violet-50 to-purple-100',
    iconColor: 'text-violet-600',
    description: 'Resolves & retains customers',
  },
};

const RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card-lg px-4 py-3 text-xs">
      <p className="font-semibold text-slate-600 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.fill }} />
          <span className="text-slate-500 capitalize">{p.dataKey}:</span>
          <span className="font-semibold text-slate-800">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function AgentsOverview() {
  const { data: status, isLoading } = useAgentStatus();
  const { data: runs } = useMarketingRuns();
  const [range, setRange] = useState('7d');
  const { data: analytics, isLoading: analyticsLoading } = useAgentAnalytics(range);
  const agents = status?.agents || [];

  const chartData = useMemo(() => {
    const series = analytics?.series || [];
    const byDate = new Map();
    for (const point of series) {
      if (!byDate.has(point.date)) byDate.set(point.date, { date: point.date });
      byDate.get(point.date)[point.agentType] = point.count;
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [analytics]);

  const activeCount = agents.filter((a) => a.status === 'active').length;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="animate-slide-up delay-75">
          <KpiCard icon={Bot} label="Active Agents" tone="brand" loading={isLoading}
            value={activeCount} sublabel={`of ${agents.length} configured`} />
        </div>
        <div className="animate-slide-up delay-150">
          <KpiCard icon={Database} label="Knowledge Chunks" tone="emerald" loading={isLoading}
            value={status?.knowledgeChunkCount ?? 0} />
        </div>
        <div className="animate-slide-up delay-225">
          <KpiCard
            icon={Activity} label="LLM Health"
            tone={status?.llmHealthy ? 'emerald' : 'amber'} loading={isLoading}
            value={status?.llmHealthy ? 'Healthy' : 'Degraded'}
          />
        </div>
        <div className="animate-slide-up delay-300">
          <KpiCard icon={ShieldAlert} label="Support Escalations" tone="amber" loading={analyticsLoading}
            value={analytics?.totals?.supportEscalations ?? 0} sublabel={`last ${range}`} />
        </div>
      </div>

      {/* Agent status cards */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 animate-slide-up delay-150">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
              <Bot size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Agent Status</h3>
              <p className="text-[11px] text-slate-400">
                {activeCount} of {agents.length} agents active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-emerald-700">Live</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(agents.length ? agents : Object.keys(AGENT_CONFIG).map((type) => ({ type, status: 'unconfigured' }))).map((a) => {
            const cfg = AGENT_CONFIG[a.type] || {};
            const isActive = a.status === 'active';
            return (
              <div
                key={a.type}
                className={`
                  relative rounded-xl border p-4 transition-all duration-200 overflow-hidden
                  ${isActive
                    ? 'border-slate-200 bg-gradient-to-br from-white to-slate-50/50 shadow-sm hover:shadow-card-hover hover:-translate-y-0.5'
                    : 'border-slate-100 bg-slate-50/50'
                  }
                `}
              >
                {isActive && (
                  <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${cfg.gradient}`} />
                )}
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded-lg ${cfg.iconBg || 'bg-slate-100'} ${cfg.iconColor || 'text-slate-400'}`}>
                    <Bot size={15} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isActive ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-[10px] font-semibold text-emerald-600">Active</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                        <span className="text-[10px] font-medium text-slate-400">Not configured</span>
                      </>
                    )}
                  </div>
                </div>
                <p className="font-semibold text-slate-800 text-sm">{cfg.label || a.type}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{cfg.description || ''}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 animate-slide-up delay-225">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">AI Runs by Agent</h3>
              <p className="text-[11px] text-slate-400">Total completions over time</p>
            </div>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                className={`
                  px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150
                  ${range === r.key
                    ? 'bg-white shadow-sm text-slate-800 border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-700'
                  }
                `}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {!analyticsLoading && chartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 mb-3">
              <TrendingUp size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">No AI runs in this range yet</p>
            <p className="text-xs text-slate-300 mt-1">Start a campaign or analyse a lead to see activity</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barGap={4} barCategoryGap="28%">
              <defs>
                <linearGradient id="barMarketing" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
                <linearGradient id="barSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#0891b2" />
                </linearGradient>
                <linearGradient id="barSupport" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)', radius: 6 }} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                iconType="circle"
                iconSize={8}
              />
              <Bar dataKey="marketing" name="Marketing" fill="url(#barMarketing)" radius={[5, 5, 0, 0]} maxBarSize={32} />
              <Bar dataKey="sales" name="Sales" fill="url(#barSales)" radius={[5, 5, 0, 0]} maxBarSize={32} />
              <Bar dataKey="support" name="Support" fill="url(#barSupport)" radius={[5, 5, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent runs */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 animate-slide-up delay-300">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600">
              <Clock size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Recent Marketing Runs</h3>
              <p className="text-[11px] text-slate-400">Last AI-generated campaign drafts</p>
            </div>
          </div>
          {runs?.length > 0 && (
            <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
              {runs.length} total
            </span>
          )}
        </div>

        {!runs?.length ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 mb-3">
              <Sparkles size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">No campaigns generated yet</p>
            <p className="text-xs text-slate-300 mt-1">Head to the Marketing Agent tab to get started</p>
          </div>
        ) : (
          <div className="space-y-1">
            {(runs || []).slice(0, 8).map((r, i) => (
              <div
                key={r.id}
                className="group flex items-start gap-3 px-3 py-3 rounded-xl hover:bg-slate-50 transition-colors duration-100"
              >
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-500 shrink-0 mt-0.5">
                  <Zap size={12} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 truncate leading-snug">{r.brief}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {new Date(r.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  Done
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
