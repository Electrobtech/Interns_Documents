'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, Bot, Megaphone, Headphones, ArrowRight,
  Sparkles, Users, Inbox, BarChart3, ShoppingCart,
  MessageCircle, Zap, AlertCircle,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from 'recharts';
import { useApi } from '@/lib/useApi';
import { useAgentStatus, useMarketingRuns, useSalesRuns, useSupportRuns } from '@/lib/queries/aiAgents';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

/* ─── small stat card ─────────────────────────── */
function StatCard({ label, value, delta, icon: Icon, href, tone = 'blue' }) {
  const TONES = {
    blue:    { bg: 'from-violet-50 to-rose-100',   icon: 'text-violet-600',   val: 'text-violet-700'   },
    emerald: { bg: 'from-emerald-50 to-teal-100',  icon: 'text-emerald-600',val: 'text-emerald-700'},
    amber:   { bg: 'from-amber-50 to-orange-100',  icon: 'text-amber-600',  val: 'text-amber-700'  },
    violet:  { bg: 'from-violet-50 to-purple-100', icon: 'text-violet-600', val: 'text-violet-700' },
  };
  const t = TONES[tone] || TONES.blue;
  const inner = (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${t.bg}`}>
          <Icon size={16} className={t.icon} />
        </div>
        {delta && (
          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
            <TrendingUp size={10} /> {delta}
          </span>
        )}
      </div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1 tabular-nums">{value ?? '—'}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

/* ─── agent insight card ──────────────────────── */
function AgentCard({ label, icon: Icon, gradient, badgeBg, badgeText, runs, emptyMsg, href, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      <div className={`flex items-center justify-between px-5 py-4 ${gradient}`}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-white/20 border border-white/30">
            <Icon size={16} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm">{label}</p>
            <p className={`text-[11px] ${badgeText} mt-0.5`}>
              {runs != null ? `${runs} run${runs !== 1 ? 's' : ''} this session` : 'Loading…'}
            </p>
          </div>
        </div>
        <Link href={href}
          className="flex items-center gap-1 text-[11px] font-semibold text-white/80 hover:text-white transition-colors">
          Open <ArrowRight size={12} />
        </Link>
      </div>
      <div className="p-4 space-y-2">
        {children || (
          <p className="text-xs text-slate-400 text-center py-4">{emptyMsg}</p>
        )}
      </div>
    </div>
  );
}

function RunRow({ brief, meta }) {
  return (
    <div className="flex items-start gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 transition-colors">
      <div className="p-1 rounded-md bg-slate-100 shrink-0 mt-0.5">
        <Zap size={10} className="text-slate-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-700 truncate">{brief}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{meta}</p>
      </div>
    </div>
  );
}

/* ─── main dashboard ──────────────────────────── */
export default function Dashboard() {
  const { call } = useApi();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const { data: agentStatus } = useAgentStatus();
  const { data: mktRuns }     = useMarketingRuns();
  const { data: salesRuns }   = useSalesRuns();
  const { data: supportRuns } = useSupportRuns();

  useEffect(() => {
    call('/analytics/summary').then(setData).catch((e) => setErr(e.message));
  }, [call]);

  const trend       = data?.trend        || [];
  const topChannels = data?.topChannels  || [];
  const inbox       = data?.recentInbox  || [];

  return (
    <div className="p-6 space-y-6 animate-fade-in">

      {/* greeting */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Good morning 👋
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Here's what your AI agents have been working on</p>
        </div>
      </div>

      {err && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">Could not load dashboard: {err}</p>
        </div>
      )}

      {/* setup prompt */}
      <Link href="/app/onboarding"
        className="flex items-center justify-between bg-violet-50 border border-violet-100 rounded-2xl px-5 py-3.5 hover:bg-violet-100/60 transition-colors group">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100 text-violet-600">
            <Zap size={14} />
          </div>
          <span className="text-sm text-violet-800 font-medium">
            Finish setup — connect your channels & invite your team
          </span>
        </div>
        <span className="text-sm text-violet-600 font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
          Get Started <ArrowRight size={14} />
        </span>
      </Link>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Conversations" value={(data?.totalConversations ?? 0).toLocaleString('en-IN')} delta="12.5%" icon={MessageCircle} href="/app/inbox" tone="blue" />
        <StatCard label="Revenue Impact"      value={inr(data?.revenueImpact)}    delta="22.4%"  icon={ShoppingCart} href="/app/ecommerce" tone="emerald" />
        <StatCard label="Open Conversations"  value={data?.openConversations ?? 0} icon={Inbox}   href="/app/inbox"     tone="amber" />
        <StatCard label="Unreplied"           value={data?.unreplied ?? 0}          icon={AlertCircle}                tone="violet" />
      </div>

      {/* charts + channels row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-bold text-slate-800 text-sm">Performance Overview</p>
              <p className="text-[11px] text-slate-400">Message volume trend</p>
            </div>
            <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">Last 7 days</span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0}    />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#94a3b8' }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Area type="monotone" dataKey="v" stroke="#2563eb" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
          <p className="font-bold text-slate-800 text-sm mb-4">Top Channels</p>
          <div className="space-y-3">
            {topChannels.length === 0 && (
              <p className="text-xs text-slate-400">No channel activity yet.</p>
            )}
            {topChannels.map(([name, pct]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 capitalize font-medium">{name}</span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-rose-500 rounded-full transition-all duration-700"
                    style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3 Agent Insight Cards ─────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-rose-100 text-violet-600">
            <Bot size={15} />
          </div>
          <div>
            <p className="font-bold text-slate-800 text-sm">AI Agent Activity</p>
            <p className="text-[11px] text-slate-400">What your agents worked on — live from the platform</p>
          </div>
          <Link href="/app/ai-agents"
            className="ml-auto text-xs font-semibold text-violet-600 hover:text-violet-700 flex items-center gap-1">
            Manage Agents <ArrowRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Marketing Agent */}
          <AgentCard
            label="Marketing Agent" icon={Megaphone}
            gradient="bg-gradient-to-r from-violet-600 to-rose-600"
            badgeText="text-violet-200"
            runs={Array.isArray(mktRuns) ? mktRuns.length : null}
            emptyMsg="No campaigns generated yet. Open the Marketing Agent to start."
            href="/app/ai-agents"
          >
            {Array.isArray(mktRuns) && mktRuns.length > 0
              ? mktRuns.slice(0, 3).map((r) => (
                  <RunRow key={r.id} brief={r.brief}
                    meta={new Date(r.created_at).toLocaleString()} />
                ))
              : <p className="text-xs text-slate-400 text-center py-3">No campaigns generated yet</p>
            }
          </AgentCard>

          {/* Sales Agent */}
          <AgentCard
            label="Sales Agent" icon={TrendingUp}
            gradient="bg-gradient-to-r from-emerald-600 to-teal-600"
            badgeText="text-emerald-200"
            runs={Array.isArray(salesRuns) ? salesRuns.length : null}
            emptyMsg="No leads analysed yet. Open the Sales Agent to score a lead."
            href="/app/ai-agents"
          >
            {Array.isArray(salesRuns) && salesRuns.length > 0
              ? salesRuns.slice(0, 3).map((r) => (
                  <RunRow key={r.id} brief={r.brief}
                    meta={`Score ${r.output?.lead_score ?? '—'} · ${new Date(r.created_at).toLocaleDateString()}`} />
                ))
              : <p className="text-xs text-slate-400 text-center py-3">No leads analysed yet</p>
            }
          </AgentCard>

          {/* Support Agent */}
          <AgentCard
            label="Support Agent" icon={Headphones}
            gradient="bg-gradient-to-r from-violet-600 to-purple-600"
            badgeText="text-violet-200"
            runs={Array.isArray(supportRuns) ? supportRuns.length : null}
            emptyMsg="No support tickets handled yet. Open the Support Agent to draft a reply."
            href="/app/ai-agents"
          >
            {Array.isArray(supportRuns) && supportRuns.length > 0
              ? supportRuns.slice(0, 3).map((r) => (
                  <RunRow key={r.id} brief={r.brief}
                    meta={`${r.output?.ticket_category ?? 'general'} · ${r.output?.priority_level ?? '—'} priority`} />
                ))
              : <p className="text-xs text-slate-400 text-center py-3">No tickets handled yet</p>
            }
          </AgentCard>
        </div>
      </div>

      {/* Inbox preview */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600">
              <Inbox size={15} />
            </div>
            <p className="font-bold text-slate-800 text-sm">Recent Conversations</p>
          </div>
          <Link href="/app/inbox"
            className="text-xs text-violet-600 font-semibold hover:text-violet-700 flex items-center gap-1">
            View All <ArrowRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {inbox.length === 0 && (
            <p className="text-xs text-slate-400 py-4 text-center">No conversations yet.</p>
          )}
          {inbox.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-100 to-rose-200 grid place-items-center text-xs font-bold text-violet-700 shrink-0">
                {(c.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-700">{c.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize bg-slate-100 px-1.5 py-0.5 rounded-md">{c.channel}</span>
                </div>
                <p className="text-xs text-slate-500 truncate mt-0.5">{c.message}</p>
              </div>
              <div className="text-right shrink-0">
                <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold
                  ${c.status === 'open'    ? 'bg-emerald-50 text-emerald-600'
                  : c.status === 'pending' ? 'bg-amber-50 text-amber-600'
                  : 'bg-slate-100 text-slate-500'}`}>
                  {c.status}
                </span>
                <p className="text-[10px] text-slate-400 mt-1">{c.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
