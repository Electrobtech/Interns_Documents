'use client';
import { useState } from 'react';
import { TrendingUp, Users, MousePointerClick, BarChart2, ChevronDown } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { performanceData, platformData, revenueData, channelPerformance } from '../mockData';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const DATE_RANGES = ['Last 7 days', 'Last 30 days', 'Last 90 days', 'This Year'];

const KPI_METRICS = [
  { label: 'Impressions', value: '2.38M', sub: '+14% vs prev period', color: '#6366f1', icon: TrendingUp },
  { label: 'Clicks', value: '119K', sub: '+8% vs prev period', color: '#3b82f6', icon: MousePointerClick },
  { label: 'Leads', value: '18.4K', sub: '+22% vs prev period', color: '#10b981', icon: Users },
  { label: 'Revenue', value: '₹55.2L', sub: '+18% vs prev period', color: '#f59e0b', icon: BarChart2 },
];

export default function MHAnalytics() {
  const toast = useMHToast();
  const [dateRange, setDateRange] = useState('Last 30 days');

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Analytics</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Measure performance across all channels and campaigns</p>
        </div>
        <div style={{ position: 'relative' }}>
          <select className="mh-input" value={dateRange} onChange={e => setDateRange(e.target.value)} style={{ paddingRight: 28, appearance: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
            {DATE_RANGES.map(d => <option key={d}>{d}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} />
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {KPI_METRICS.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>{m.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: m.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
              </div>
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>{m.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, marginBottom: 20 }}>
        {/* Area Chart */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)' }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Impressions & Leads Over Time</div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={performanceData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="anaImpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="anaLeadGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={(v, n) => [n === 'impressions' ? `${(v/1000000).toFixed(2)}M` : v.toLocaleString(), n]} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Area yAxisId="left" type="monotone" dataKey="impressions" name="Impressions" stroke="#6366f1" fill="url(#anaImpGrad)" strokeWidth={2} />
              <Area yAxisId="right" type="monotone" dataKey="leads" name="Leads" stroke="#10b981" fill="url(#anaLeadGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)' }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Platform Distribution</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={platformData} cx="50%" cy="50%" innerRadius={40} outerRadius={68} dataKey="value" paddingAngle={2}>
                {platformData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={v => [`${v}%`]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {platformData.map((p, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: '#374151' }}>{p.name}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#111827', marginLeft: 'auto' }}>{p.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Revenue vs Target Bar Chart */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)', marginBottom: 20 }}>
        <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>Revenue vs Target</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={revenueData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
            <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={v => [`₹${(v/100000).toFixed(1)}L`]} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
            <Bar dataKey="target" name="Target" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Channel Performance Table */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Channel Performance</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['CHANNEL', 'LEADS', 'COST PER LEAD', 'ROAS'].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {channelPerformance.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{c.channel}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{c.leads.toLocaleString()}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>₹{c.cpl}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: c.roas >= 50 ? '#059669' : c.roas >= 20 ? '#d97706' : '#6b7280' }}>{c.roas}x</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
