'use client';
import Sidebar from '../components/Sidebar';
import { Search, Bell, HelpCircle, TrendingUp } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, Tooltip,
} from 'recharts';

const trend = [
  { d: 'Mon', v: 30 }, { d: 'Tue', v: 45 }, { d: 'Wed', v: 38 },
  { d: 'Thu', v: 55 }, { d: 'Fri', v: 48 }, { d: 'Sat', v: 68 }, { d: 'Sun', v: 62 },
];

const topChannels = [
  ['WhatsApp', 45], ['Instagram', 25], ['Web Chat', 15], ['Messenger', 10], ['Voice', 5],
];

const inbox = [
  ['Rohan Verma', 'WhatsApp', 'I need help with my order', 'Open', '2m'],
  ['Ananya Singh', 'Instagram', 'Do you have this in size M?', 'Open', '5m'],
  ['Neha Patel', 'Web Chat', 'How can I track my order?', 'Pending', '10m'],
  ['Vikram Joshi', 'Messenger', "What's your return policy?", 'Open', '15m'],
];

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
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div>
            <h1 className="text-lg font-bold text-brand-dark tracking-tight">LEAD AUTOMATION</h1>
            <p className="text-[11px] text-slate-400 -mt-0.5">Unified Customer Engagement & Revenue Platform</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-72">
              <Search size={15} className="text-slate-400" />
              <input className="bg-transparent text-sm outline-none w-full" placeholder="Search (Leads, Contacts, Conversations...)" />
            </div>
            <Bell size={18} className="text-slate-500" />
            <HelpCircle size={18} className="text-slate-500" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand text-white grid place-items-center text-xs font-bold">AK</div>
              <div className="text-xs leading-tight">
                <div className="font-medium">Arjun Kumar</div>
                <div className="text-slate-400">Admin</div>
              </div>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          <div>
            <h2 className="text-xl font-bold">Hi, Arjun 👋</h2>
            <p className="text-sm text-slate-500">Here's what's happening today</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Total Conversations" value="1,245" delta="12.5%" />
            <Stat label="Revenue Impact" value="₹2,45,000" delta="22.4%" />
            <Stat label="Open Conversations" value="132" />
            <Stat label="Unreplied" value="18" />
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
                {topChannels.map(([name, pct]) => (
                  <div key={name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{name}</span>
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
              <a className="text-xs text-brand font-medium cursor-pointer">View All Conversations →</a>
            </div>
            <div className="divide-y divide-slate-100">
              {inbox.map(([name, ch, msg, status, time]) => (
                <div key={name} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
                    {name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      <span className="text-[10px] text-slate-400">{ch}</span>
                    </div>
                    <p className="text-xs text-slate-500 truncate">{msg}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    status === 'Open' ? 'bg-emerald-50 text-emerald-600'
                    : status === 'Pending' ? 'bg-amber-50 text-amber-600'
                    : 'bg-slate-100 text-slate-500'}`}>{status}</span>
                  <span className="text-[10px] text-slate-400 w-8 text-right">{time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
