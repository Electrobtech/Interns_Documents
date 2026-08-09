'use client';
import { useState } from 'react';
import { Plus, Users, TrendingUp, Zap, RefreshCw, Loader2, AlertCircle } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import MHModal from '../ui/MHModal';
import { useMHToast } from '../ui/MHToast';
import {
  useMarketingAudiences,
  useAudienceGrowth,
  useCreateMarketingAudience,
  useDeleteMarketingAudience,
} from '@/lib/queries/marketingHub';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

function ScoreRing({ score, size = 48 }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const safe = typeof score === 'number' ? score : 0;
  const fill = (safe / 100) * circ;
  const color = safe >= 85 ? '#059669' : safe >= 70 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={5} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeDasharray={`${fill} ${circ - fill}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: color }}>
        {safe || '—'}
      </text>
    </svg>
  );
}

const fmtSize = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return String(v);
};

// Freshness score off size_computed_at — real, derived from the audience's
// own data, not a fabricated per-audience "quality" number.
function freshnessScore(a) {
  if (!a.size_computed_at) return 40;
  const ageDays = (Date.now() - new Date(a.size_computed_at).getTime()) / 86400000;
  if (ageDays < 1) return 96;
  if (ageDays < 7) return 85;
  if (ageDays < 30) return 65;
  return 40;
}

const SOURCE_OPTIONS = ['Custom', 'Pixel', 'Lookalike', 'Import', 'CRM'];

export default function MHAudience() {
  const toast = useMHToast();
  const [showCreate, setShowCreate] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [form, setForm] = useState({ name: '', source: 'Custom', size: '', score: '80' });

  const { data: audiences = [], isLoading, isError, error, refetch, isFetching } = useMarketingAudiences();
  const { data: growth = [], isLoading: growthLoading } = useAudienceGrowth(8);
  const createMut = useCreateMarketingAudience();
  const deleteMut = useDeleteMarketingAudience();

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.show('Name is required', 'error');
      return;
    }
    try {
      await createMut.mutateAsync({
        name: form.name.trim(),
        source: form.source,
        size: parseInt(form.size, 10) || 0,
        score: form.score === '' ? null : parseInt(form.score, 10),
        status: 'Active',
      });
      toast.show('Audience created', 'success');
      setShowCreate(false);
      setForm({ name: '', source: 'Custom', size: '', score: '80' });
    } catch (e) {
      toast.show(e?.message || 'Failed to create audience', 'error');
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete audience "${name}"?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      toast.show('Audience deleted', 'success');
    } catch (e) {
      toast.show(e?.message || 'Failed to delete', 'error');
    }
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Audience Manager</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Build audiences from real, tagged contacts — used directly by Campaigns and Broadcasts</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="mh-btn mh-btn-ghost"
            onClick={() => {
              refetch();
              toast.show('Refreshing audiences…', 'info');
            }}
            disabled={isFetching}
          >
            {isFetching ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          </button>
          <button className="mh-btn mh-btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={15} /> New Audience
          </button>
        </div>
      </div>

      {isError && (
        <div style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 8, color: '#991b1b', fontSize: 13 }}>
          <AlertCircle size={16} />
          {error?.message || 'Failed to load audiences'}
        </div>
      )}

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 14, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 20px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>New Audience</div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. High-Intent Leads Q3"
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, fontSize: 13 }}
            />
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Source</label>
            <select
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', marginBottom: 12, fontSize: 13 }}
            >
              {SOURCE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Size</label>
                <input
                  type="number"
                  min="0"
                  value={form.size}
                  onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))}
                  placeholder="0"
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Score (0–100)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={form.score}
                  onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13 }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="mh-btn mh-btn-ghost" onClick={() => setShowCreate(false)} disabled={createMut.isPending}>Cancel</button>
              <button className="mh-btn mh-btn-primary" onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending ? <Loader2 size={14} className="animate-spin" /> : null} Create
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 48, color: '#6b7280', gap: 8 }}>
              <Loader2 size={18} className="animate-spin" /> Loading audiences…
            </div>
          ) : audiences.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: 40, textAlign: 'center', marginBottom: 24 }}>
              <Users size={28} style={{ color: '#9ca3af', marginBottom: 8 }} />
              <div style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>No audiences yet</div>
              <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 16 }}>Create your first segment to start targeting.</div>
              <button className="mh-btn mh-btn-primary" onClick={() => setShowCreate(true)}>
                <Plus size={15} /> New Audience
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, marginBottom: 24 }}>
              {audiences.map((a) => (
                <div
                  key={a.id}
                  onMouseEnter={() => setHovered(a.id)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: '#fff',
                    border: '1px solid var(--mh-border)',
                    borderRadius: 14,
                    padding: '20px',
                    boxShadow: hovered === a.id ? 'var(--mh-shadow-md)' : 'var(--mh-shadow-sm)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111827', marginBottom: 4 }}>{a.name}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6, background: '#e0e7ff', color: '#3730a3' }}>{a.source}</span>
                        <MHBadge label={a.status} variant={a.status === 'Active' ? 'active' : 'default'} dot />
                      </div>
                    </div>
                    <ScoreRing score={a.score} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <Users size={15} style={{ color: '#6366f1' }} />
                    <span style={{ fontSize: 22, fontWeight: 800, color: '#111827' }}>{fmtSize(a.size)}</span>
                    <span style={{ fontSize: 12, color: '#9ca3af' }}>contacts</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    Updated {a.lastUpdated || (a.updated_at ? new Date(a.updated_at).toLocaleDateString() : '—')}
                  </div>
                  {hovered === a.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(a.id, a.name);
                      }}
                      style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '2px 8px', cursor: 'pointer' }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '16px 20px', boxShadow: 'var(--mh-shadow-sm)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TrendingUp size={16} style={{ color: '#6366f1' }} />
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Audience Growth — Last 8 Weeks</div>
            </div>
            {growthLoading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={growth} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                  <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }} formatter={(v) => fmtSize(v)} />
                  <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

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
                  <button
                    className="mh-btn mh-btn-ghost"
                    style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }}
                    onClick={async () => {
                      try {
                        await createMut.mutateAsync({
                          name: s.title,
                          source: 'Lookalike',
                          size: 0,
                          score: s.score,
                          status: 'Active',
                          filter_definition: { suggestion: s.desc },
                        });
                        toast.show(`Created segment: ${s.title}`, 'success');
                      } catch (e) {
                        toast.show(e?.message || 'Failed to create', 'error');
                      }
                    }}
                  >
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