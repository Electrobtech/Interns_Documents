'use client';
import { useState } from 'react';
import { Search, TrendingUp, Globe, BarChart2, Zap, ArrowUpCircle, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { useSeoKeywords, useAddSeoKeyword, useDeleteSeoKeyword, useSeoAudits, useRunSeoAudit, useSeoInsights } from '@/lib/queries/marketingHub';

export default function MHSEO() {
  const toast = useMHToast();
  const [search, setSearch] = useState('');
  const [newKeyword, setNewKeyword] = useState('');
  const [auditUrl, setAuditUrl] = useState('');

  const { data: keywords = [], isLoading } = useSeoKeywords({ search: search || undefined });
  const addKeyword = useAddSeoKeyword();
  const deleteKeyword = useDeleteSeoKeyword();
  const { data: audits = [] } = useSeoAudits({ limit: 5 });
  const runAudit = useRunSeoAudit();
  const { data: insights } = useSeoInsights();

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await addKeyword.mutateAsync({ keyword: newKeyword.trim(), target_rank: 3 });
      setNewKeyword('');
      toast.show(`Now tracking "${newKeyword.trim()}"`, 'success');
    } catch (err) {
      toast.show(err.message || 'Could not add keyword', 'error');
    }
  };

  const handleRunAudit = async () => {
    if (!auditUrl.trim()) return toast.show('Enter a URL to audit first', 'error');
    try {
      const result = await runAudit.mutateAsync({ url: auditUrl.trim(), audit_type: 'technical' });
      toast.show(`Audit complete — score ${result.score}/100, ${result.issues?.length || 0} issue(s) found`, 'success');
    } catch (err) {
      toast.show(err.message || 'Audit failed', 'error');
    }
  };

  const k = insights?.keywords;
  const metrics = [
    { label: 'Tracked Keywords', value: k ? Number(k.total_keywords || 0).toLocaleString() : '—', icon: BarChart2, color: '#10b981' },
    { label: 'Total Search Volume', value: k?.total_search_volume ? Number(k.total_search_volume).toLocaleString() : '—', icon: Globe, color: '#6366f1' },
    { label: 'Avg Difficulty', value: k?.avg_difficulty ? Math.round(k.avg_difficulty) : '—', icon: TrendingUp, color: '#3b82f6' },
    { label: 'Targets Met', value: k ? `${k.ranking_targets_met || 0}/${(Number(k.ranking_targets_met || 0) + Number(k.ranking_targets_missed || 0)) || 0}` : '—', icon: ArrowUpCircle, color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>SEO Intelligence</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Track keywords and run audits — real Postgres-backed tracking (ranking data is simulated, no search-console key connected yet)</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="mh-input" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder="https://yoursite.com/page" style={{ width: 220, fontSize: 12 }} />
          <button className="mh-btn mh-btn-primary" onClick={handleRunAudit} disabled={runAudit.isPending}>
            {runAudit.isPending ? <><RefreshCw size={14} className="mh-animate-spin" />Auditing…</> : <><Search size={14} />Run SEO Audit</>}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>{m.label}</span>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${m.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color: m.color }} />
                </div>
              </div>
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 26, fontWeight: 700, color: '#111827' }}>{m.value}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>
        {/* Keywords Table */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', flex: 1 }}>Keyword Rankings</div>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              <input className="mh-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter keywords…" style={{ paddingLeft: 28, width: 160, fontSize: 12 }} />
            </div>
            <input className="mh-input" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddKeyword()}
              placeholder="Add a keyword to track…" style={{ width: 180, fontSize: 12 }} />
            <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }} onClick={handleAddKeyword} disabled={addKeyword.isPending}><Plus size={13} /> Track</button>
          </div>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
          ) : keywords.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No keywords tracked yet — add one above.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['KEYWORD', 'VOLUME', 'DIFFICULTY', 'POSITION', 'TARGET', ''].map((h) => (
                      <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keywords.map((kw) => (
                    <tr key={kw.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, color: '#111827' }}>{kw.keyword}</td>
                      <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{Number(kw.search_volume || 0).toLocaleString()}</td>
                      <td style={{ padding: '12px 14px', minWidth: 120 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-track" style={{ flex: 1 }}>
                            <div className="progress-fill" style={{ width: `${kw.difficulty}%`, background: kw.difficulty >= 70 ? '#dc2626' : kw.difficulty >= 50 ? '#d97706' : '#059669' }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#374151', minWidth: 20 }}>{kw.difficulty}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        {kw.current_rank
                          ? <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>#{kw.current_rank}</span>
                          : <span style={{ fontSize: 12, color: '#9ca3af' }}>Not ranked yet</span>}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>#{kw.target_rank || '—'}</td>
                      <td style={{ padding: '12px 14px' }}>
                        <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }}
                          onClick={() => deleteKeyword.mutate(kw.id, { onSuccess: () => toast.show('Removed', 'success') })}>
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recommendations + Audit History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} style={{ color: '#a855f7' }} />
                <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>Recommendations</div>
              </div>
            </div>
            <div style={{ padding: '16px' }}>
              {(insights?.recommendations || []).length === 0 ? (
                <div style={{ fontSize: 12, color: '#9ca3af' }}>Track a few keywords and run an audit to get recommendations.</div>
              ) : insights.recommendations.map((r, i) => (
                <div key={i} style={{ padding: 12, borderRadius: 10, background: '#f9fafb', border: '1px solid #f3f4f6', marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: r.priority === 'high' ? '#fee2e2' : '#fef3c7', color: r.priority === 'high' ? '#dc2626' : '#d97706' }}>{r.priority}</span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{r.message}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{r.action}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827' }}>Recent Audits</div>
            </div>
            <div style={{ padding: audits.length ? '8px 0' : '16px 20px' }}>
              {audits.length === 0 && <div style={{ fontSize: 12, color: '#9ca3af' }}>No audits run yet.</div>}
              {audits.map((a) => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid #f9fafb' }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: a.score >= 80 ? '#059669' : a.score >= 60 ? '#d97706' : '#dc2626' }}>{a.score}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.url}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>{new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
