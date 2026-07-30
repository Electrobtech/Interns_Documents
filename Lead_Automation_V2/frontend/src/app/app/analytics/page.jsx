'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, MessageSquareText, CheckCircle2,
  AlertTriangle, IndianRupee, MessageCircle, Instagram, MessageSquare,
  Smartphone, Globe, Phone, Mail, Clock, ArrowUpRight,
  Bot, Megaphone, Headphones, Sparkles, Activity,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useApi } from '@/lib/useApi';
import { useAgentAnalytics, useAgentStatus } from '@/lib/queries/aiAgents';
import Link from 'next/link';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const CHANNEL_META = {
  whatsapp: { icon: MessageCircle, color: '#059669', label: 'WhatsApp' },
  instagram: { icon: Instagram, color: '#db2777', label: 'Instagram' },
  messenger: { icon: MessageSquare, color: '#2563eb', label: 'Messenger' },
  sms: { icon: Smartphone, color: '#d97706', label: 'SMS / RCS' },
  webchat: { icon: Globe, color: '#0891b2', label: 'Web Chat' },
  voice: { icon: Phone, color: '#7c3aed', label: 'Voice Call' },
  email: { icon: Mail, color: '#475569', label: 'Email' },
};
const channelMeta = (name) =>
  CHANNEL_META[name] || { icon: Globe, color: '#94a3b8', label: (name || 'Other') };

const DONUT_COLORS = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#94a3b8'];
const STAGE_ORDER = ['new', 'qualified', 'active', 'won', 'lost'];
const STAGE_META = {
  new: { label: 'New', color: '#93c5fd' },
  qualified: { label: 'Qualified', color: '#60a5fa' },
  active: { label: 'Active', color: '#2563eb' },
  won: { label: 'Won', color: '#059669' },
  lost: { label: 'Lost', color: '#cbd5e1' },
};

const RANGES = [
  { key: '24h', label: '24h' },
  { key: '7d',  label: '7d'  },
  { key: '30d', label: '30d' },
];

// ---------- small utilities ----------

// Eases a number from 0 to `value` whenever `value` changes — a light,
// dependency-free stand-in for the animated counters a UI library like
// Framer Motion would normally provide (not installed in this project).
function useCountUp(value, duration = 700) {
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);
  useEffect(() => {
    if (value == null || Number.isNaN(value)) return;
    const from = fromRef.current;
    const to = value;
    const t0 = performance.now();
    let raf;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => raf && cancelAnimationFrame(raf);
  }, [value, duration]);
  return display;
}

function pctChange(series) {
  if (!series || series.length < 2) return null;
  const mid = Math.ceil(series.length / 2);
  const a = series.slice(0, mid).reduce((s, x) => s + x, 0) / mid || 0;
  const b = series.slice(mid).reduce((s, x) => s + x, 0) / (series.length - mid) || 0;
  if (a === 0) return b > 0 ? 100 : 0;
  return Math.round(((b - a) / a) * 100);
}

// ---------- presentational primitives ----------

function FadeIn({ delay = 0, className = '', children }) {
  return (
    <div className={`analytics-fade-in ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
      <style jsx>{`
        .analytics-fade-in {
          opacity: 0;
          transform: translateY(8px);
          animation: analyticsFadeIn 0.5s ease-out forwards;
        }
        @keyframes analyticsFadeIn {
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .analytics-fade-in { animation: none; opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

function Card({ title, subtitle, right, className = '', children }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-100 shadow-[0_1px_2px_rgba(15,23,42,0.04)]
        hover:shadow-[0_8px_24px_rgba(15,23,42,0.07)] transition-shadow duration-300 p-5 ${className}`}
    >
      {(title || right) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <p className="font-semibold text-sm text-slate-800">{title}</p>}
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

function CardSkeleton({ height = 240 }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5">
      <div className="h-3.5 w-32 bg-slate-100 rounded animate-pulse mb-4" />
      <div className="bg-slate-50 rounded-lg animate-pulse" style={{ height }} />
    </div>
  );
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return <div className="h-10" />;
  return (
    <div className="h-10 -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
                fill={`url(#spark-${color.replace('#', '')})`} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ icon: Icon, color, bg, label, value, isCurrency, sparklineData, growth, warning }) {
  const numeric = isCurrency ? Number(value || 0) : Number(value || 0);
  const animated = useCountUp(numeric);
  const displayValue = isCurrency ? inr(Math.round(animated)) : Math.round(animated).toLocaleString('en-IN');
  const growthUp = typeof growth === 'number' && growth >= 0;

  return (
    <Card className="hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background: bg }}>
          <Icon size={18} style={{ color }} />
        </div>
        {warning && (
          <span className="text-[10px] font-semibold uppercase tracking-wide text-red-500 bg-red-50 px-2 py-1 rounded-full">
            Needs attention
          </span>
        )}
        {typeof growth === 'number' && !warning && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${growthUp ? 'text-emerald-600' : 'text-red-500'}`}>
            {growthUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {Math.abs(growth)}%
          </span>
        )}
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
      <p className="text-[26px] leading-tight font-bold text-slate-900 mt-1">{displayValue}</p>
      {sparklineData && <Sparkline data={sparklineData} color={color} />}
    </Card>
  );
}

function CustomTooltip({ active, payload, label, formatter }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-slate-900 text-white text-xs rounded-lg px-3 py-2 shadow-lg">
      <p className="text-slate-300 mb-0.5">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-semibold">{formatter ? formatter(p.value) : p.value}</p>
      ))}
    </div>
  );
}

// Named-series tooltip for the multi-bar AI Agent Performance chart, where a
// plain value-only tooltip (CustomTooltip above) can't distinguish which bar
// (marketing/sales/support) a value belongs to.
function AgentTooltip({ active, payload, label }) {
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
}

// Compact stat tile used only within the AI Agent Performance panel.
function StatCard({ label, value, icon: Icon, tone = 'blue' }) {
  const TONES = {
    blue:    'from-violet-50 to-rose-100 text-violet-600',
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

// ---------- widgets ----------

function ConversationTrend({ data }) {
  const empty = !data || data.length === 0;
  return (
    <Card title="Conversation Trend" subtitle="Messages received · last 7 days">
      {empty ? (
        <EmptyState label="No conversation activity yet" height={240} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={28} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="v" stroke="#2563eb" strokeWidth={2.5}
                  fill="url(#trendFill)" activeDot={{ r: 5 }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function LeadsByStage({ data }) {
  const ordered = useMemo(() => {
    const map = new Map(data.map((r) => [r.d, r.v]));
    return STAGE_ORDER.filter((s) => map.has(s)).map((s) => ({
      d: STAGE_META[s].label, v: map.get(s), fill: STAGE_META[s].color,
    }));
  }, [data]);
  const empty = ordered.length === 0;
  return (
    <Card title="Leads by Stage" subtitle="Current pipeline distribution">
      {empty ? (
        <EmptyState label="No lead data yet" height={240} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={ordered} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
            <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
            <YAxis type="category" dataKey="d" tickLine={false} axisLine={false} fontSize={12} width={70} stroke="#64748b" />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="v" radius={[0, 6, 6, 0]} barSize={20}>
              {ordered.map((row) => <Cell key={row.d} fill={row.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function ChannelDonut({ topChannels }) {
  const data = (topChannels || []).map(([name, value]) => ({ name, value }));
  const empty = data.length === 0;
  return (
    <Card title="Channel Performance" subtitle="Share of total conversations">
      {empty ? (
        <EmptyState label="No channel data yet" height={200} />
      ) : (
        <div className="flex items-center gap-5">
          <div className="relative w-[180px] h-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} outerRadius={82}
                     paddingAngle={3} strokeWidth={0}>
                  {data.map((d, i) => <Cell key={d.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                </Pie>
                <Tooltip content={<CustomTooltip formatter={(v) => `${v}%`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{data.length}</p>
                <p className="text-[10px] text-slate-400 uppercase tracking-wide">Channels</p>
              </div>
            </div>
          </div>
          <div className="space-y-2 min-w-0">
            {data.map((d, i) => {
              const meta = channelMeta(d.name);
              return (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="text-slate-600 truncate">{meta.label}</span>
                  <span className="text-slate-400 ml-auto pl-2 tabular-nums">{d.value}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}

function TopChannelsList({ topChannels }) {
  const data = (topChannels || []).slice(0, 5);
  const empty = data.length === 0;
  return (
    <Card title="Top Performing Channels" subtitle="Ranked by conversation volume">
      {empty ? (
        <EmptyState label="No channel data yet" height={140} />
      ) : (
        <div className="space-y-3.5">
          {data.map(([name, pct], i) => {
            const meta = channelMeta(name);
            const Icon = meta.icon;
            return (
              <div key={name} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-300 w-4">{i + 1}</span>
                <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1a` }}>
                  <Icon size={14} style={{ color: meta.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-700">{meta.label}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: `${pct}%`, background: meta.color }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function RevenueTrend({ ordersByDay }) {
  const weekly = useMemo(() => {
    if (!ordersByDay || ordersByDay.length === 0) return [];
    const buckets = 4;
    const size = Math.ceil(ordersByDay.length / buckets);
    const out = [];
    for (let i = 0; i < ordersByDay.length; i += size) {
      const chunk = ordersByDay.slice(i, i + size);
      const total = chunk.reduce((s, r) => s + Number(r.v || 0), 0);
      out.push({ d: `${chunk[0].d} – ${chunk[chunk.length - 1].d}`, v: total });
    }
    return out;
  }, [ordersByDay]);
  const empty = weekly.length === 0;
  return (
    <Card title="Revenue Trend" subtitle="Order revenue · last 30 days">
      {empty ? (
        <EmptyState label="No revenue recorded yet" height={220} />
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekly} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={10} stroke="#94a3b8" />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" width={30}
                   tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
            <Tooltip content={<CustomTooltip formatter={inr} />} cursor={{ fill: '#f8fafc' }} />
            <Bar dataKey="v" fill="#7c3aed" radius={[6, 6, 0, 0]} maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function LeadFunnel({ data }) {
  const map = new Map(data.map((r) => [r.d, r.v]));
  const stages = ['new', 'qualified', 'active', 'won'].map((s) => ({ key: s, ...STAGE_META[s], count: map.get(s) || 0 }));
  const lost = map.get('lost') || 0;
  const max = Math.max(1, ...stages.map((s) => s.count));
  const total = stages.reduce((s, x) => s + x.count, 0) + lost;

  if (total === 0) return <Card title="Lead Funnel" subtitle="Conversion through the pipeline"><EmptyState label="No lead data yet" height={180} /></Card>;

  const W = 100; // percentage-based coordinate space
  const rowH = 46;
  const gap = 6;
  const svgH = stages.length * (rowH + gap);

  const widthFor = (count) => Math.max(16, (count / max) * W);

  return (
    <Card title="Lead Funnel" subtitle="Conversion through the pipeline">
      <div className="flex gap-6 items-start">
        <svg viewBox={`0 0 ${W} ${svgH}`} preserveAspectRatio="none" className="w-full max-w-[280px]" style={{ height: svgH * 2.4 }}>
          {stages.map((s, i) => {
            const wTop = widthFor(s.count);
            const wBottom = i < stages.length - 1 ? widthFor(stages[i + 1].count) : wTop * 0.86;
            const y = i * (rowH + gap);
            const xTop = (W - wTop) / 2;
            const xBottom = (W - wBottom) / 2;
            return (
              <g key={s.key}>
                <polygon
                  points={`${xTop},${y} ${xTop + wTop},${y} ${xBottom + wBottom},${y + rowH} ${xBottom},${y + rowH}`}
                  fill={s.color}
                  opacity={0.95}
                />
              </g>
            );
          })}
        </svg>
        <div className="flex-1 min-w-0 space-y-2 pt-1">
          {stages.map((s, i) => {
            const prev = i > 0 ? stages[i - 1].count : null;
            const dropoff = prev ? Math.round(((prev - s.count) / Math.max(1, prev)) * 100) : null;
            return (
              <div key={s.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                  <span className="text-slate-600">{s.label}</span>
                </span>
                <span className="flex items-center gap-2 tabular-nums">
                  <span className="font-semibold text-slate-800">{s.count}</span>
                  {dropoff !== null && dropoff > 0 && (
                    <span className="text-red-400 text-[11px]">−{dropoff}%</span>
                  )}
                </span>
              </div>
            );
          })}
          {lost > 0 && (
            <div className="flex items-center justify-between text-xs pt-2 mt-2 border-t border-slate-100">
              <span className="flex items-center gap-2 text-slate-400">
                <span className="w-2 h-2 rounded-sm bg-slate-300" /> Lost
              </span>
              <span className="font-semibold text-slate-400">{lost}</span>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function RecentActivity({ items }) {
  const empty = !items || items.length === 0;
  return (
    <Card title="Recent Activity" subtitle="Latest conversation updates">
      {empty ? (
        <EmptyState label="No recent activity" height={160} />
      ) : (
        <div className="space-y-0">
          {items.map((it, i) => {
            const meta = channelMeta(it.channel);
            const Icon = meta.icon;
            return (
              <div key={i} className="flex gap-3 pb-4 last:pb-0 relative">
                {i < items.length - 1 && (
                  <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-100" />
                )}
                <div className="w-8 h-8 rounded-full grid place-items-center shrink-0 z-10" style={{ background: `${meta.color}1a` }}>
                  <Icon size={14} style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate">{it.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{it.time} ago</span>
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{it.message || 'No messages yet'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function TopCampaigns({ campaigns }) {
  const ranked = useMemo(() => {
    const weight = { sent: 0, scheduled: 1, draft: 2 };
    return [...(campaigns || [])]
      .sort((a, b) => (weight[a.status] ?? 3) - (weight[b.status] ?? 3)
        || new Date(b.created_at || 0) - new Date(a.created_at || 0))
      .slice(0, 5);
  }, [campaigns]);
  const empty = ranked.length === 0;
  const STATUS_STYLE = {
    sent: 'bg-emerald-50 text-emerald-600',
    scheduled: 'bg-amber-50 text-amber-600',
    draft: 'bg-slate-100 text-slate-500',
  };
  return (
    <Card title="Top Performing Campaigns" subtitle="By delivery status">
      {empty ? (
        <EmptyState label="No campaigns yet" height={160}
          action={<Link href="/campaigns" className="text-brand text-xs font-medium hover:underline">Create a campaign</Link>} />
      ) : (
        <div className="space-y-3">
          {ranked.map((c) => {
            const meta = channelMeta(c.channel_type);
            const Icon = meta.icon;
            return (
              <Link key={c.id} href="/campaigns"
                className="flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1a` }}>
                  <Icon size={14} style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">{c.name}</p>
                  <p className="text-[10px] text-slate-400 capitalize">{c.type || 'broadcast'}</p>
                </div>
                <span className={`text-[10px] font-medium px-2 py-1 rounded-full capitalize shrink-0 ${STATUS_STYLE[c.status] || 'bg-slate-100 text-slate-500'}`}>
                  {c.status || 'draft'}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function UpcomingFollowUps({ items }) {
  const empty = !items || items.length === 0;
  return (
    <Card title="Upcoming Follow-ups" subtitle="Open conversations waiting longest">
      {empty ? (
        <EmptyState label="You're all caught up" height={160} />
      ) : (
        <div className="space-y-1">
          {items.map((it) => {
            const meta = channelMeta(it.channel);
            const Icon = meta.icon;
            return (
              <Link key={it.id} href={`/inbox/${it.id}`}
                className="flex items-center gap-3 -mx-2 px-2 py-2 rounded-lg hover:bg-slate-50 transition-colors group">
                <div className="w-8 h-8 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.color}1a` }}>
                  <Icon size={14} style={{ color: meta.color }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 truncate">{it.name}</p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock size={10} /> waiting {it.waiting}
                  </p>
                </div>
                <ArrowUpRight size={14} className="text-slate-300 group-hover:text-brand transition-colors shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function EmptyState({ label, height, action }) {
  return (
    <div className="grid place-items-center text-center" style={{ height }}>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        {action && <div className="mt-2">{action}</div>}
      </div>
    </div>
  );
}

// AI Agent Performance — run counts, per-agent trend, and live status for the
// Marketing/Sales/Support agents. Kept as a self-contained section appended
// below the core CRM analytics dashboard above.
function AgentPerformance() {
  const [range, setRange] = useState('7d');
  const { data: agentAnalytics, isLoading: agentLoading } = useAgentAnalytics(range);
  const { data: agentStatus } = useAgentStatus();

  const agentChartData = useMemo(() => {
    const series = agentAnalytics?.series || [];
    const byDate = new Map();
    for (const p of series) {
      if (!byDate.has(p.date)) byDate.set(p.date, { date: p.date });
      byDate.get(p.date)[p.agentType] = p.count;
    }
    return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [agentAnalytics]);

  return (
    <>
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

        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Marketing Runs', value: agentAnalytics?.totals?.marketing ?? 0, icon: Megaphone,  tone: 'blue'    },
            { label: 'Sales Runs',     value: agentAnalytics?.totals?.sales     ?? 0, icon: TrendingUp, tone: 'emerald' },
            { label: 'Support Runs',   value: agentAnalytics?.totals?.support   ?? 0, icon: Headphones, tone: 'violet'  },
          ].map(({ label, value, icon, tone }) => (
            <StatCard key={label} label={label} value={value} icon={icon} tone={tone} />
          ))}
        </div>

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
              <Tooltip content={<AgentTooltip />} cursor={{ fill: 'rgba(241,245,249,0.6)', radius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} iconType="circle" iconSize={8} />
              <Bar dataKey="marketing" name="Marketing" fill="url(#barMkt)"   radius={[5,5,0,0]} maxBarSize={28} />
              <Bar dataKey="sales"     name="Sales"     fill="url(#barSales)" radius={[5,5,0,0]} maxBarSize={28} />
              <Bar dataKey="support"   name="Support"   fill="url(#barSup)"   radius={[5,5,0,0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { type: 'marketing', label: 'Marketing Agent', icon: Megaphone,  gradient: 'from-violet-600 to-rose-600',   sub: 'Campaigns · Segments · SEO'        },
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
    </>
  );
}

// ---------- page ----------

export default function AnalyticsPage() {
  const { call } = useApi();
  const [summary, setSummary] = useState(null);
  const [byStage, setByStage] = useState([]);
  const [ordersByDay, setOrdersByDay] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    call('/analytics/summary').then(setSummary).catch((e) => setErr(e.message));
    call('/analytics/leads-by-stage').then(setByStage).catch(() => {});
    call('/analytics/orders-by-day').then(setOrdersByDay).catch(() => {});
    call('/campaigns').then(setCampaigns).catch(() => {});
    call('/analytics/follow-ups').then(setFollowUps).catch(() => {});
  }, [call]);

  const revenueSpark = useMemo(
    () => ordersByDay.slice(-14).map((r) => ({ v: r.v })),
    [ordersByDay]
  );
  const conversationSpark = useMemo(
    () => (summary?.trend || []).map((r) => ({ v: r.v })),
    [summary]
  );
  const conversationGrowth = useMemo(
    () => pctChange((summary?.trend || []).map((r) => r.v)),
    [summary]
  );
  const revenueGrowth = useMemo(
    () => pctChange(ordersByDay.map((r) => r.v)),
    [ordersByDay]
  );

  const loading = !summary;

  return (
    <div className="min-h-screen bg-[#F5F7FB] p-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-brand" />
        <h2 className="text-lg font-bold text-slate-900">Analytics &amp; Insights</h2>
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} height={90} />)
        ) : (
          <>
            <FadeIn delay={0}>
              <Kpi icon={MessageSquareText} color="#2563eb" bg="#eff6ff" label="Total Conversations"
                   value={summary.totalConversations} sparklineData={conversationSpark} growth={conversationGrowth} />
            </FadeIn>
            <FadeIn delay={60}>
              <Kpi icon={CheckCircle2} color="#059669" bg="#ecfdf5" label="Active Conversations"
                   value={summary.openConversations} />
            </FadeIn>
            <FadeIn delay={120}>
              <Kpi icon={AlertTriangle} color="#dc2626" bg="#fef2f2" label="Unreplied"
                   value={summary.unreplied} warning={summary.unreplied > 0} />
            </FadeIn>
            <FadeIn delay={180}>
              <Kpi icon={IndianRupee} color="#7c3aed" bg="#f5f3ff" label="Revenue"
                   value={summary.revenueImpact} isCurrency sparklineData={revenueSpark} growth={revenueGrowth} />
            </FadeIn>
          </>
        )}
      </div>

      {/* Trend + stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? <CardSkeleton /> : <FadeIn delay={0}><ConversationTrend data={summary.trend} /></FadeIn>}
        {loading ? <CardSkeleton /> : <FadeIn delay={60}><LeadsByStage data={byStage} /></FadeIn>}
      </div>

      {/* Channel donut + top channels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? <CardSkeleton height={200} /> : <FadeIn delay={0}><ChannelDonut topChannels={summary.topChannels} /></FadeIn>}
        {loading ? <CardSkeleton height={200} /> : <FadeIn delay={60}><TopChannelsList topChannels={summary.topChannels} /></FadeIn>}
      </div>

      {/* Revenue trend + funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FadeIn delay={0}><RevenueTrend ordersByDay={ordersByDay} /></FadeIn>
        {loading ? <CardSkeleton height={200} /> : <FadeIn delay={60}><LeadFunnel data={byStage} /></FadeIn>}
      </div>

      {/* Activity / campaigns / follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {loading ? <CardSkeleton height={160} /> : <FadeIn delay={0}><RecentActivity items={summary.recentInbox} /></FadeIn>}
        <FadeIn delay={60}><TopCampaigns campaigns={campaigns} /></FadeIn>
        <FadeIn delay={120}><UpcomingFollowUps items={followUps} /></FadeIn>
      </div>

      {/* AI Agent Performance */}
      <AgentPerformance />
    </div>
  );
}
