'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, MessageSquare, IndianRupee, Inbox as InboxIcon, AlertCircle, ArrowUpRight, Rocket } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, Tooltip,
} from 'recharts';
import { useApi } from '@/lib/useApi';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

const STAT_ICONS = {
  conversations: MessageSquare,
  revenue: IndianRupee,
  open: InboxIcon,
  unreplied: AlertCircle,
};

function Stat({ label, value, delta, icon }) {
  const Icon = STAT_ICONS[icon];
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <p className="text-xs text-slate-500">{label}</p>
        {Icon && (
          <div className="h-7 w-7 rounded-lg bg-brand/10 grid place-items-center shrink-0">
            <Icon size={14} className="text-brand" />
          </div>
        )}
      </div>
      <p className="text-2xl font-bold mt-2 text-slate-900">{value}</p>
      {delta && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1.5">
          <TrendingUp size={12} /> {delta}
          <span className="text-slate-400 font-normal">vs last month</span>
        </p>
      )}
    </div>
  );
}

export default function Dashboard() {
  const { call } = useApi();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    call('/analytics/summary').then(setData).catch((e) => setErr(e.message));
  }, [call]);

  const trend = data?.trend || [];
  const topChannels = data?.topChannels || [];
  const inbox = data?.recentInbox || [];

  return (
    <div className="p-6 space-y-6 bg-[#F7F9FC] min-h-screen">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Hi, Arjun 👋</h2>
        <p className="text-sm text-slate-500">Here's what's happening today</p>
      </div>

      {err && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          Could not load dashboard: {err}
        </p>
      )}

      {/* Onboarding / setup prompt */}
      <Link
        href="/onboarding"
        className="flex items-center justify-between bg-[#0B1220] rounded-xl px-5 py-4 group hover:bg-[#0B1220]/90 transition"
      >
        <span className="flex items-center gap-3 text-sm text-white font-medium">
          <span className="h-8 w-8 rounded-lg bg-brand/20 grid place-items-center shrink-0">
            <Rocket size={15} className="text-brand" />
          </span>
          Finish setup — connect your channels &amp; invite your team
        </span>
        <span className="text-sm text-white/70 font-medium flex items-center gap-1 group-hover:text-white group-hover:gap-1.5 transition-all">
          Get started <ArrowUpRight size={14} />
        </span>
      </Link>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          icon="conversations"
          label="Total Conversations"
          value={(data?.totalConversations ?? 0).toLocaleString('en-IN')}
          delta="12.5%"
        />
        <Stat icon="revenue" label="Revenue Impact" value={inr(data?.revenueImpact)} delta="22.4%" />
        <Stat icon="open" label="Open Conversations" value={data?.openConversations ?? 0} />
        <Stat icon="unreplied" label="Unreplied" value={data?.unreplied ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold text-sm text-slate-900">Performance Overview</p>
            <span className="text-[11px] text-slate-400 font-mono">last 30 days</span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2954E3" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2954E3" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                labelStyle={{ color: '#0f172a' }}
              />
              <Area type="monotone" dataKey="v" stroke="#2954E3" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top channels */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-sm text-slate-900 mb-4">Top Channels</p>
          <div className="space-y-3">
            {topChannels.length === 0 && <p className="text-xs text-slate-400">No channel activity yet.</p>}
            {topChannels.map(([name, pct]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 capitalize">{name}</span>
                  <span className="text-slate-400 font-mono">{pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified inbox preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm text-slate-900">Unified Inbox</p>
          <Link
            href="/inbox"
            className="text-xs text-brand font-medium flex items-center gap-1 hover:text-brand-dark cursor-pointer"
          >
            View all conversations <ArrowUpRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {inbox.length === 0 && <p className="text-xs text-slate-400 py-3">No conversations yet.</p>}
          {inbox.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-brand/10 grid place-items-center text-xs font-semibold text-brand shrink-0">
                {(c.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900">{c.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{c.channel}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{c.message}</p>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0 ${
                  c.status === 'open'
                    ? 'bg-emerald-50 text-emerald-600'
                    : c.status === 'pending'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {c.status}
              </span>
              <span className="text-[10px] text-slate-400 w-8 text-right shrink-0">{c.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}