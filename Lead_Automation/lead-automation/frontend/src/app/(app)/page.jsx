'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, Tooltip,
} from 'recharts';
import { useApi } from '@/lib/useApi';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Stat({ label, value, delta }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {delta && (
        <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1">
          <TrendingUp size={12} /> {delta}
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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold">Hi, Arjun 👋</h2>
        <p className="text-sm text-slate-500">Here's what's happening today</p>
      </div>

      {err && <p className="text-sm text-red-500">Could not load dashboard: {err}</p>}

      {/* Onboarding / setup prompt */}
      <Link href="/onboarding"
        className="flex items-center justify-between bg-brand-light border border-brand/20 rounded-xl px-4 py-3 hover:bg-brand-light/70">
        <span className="text-sm text-brand-dark font-medium">🚀 Finish setup — connect your channels & invite your team</span>
        <span className="text-sm text-brand font-medium">Get Started →</span>
      </Link>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Conversations" value={(data?.totalConversations ?? 0).toLocaleString('en-IN')} delta="12.5%" />
        <Stat label="Revenue Impact" value={inr(data?.revenueImpact)} delta="22.4%" />
        <Stat label="Open Conversations" value={data?.openConversations ?? 0} />
        <Stat label="Unreplied" value={data?.unreplied ?? 0} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Performance chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-sm mb-3">Performance Overview</p>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip />
              <Area type="monotone" dataKey="v" stroke="#2563eb" fill="url(#g)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Top channels */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-sm mb-4">Top Channels</p>
          <div className="space-y-3">
            {topChannels.length === 0 && <p className="text-xs text-slate-400">No channel activity yet.</p>}
            {topChannels.map(([name, pct]) => (
              <div key={name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600 capitalize">{name}</span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-brand rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified inbox preview */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Unified Inbox</p>
          <Link href="/inbox" className="text-xs text-brand font-medium cursor-pointer">View All Conversations →</Link>
        </div>
        <div className="divide-y divide-slate-100">
          {inbox.length === 0 && <p className="text-xs text-slate-400 py-3">No conversations yet.</p>}
          {inbox.map((c, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
                {(c.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.name}</span>
                  <span className="text-[10px] text-slate-400 capitalize">{c.channel}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{c.message}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${
                c.status === 'open' ? 'bg-emerald-50 text-emerald-600'
                : c.status === 'pending' ? 'bg-amber-50 text-amber-600'
                : 'bg-slate-100 text-slate-500'}`}>{c.status}</span>
              <span className="text-[10px] text-slate-400 w-8 text-right">{c.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
