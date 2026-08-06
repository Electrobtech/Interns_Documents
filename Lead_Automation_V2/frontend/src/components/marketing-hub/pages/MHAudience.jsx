'use client';
import { useState } from 'react';
import { Plus, Users, TrendingUp, Zap, RefreshCw } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import { useMHToast } from '../ui/MHToast';
import { audiences, audienceGrowth } from '../mockData';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function ScoreRing({ score, size = 48 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} transform={`rotate(-90 ${size/2} ${size/2})`} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: color }}>{score}</text>
    </svg>
  );
}

const fmtSize = (n) => n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}K` : n;

const AI_SUGGESTIONS = [
  { title: 'High-Intent Lookalike', desc: 'Create a 2% lookalike of your top 500 buyers. Estimated reach: 1.8M', score: 94, color: '#6366f1' },
  { title: 'Re-engagement Segment', desc: 'Target leads inactive for 45+ days with a win-back campaign', score: 87, color: '#f59e0b' },
  { title: 'Cross-sell Opportunity', desc: 'Users who bought Course A but not Course B — high conversion potential', score: 91, color: '#10b981' },
];

export default function MHAudience() {
  const toast = useMHToast();
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Audience Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Build, segment, and grow your target audiences with AI</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="mh-btn mh-btn-ghost" onClick={() => toast.show('Refreshing audiences…', 'info')}><RefreshCw size={14} /></button>
          <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Opening audience builder…', 'info')}><Plus size={15} /> New Audience</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          {/* Audience Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
            {audiences.map(a => (
              <div key={a.id}
                onMouseEnter={() => setHovered(a.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: hovered === a.id ? 'var(--mh-shadow-md)' : 'var(--mh-shadow-sm)', transition: 'all 0.2s', cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{a.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3' }}>{a.source}</span>
                      <MHBadge label={a.status} variant="active" dot />
                    </div>
                  </div>
                  <ScoreRing score={a.score} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <Users size={15} style={{ color: '#6366f1' }} />
                  <span style={{ fontFamily: 'var(--mh-font-display)', fontSize: 24, fontWeight: 700, color: '#111827' }}>{fmtSize(a.size)}</span>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>total audience</span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Updated {new Date(a.lastUpdated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Editing ${a.name}`, 'info')}>Edit</button>
                  <button className="mh-btn mh-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Using ${a.name} in campaign`, 'success')}>Use in Campaign</button>
                </div>
              </div>
            ))}
          </div>

          {/* Audience Growth Chart */}
          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <TrendingUp size={16} style={{ color: '#6366f1' }} />
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Audience Growth — Last 8 Weeks</div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={audienceGrowth} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={v => fmtSize(v)} />
                <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Suggestions Panel */}
        <div>
          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} style={{ color: '#a855f7' }} />
                <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>AI Segment Suggestions</div>
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Based on your audience data and campaign performance</div>
            </div>
            <div style={{ padding: '16px' }}>
              {AI_SUGGESTIONS.map((s, i) => (
                <div key={i} style={{ padding: '14px', borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{s.title}</div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.color }}>{s.score}%</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 10 }}>{s.desc}</div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${s.score}%`, background: s.color }} />
                  </div>
                  <button className="mh-btn mh-btn-ghost" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Creating segment: ${s.title}`, 'success')}>
                    Create Segment
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
