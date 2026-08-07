'use client';
import { useState } from 'react';
import { Plus, Search, Send, Pause, RefreshCw, ShieldCheck, ChevronDown, BarChart2, Zap } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import MHDrawer from '../ui/MHDrawer';
import { useMHToast } from '../ui/MHToast';
import { broadcasts } from '../mockData';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const STATUS_VARIANT = { Sent: 'sent', Scheduled: 'scheduled', Draft: 'draft', Active: 'active', Paused: 'paused' };

function ScoreRing({ score, size = 56 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 85 ? '#059669' : score >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5} strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle" style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontSize: 13, fontWeight: 700, fill: color }}>{score}</text>
    </svg>
  );
}

export default function MHBroadcasts() {
  const toast = useMHToast();
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('All');
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(null);

  const filtered = broadcasts.filter(b =>
    (channel === 'All' || b.channel === channel) &&
    b.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusCounts = { Total: broadcasts.length, Active: broadcasts.filter(b => b.status === 'Active').length, Sent: broadcasts.filter(b => b.status === 'Sent').length, Scheduled: broadcasts.filter(b => b.status === 'Scheduled').length, Draft: broadcasts.filter(b => b.status === 'Draft').length };

  const handleSelect = (id) => setSelected(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const funnelForDrawer = (b) => [
    { stage: 'Sent', value: b.sent, color: '#6366f1' },
    { stage: 'Delivered', value: b.delivered, color: '#3b82f6' },
    { stage: 'Opened', value: b.opened, color: '#10b981' },
    { stage: 'Clicked', value: b.clicked, color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Opening broadcast composer…', 'info')}>
          <Plus size={15} /> New Broadcast
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => toast.show('Running policy check…', 'info')}>
          <ShieldCheck size={14} /> Policy Check
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => toast.show(selected.length ? `Sending ${selected.length} broadcasts…` : 'Select broadcasts first', selected.length ? 'success' : 'error')}>
          <Send size={14} /> Send
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => toast.show('Broadcasts paused', 'info')}>
          <Pause size={14} /> Pause
        </button>
        <button className="mh-btn mh-btn-ghost" onClick={() => toast.show('Refreshed', 'success')}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="mh-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search broadcasts…" style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <div style={{ position: 'relative' }}>
          <select className="mh-input" value={channel} onChange={e => setChannel(e.target.value)} style={{ paddingRight: 28, appearance: 'none', cursor: 'pointer' }}>
            {['All', 'WhatsApp', 'Email', 'SMS'].map(c => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown size={13} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9ca3af' }} />
        </div>
      </div>

      {/* Status Pills */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(statusCounts).map(([k, v]) => (
          <span key={k} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#fff', border: '1px solid var(--mh-border)', color: 'var(--mh-text-2)', cursor: 'pointer' }}>
            {v} {k}
          </span>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center' }}>
            <BarChart2 size={36} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No broadcasts found</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Try adjusting your filters or create a new broadcast.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th style={{ width: 36, padding: '10px 14px' }}><input type="checkbox" /></th>
                  {['NAME', 'CHANNEL', 'AUDIENCE', 'STATUS', 'SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'CONV%', 'AI SCORE', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id} onClick={() => setDrawer(b)} style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 14px' }} onClick={e => { e.stopPropagation(); handleSelect(b.id); }}>
                      <input type="checkbox" checked={selected.includes(b.id)} readOnly />
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', maxWidth: 220 }}>{b.name}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: b.channel === 'WhatsApp' ? '#d1fae5' : b.channel === 'Email' ? '#e0e7ff' : '#fef3c7', color: b.channel === 'WhatsApp' ? '#065f46' : b.channel === 'Email' ? '#3730a3' : '#92400e' }}>{b.channel}</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}><span style={{ fontSize: 12, color: '#6b7280' }}>{b.audience}</span></td>
                    <td style={{ padding: '10px 14px' }}><MHBadge label={b.status} variant={STATUS_VARIANT[b.status] || 'default'} dot /></td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{b.sent.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{b.delivered.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{b.opened.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#111827' }}>{b.clicked.toLocaleString()}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: b.conversion > 0 ? '#059669' : '#9ca3af', fontWeight: 600 }}>{b.conversion > 0 ? `${b.conversion}%` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="progress-track" style={{ width: 48 }}>
                          <div className="progress-fill" style={{ width: `${b.aiScore}%`, background: b.aiScore >= 85 ? '#059669' : b.aiScore >= 70 ? '#d97706' : '#dc2626' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{b.aiScore}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px' }}></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Drawer */}
      {drawer && (
        <MHDrawer title={drawer.name} subtitle={`${drawer.channel} · ${drawer.audience}`} onClose={() => setDrawer(null)} width={640}>
          <div style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { l: 'Sent', v: drawer.sent.toLocaleString() },
                { l: 'Delivered', v: drawer.delivered.toLocaleString() },
                { l: 'Opened', v: drawer.opened.toLocaleString() },
                { l: 'Clicked', v: drawer.clicked.toLocaleString() },
                { l: 'Conversion', v: drawer.conversion > 0 ? `${drawer.conversion}%` : '—' },
                { l: 'AI Score', v: `${drawer.aiScore}/100` },
              ].map(m => (
                <div key={m.l} style={{ background: '#f9fafb', borderRadius: 10, padding: '14px 16px', border: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#9ca3af', marginBottom: 4 }}>{m.l}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{m.v}</div>
                </div>
              ))}
            </div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 12 }}>Delivery Funnel</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={funnelForDrawer(drawer)} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="stage" type="category" tick={{ fontSize: 12 }} width={70} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelForDrawer(drawer).map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))', borderRadius: 12, padding: '16px 20px', border: '1px solid rgba(99,102,241,0.15)' }}>
              <ScoreRing score={drawer.aiScore} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                  <Zap size={13} style={{ color: '#a855f7', marginRight: 4 }} />AI Recommendation
                </div>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  {drawer.aiScore >= 85
                    ? 'Excellent performance. Consider replicating this broadcast structure for future campaigns.'
                    : drawer.aiScore >= 70
                      ? 'Good delivery rate. Improve subject lines and send time to boost open rates.'
                      : 'Low engagement detected. Review audience segmentation and message relevance.'}
                </div>
              </div>
            </div>
          </div>
        </MHDrawer>
      )}
    </div>
  );
}
