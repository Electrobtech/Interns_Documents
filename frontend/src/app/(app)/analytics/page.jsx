'use client';
import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { useApi } from '@/lib/useApi';

const DONUT_COLORS = ['#2563eb', '#7c3aed', '#0ea5e9', '#f59e0b', '#94a3b8'];

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const { call } = useApi();
  const [summary, setSummary] = useState(null);
  const [byStage, setByStage] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    call('/analytics/summary').then(setSummary).catch((e) => setErr(e.message));
    call('/analytics/leads-by-stage').then(setByStage).catch(() => {});
  }, [call]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 size={20} className="text-brand" />
        <h2 className="text-lg font-bold">Analytics & Insights</h2>
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Conversations" value={summary?.totalConversations ?? 0} />
        <Stat label="Open" value={summary?.openConversations ?? 0} />
        <Stat label="Unreplied" value={summary?.unreplied ?? 0} />
        <Stat label="Revenue" value={'₹' + Number(summary?.revenueImpact || 0).toLocaleString('en-IN')} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-sm mb-3">Conversations (last 7 days)</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={summary?.trend || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="v" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="font-semibold text-sm mb-3">Leads by Stage</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byStage}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="d" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={11} />
              <Tooltip />
              <Bar dataKey="v" fill="#1e40af" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {byStage.length === 0 && <p className="text-xs text-slate-400 -mt-8 text-center">No lead data yet.</p>}
        </div>
      </div>

      {/* Channel performance donut */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 max-w-md">
        <p className="font-semibold text-sm mb-3">Channel Performance</p>
        {(() => {
          const data = (summary?.topChannels || []).map(([name, value]) => ({ name, value }));
          if (data.length === 0) return <p className="text-xs text-slate-400">No channel data yet.</p>;
          return (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="55%" height={200}>
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                    {data.map((d, i) => <Cell key={d.name} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5">
                {data.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                    <span className="capitalize text-slate-600">{d.name}</span>
                    <span className="text-slate-400 ml-auto">{d.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
