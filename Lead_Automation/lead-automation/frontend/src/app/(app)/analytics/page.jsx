'use client';
import { useEffect, useState } from 'react';
import { BarChart3, Bot, Megaphone, TrendingUp, Headphones, Sparkles, Activity } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend,
} from 'recharts';
import { useApi } from '@/lib/useApi';
import { useAgentAnalytics, useAgentStatus } from '@/lib/queries/aiAgents';

const API_ANALYTICS = process.env.NEXT_PUBLIC_ANALYTICS_SERVICE_URL || 'http://localhost:4007';

/* ── helpers ──────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, tone = 'blue' }) {
  const TONES = {
    blue:    'from-blue-50 to-indigo-100 text-blue-600',
    emerald: 'from-emerald-50 to-teal-100 text-emerald-600',
    amber:   'from-amber-50 to-orange-100 text-amber-600',
    violet:  'from-violet-50 to-purple-100 text-violet-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${TONES[tone]}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{value ?? '—'}</p>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-card px-4 py-3 text-xs">
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

const RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d',  label: '7d'  },
  { key: '30d', label: '30d' },
];

/* ── main page ────────────────────────────────────── */
export default function AnalyticsPage() {
  const { call } = useApi();
  const [dashboard, setDashboard] = useState(null);
  const [workspace]  = useState('00000000-0000-0000-0000-000000000000');
  const [range, setRange] = useState('7d');

  const { data: agentAnalytics, isLoading: agentLoading } = useAgentAnalytics(range);
  const { data: agentStatus }                              = useAgentStatus();

  useEffect(() => {
    fetch(`${API_ANALYTICS}/dashboard/${workspace}`)
      .then((r) => r.json())
      .then(setDashboard)
      .catch(console.error);
  }, [workspace]);

  const trendData = dashboard?.messages_trend || [];
  const tagData   = dashboard?.top_tags        || [];

  /* reshape agent analytics series into chart-friendly format */
  const agentChartData = (() => {
    const series = agentAnalytics?.series || [];
    const byDate = new Map();
    for (const p of series) {
      if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
      byDate.get(p.date)[p.agentType] = p.count;
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  })();

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in">

      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 shadow-sm">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Analytics & Insights</h1>
            <p className="text-xs text-slate-400 mt-0.5">Platform metrics + AI agent performance</p>
          </div>
        </div>
      </div>

      {/* platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Conversations" value={dashboard?.conversations_total ?? 0} icon={BarChart3} tone="blue" />
        <StatCard label="Inbound Messages"    value={dashboard?.messages_inbound    ?? 0} icon={Activity}  tone="emerald" />
        <StatCard label="Outbound Messages"   value={dashboard?.messages_outbound   ?? 0} icon={Activity}  tone="amber" />
        <StatCard label="Open Inbox"          value={dashboard?.inbox_open          ?? 0} icon={BarChart3} tone="violet" />
      </div>

      {/* message trend + tags */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <p className="font-bold text-slate-800 text-sm mb-4">Messages (last 7 days)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={trendData} barCategoryGap="35%">
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)' }} />
              <Bar dataKey="count" fill="#2563eb" radius={[5,5,0,0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <p className="font-bold text-slate-800 text-sm mb-4">Lead Score</p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            <StatCard label="Average" value={dashboard?.lead_score_avg ?? 0} icon={TrendingUp} tone="blue" />
            <StatCard label="Maximum" value={dashboard?.lead_score_max ?? 0} icon={TrendingUp} tone="emerald" />
          </div>
          <p className="font-bold text-slate-800 text-sm mb-3">Top Tags</p>
          {tagData.length === 0
            ? <p className="text-xs text-slate-400">No tags yet.</p>
            : tagData.map((t) => (
              <div key={t.tag} className="flex justify-between text-sm py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-slate-600">{t.tag}</span>
                <span className="text-slate-400 font-semibold tabular-nums">{t.count}</span>
              </div>
            ))
          }
        </div>
      </div>

      {/* ── AI Agent Performance ────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
              <Bot size={16} />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">AI Agent Performance</h3>
              <p className="text-[11px] text-slate-400">
                Total runs: {agentAnalytics?.totals?.allRuns ?? '—'} ·
                Escalations: {agentAnalytics?.totals?.supportEscalations ?? '—'}
              </p>
            </div>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150
                  ${range === r.key
                    ? 'bg-white shadow-sm text-slate-800 border border-slate-200/80'
                    : 'text-slate-500 hover:text-slate-700'}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* agent stat tiles */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Marketing Runs', value: agentAnalytics?.totals?.marketing ?? 0, icon: Megaphone,  tone: 'blue'    },
            { label: 'Sales Runs',     value: agentAnalytics?.totals?.sales     ?? 0, icon: TrendingUp, tone: 'emerald' },
            { label: 'Support Runs',   value: agentAnalytics?.totals?.support   ?? 0, icon: Headphones, tone: 'violet'  },
          ].map(({ label, value, icon, tone }) => (
            <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
          ))}
        </div>

        {/* agent runs chart */}
        {agentLoading ? (
          <div className="h-48 skeleton rounded-2xl" />
        ) : agentChartData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 rounded-2xl bg-slate-50 mb-3">
              <Sparkles size={24} className="text-slate-300" />
            </div>
            <p className="text-sm font-medium text-slate-400">No agent runs in this range yet</p>
            <p className="text-xs text-slate-300 mt-1">Start using the AI Agents to see activity here</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={agentChartData} barGap={4} barCategoryGap="28%">
              <defs>
                {[
                  ['barMkt',  '#3b82f6', '#6366f1'],
                  ['barSales','#10b981', '#0891b2'],
                  ['barSup',  '#8b5cf6', '#a855f7'],
                ].map(([id, c1, c2]) => (
                  <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={c1} />
                    <stop offset="100%" stopColor={c2} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)', radius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} iconType="circle" iconSize={8} />
              <Bar dataKey="marketing" name="Marketing" fill="url(#barMkt)"   radius={[5,5,0,0]} maxBarSize={28} />
              <Bar dataKey="sales"     name="Sales"     fill="url(#barSales)" radius={[5,5,0,0]} maxBarSize={28} />
              <Bar dataKey="support"   name="Support"   fill="url(#barSup)"   radius={[5,5,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* agent status row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { type: 'marketing', label: 'Marketing Agent', icon: Megaphone,  gradient: 'from-blue-600 to-indigo-600',   sub: 'Campaigns · Segments · SEO'        },
          { type: 'sales',     label: 'Sales Agent',     icon: TrendingUp, gradient: 'from-emerald-600 to-teal-600',  sub: 'Lead scoring · Follow-ups · Pipeline'},
          { type: 'support',   label: 'Support Agent',   icon: Headphones, gradient: 'from-violet-600 to-purple-600', sub: 'Ticket replies · Escalations · CSAT' },
        ].map(({ type, label, icon: Icon, gradient, sub }) => {
          const agentEntry = agentStatus?.agents?.find((a) => a.type === type);
          const isActive   = agentEntry?.status === 'active';
          return (
            <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className={`h-1 w-full rounded-full bg-gradient-to-r ${gradient} mb-4`} />
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${gradient.replace('from-', 'from-').replace('to-', 'to-')} opacity-10 absolute`} />
                  <Icon size={16} className={isActive ? 'text-emerald-600' : 'text-slate-400'} />
                  <span className="text-sm font-bold text-slate-800">{label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-300'}`} />
                  <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400">{sub}</p>
            </div>
          );
        })}
      </div>

    </div>
  );
}
