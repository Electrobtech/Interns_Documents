'use client';
import { useState } from 'react';
import { Search, TrendingUp, Globe, BarChart2, Zap, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { seoKeywords } from '../mockData';

const SEO_RECS = [
  { title: 'Add FAQ Schema Markup', desc: 'Adding FAQ structured data to 8 target pages could improve click-through rate by 18–25%.', priority: 'High', color: '#dc2626' },
  { title: 'Target Keyword Gap: "AI CRM India"', desc: 'This keyword has 5,400 monthly searches and low difficulty (42). Competitors rank in top 3.', priority: 'Medium', color: '#d97706' },
  { title: 'Improve Page Speed on /pricing', desc: 'LCP is 4.2s. Compressing images and deferring JS could cut load time to under 2s.', priority: 'High', color: '#dc2626' },
];

export default function MHSEO() {
  const toast = useMHToast();
  const [auditRunning, setAuditRunning] = useState(false);
  const [search, setSearch] = useState('');

  const runAudit = () => {
    setAuditRunning(true);
    setTimeout(() => {
      setAuditRunning(false);
      toast.show('SEO audit complete! 3 new recommendations found.', 'success');
    }, 2200);
  };

  const filtered = seoKeywords.filter(k => k.keyword.toLowerCase().includes(search.toLowerCase()));

  const metrics = [
    { label: 'Organic Traffic', value: '84.2K', sub: '+12% MoM', color: '#6366f1', icon: Globe },
    { label: 'Ranked Keywords', value: '1,284', sub: '+47 this week', color: '#10b981', icon: BarChart2 },
    { label: 'Avg Position', value: '7.3', sub: '-1.2 improved', color: '#3b82f6', icon: TrendingUp },
    { label: 'Domain Authority', value: '54', sub: '+2 this month', color: '#f59e0b', icon: ArrowUpCircle },
  ];

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>SEO Intelligence</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Monitor rankings, analyze keywords, and optimize for search</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={runAudit} disabled={auditRunning}
          style={{ opacity: auditRunning ? 0.8 : 1 }}>
          {auditRunning ? <><RefreshCw size={14} className="mh-animate-spin" />Running Audit…</> : <><Search size={14} />Run SEO Audit</>}
        </button>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {metrics.map(m => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>{m.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
              </div>
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 26, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{m.value}</div>
              <div style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>{m.sub}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Keywords Table */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', flex: 1 }}>Keyword Rankings</div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input className="mh-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter keywords…" style={{ paddingLeft: 28, width: 180, fontSize: 12 }} />
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['KEYWORD', 'VOLUME', 'DIFFICULTY', 'POSITION', 'CHANGE', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((k, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#111827' }}>{k.keyword}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{k.volume.toLocaleString()}</td>
                    <td style={{ padding: '12px 14px', minWidth: 120 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-track" style={{ flex: 1 }}>
                          <div className="progress-fill" style={{ width: `${k.difficulty}%`, background: k.difficulty >= 70 ? '#dc2626' : k.difficulty >= 50 ? '#d97706' : '#059669' }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', minWidth: 20 }}>{k.difficulty}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>#{k.position}</span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: k.change > 0 ? '#059669' : '#dc2626' }}>
                        {k.change > 0 ? <ArrowUpCircle size={13} /> : <ArrowDownCircle size={13} />}
                        {k.change > 0 ? '+' : ''}{k.change}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => toast.show(`Optimizing for "${k.keyword}"`, 'info')}>Optimize</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* AI Recommendations */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={16} style={{ color: '#a855f7' }} />
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>AI Recommendations</div>
            </div>
          </div>
          <div style={{ padding: '16px' }}>
            {SEO_RECS.map((r, i) => (
              <div key={i} style={{ padding: 14, borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: r.color + '18', color: r.color }}>{r.priority}</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{r.title}</div>
                </div>
                <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{r.desc}</div>
                <button className="mh-btn mh-btn-ghost" style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Working on: ${r.title}`, 'info')}>
                  Apply Fix
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
