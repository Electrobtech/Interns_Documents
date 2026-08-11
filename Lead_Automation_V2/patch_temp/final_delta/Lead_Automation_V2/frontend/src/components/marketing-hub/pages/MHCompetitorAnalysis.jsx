'use client';
import { useState } from 'react';
import { Plus, ExternalLink, Zap, TrendingUp, ChevronDown, Trash2 } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import MHModal from '../ui/MHModal';
import {
  useCompetitors, useAddCompetitor, useDeleteCompetitor,
  useCompetitorAnalyses, useRunCompetitorAnalysis, useCompetitorsOverview,
} from '@/lib/queries/marketingHub';

const ANALYSIS_TYPES = [
  { value: 'seo', label: 'SEO' },
  { value: 'content', label: 'Content' },
  { value: 'social', label: 'Social' },
];

function AddCompetitorModal({ onClose, toast }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [industry, setIndustry] = useState('');
  const add = useAddCompetitor();

  const submit = async () => {
    if (!name.trim()) return;
    try {
      await add.mutateAsync({ name: name.trim(), domain: domain.trim() || null, industry: industry.trim() || null });
      toast.show('Competitor added — run an analysis to see metrics.', 'success');
      onClose();
    } catch (err) {
      toast.show(err.message || 'Could not add competitor', 'error');
    }
  };

  return (
    <MHModal title="Add Competitor" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Competitor Name <span style={{ color: '#dc2626' }}>*</span></label>
          <input className="mh-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Freshworks" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Domain</label>
          <input className="mh-input" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="e.g. freshworks.com" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Industry</label>
          <input className="mh-input" value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. SaaS" />
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>DA, traffic, and gap metrics populate once you run "Analyze" on this competitor.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="mh-btn mh-btn-primary" disabled={!name.trim() || add.isPending} style={{ opacity: name.trim() ? 1 : 0.5 }} onClick={submit}>
          {add.isPending ? 'Adding…' : 'Add Competitor'}
        </button>
      </div>
    </MHModal>
  );
}

function CompetitorRow({ c, toast, onDelete }) {
  const [open, setOpen] = useState(false);
  const [analysisType, setAnalysisType] = useState('seo');
  const { data: analyses = [] } = useCompetitorAnalyses(open ? c.id : null);
  const runAnalysis = useRunCompetitorAnalysis();
  const latest = analyses[0];

  const runIt = async () => {
    try {
      await runAnalysis.mutateAsync({ id: c.id, analysis_type: analysisType });
      toast.show(`${analysisType.toUpperCase()} analysis complete for ${c.name}`, 'success');
    } catch (err) {
      toast.show(err.message || 'Analysis failed', 'error');
    }
  };

  return (
    <>
      <tr style={{ borderBottom: '1px solid #f3f4f6', cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={(e) => e.currentTarget.style.background = ''}>
        <td style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ChevronDown size={13} style={{ color: '#9ca3af', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
            <span style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{c.name}</span>
          </div>
        </td>
        <td style={{ padding: '12px 14px' }}>
          {c.domain ? (
            <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6366f1', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>
              {c.domain} <ExternalLink size={11} />
            </a>
          ) : <span style={{ fontSize: 12, color: '#9ca3af' }}>—</span>}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#374151' }}>{c.industry || '—'}</td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: '#6b7280' }}>
          {latest ? `${latest.analysis_type} · ${new Date(latest.analysis_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Not analyzed yet'}
        </td>
        <td style={{ padding: '12px 14px' }} onClick={(e) => e.stopPropagation()}>
          <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }} onClick={() => onDelete(c)}>
            <Trash2 size={12} />
          </button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ padding: '0 14px 16px', background: '#fafafa' }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
              <select className="mh-input" value={analysisType} onChange={(e) => setAnalysisType(e.target.value)} style={{ fontSize: 12, width: 140 }}>
                {ANALYSIS_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <button className="mh-btn mh-btn-primary" style={{ fontSize: 12 }} onClick={runIt} disabled={runAnalysis.isPending}>
                {runAnalysis.isPending ? 'Analyzing…' : `Run ${ANALYSIS_TYPES.find((t) => t.value === analysisType)?.label} Analysis`}
              </button>
            </div>
            {analyses.length === 0 ? (
              <div style={{ fontSize: 12, color: '#9ca3af' }}>No analysis run yet for this competitor.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {analyses.slice(0, 3).map((a) => (
                  <div key={a.id} style={{ background: '#fff', border: '1px solid #f3f4f6', borderRadius: 10, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', marginBottom: 6 }}>{a.analysis_type}</div>
                    {Object.entries(a.metrics || {}).slice(0, 4).map(([k, v]) => (
                      <div key={k} style={{ fontSize: 11, color: '#374151', display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                        <span style={{ color: '#9ca3af' }}>{k.replace(/_/g, ' ')}</span>
                        <span style={{ fontWeight: 600 }}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                      </div>
                    ))}
                    {(a.recommendations || []).length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: '#6b7280' }}>{a.recommendations[0]}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function MHCompetitorAnalysis() {
  const toast = useMHToast();
  const { data: competitors = [], isLoading } = useCompetitors();
  const deleteCompetitor = useDeleteCompetitor();
  const { data: overview } = useCompetitorsOverview();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Competitor Analysis</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Track competitors and run analyses — metrics are simulated per analysis (no SEMrush/Ahrefs-style key connected), but every competitor and analysis run is a real saved row</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={15} /> Add Competitor
        </button>
      </div>

      {/* Competitors Table */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Tracked Competitors</div>
        </div>
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
        ) : competitors.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No competitors tracked yet — add one above.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['COMPETITOR', 'DOMAIN', 'INDUSTRY', 'LAST ANALYSIS', ''].map((h) => (
                    <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {competitors.map((c) => (
                  <CompetitorRow key={c.id} c={c} toast={toast}
                    onDelete={(comp) => deleteCompetitor.mutate(comp.id, { onSuccess: () => toast.show(`Removed ${comp.name}`, 'success') })} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: '#a855f7' }} />
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>Recommendations</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Based on how much competitive intelligence you've gathered so far</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, padding: '20px' }}>
          {(!overview?.recommendations || overview.recommendations.length === 0) ? (
            <div style={{ fontSize: 12, color: '#9ca3af' }}>Add competitors and run analyses to get recommendations here.</div>
          ) : overview.recommendations.map((g, i) => (
            <div key={i} style={{ borderRadius: 10, background: '#f9fafb', border: `1px solid ${g.priority === 'high' ? '#dc262630' : '#6366f130'}`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: g.priority === 'high' ? '#fee2e2' : '#eef2ff', color: g.priority === 'high' ? '#dc2626' : '#6366f1' }}>{g.priority}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{g.message}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{g.action}</div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <AddCompetitorModal onClose={() => setShowAdd(false)} toast={toast} />}
    </div>
  );
}
