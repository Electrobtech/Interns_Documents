'use client';
import { useState } from 'react';
import { Plus, ExternalLink, Zap, TrendingUp, ShieldAlert } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import MHModal from '../ui/MHModal';
import { competitors as initialCompetitors } from '../mockData';

function AddCompetitorModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  const submit = () => {
    if (!name.trim()) return;
    onCreated({
      id: String(Date.now()),
      name: name.trim(),
      domain: domain.trim() || '—',
      // Metrics require an analysis pass (the row's own "Analyze" action) —
      // left at 0 rather than invented, same rule as everywhere else here.
      da: 0, traffic: '—', backlinks: '—', opportunity: 0, threat: 0, engagement: 0,
    });
    onClose();
  };

  return (
    <MHModal title="Add Competitor" onClose={onClose} width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Competitor Name <span style={{ color: '#dc2626' }}>*</span></label>
          <input className="mh-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Freshworks" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Domain</label>
          <input className="mh-input" value={domain} onChange={e => setDomain(e.target.value)} placeholder="e.g. freshworks.com" />
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>DA, traffic, and gap metrics populate once you run "Analyze" on this competitor.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="mh-btn mh-btn-primary" disabled={!name.trim()} style={{ opacity: name.trim() ? 1 : 0.5 }} onClick={submit}>Add Competitor</button>
      </div>
    </MHModal>
  );
}

const GAP_ANALYSIS = [
  { title: 'Email Automation Workflows', desc: 'HubSpot and ActiveCampaign have deep workflow builders. You lack multi-step email automation.', type: 'Feature Gap', color: '#dc2626' },
  { title: 'Content Marketing Volume', desc: "Salesforce publishes 3x more blog content monthly. Increasing output could capture 15K+ monthly organic visits.", type: 'Content Gap', color: '#d97706' },
  { title: 'LinkedIn Organic Presence', desc: 'Zoho CRM has 180K LinkedIn followers vs your 12K. Focus on thought leadership content.', type: 'Social Gap', color: '#6366f1' },
  { title: 'Free Tier Offering', desc: 'All top competitors offer free plans. A freemium model could drive 40% more top-of-funnel leads.', type: 'Pricing Gap', color: '#f59e0b' },
];

export default function MHCompetitorAnalysis() {
  const toast = useMHToast();
  const [competitors, setCompetitors] = useState(initialCompetitors);
  const [showAdd, setShowAdd] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Competitor Analysis</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Track competitors, identify gaps, and turn threats into opportunities</p>
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
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['COMPETITOR', 'DOMAIN', 'DA', 'MONTHLY TRAFFIC', 'BACKLINKS', 'OPPORTUNITY', 'THREAT', 'ENGAGEMENT', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {competitors.map(c => (
                <tr key={c.id}
                  onMouseEnter={() => setHoveredRow(c.id)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ borderBottom: '1px solid #f3f4f6', background: hoveredRow === c.id ? '#f9fafb' : '', transition: 'background 0.1s', cursor: 'pointer' }}>
                  <td style={{ padding: '12px 14px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#111827' }}>{c.name}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#6366f1', textDecoration: 'none' }} onClick={e => e.stopPropagation()}>
                      {c.domain} <ExternalLink size={11} />
                    </a>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#111827', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{c.da}</span>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{c.traffic}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{c.backlinks}</td>
                  <td style={{ padding: '12px 14px', minWidth: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-track" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${c.opportunity}%`, background: '#10b981' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#10b981', minWidth: 24 }}>{c.opportunity}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', minWidth: 110 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-track" style={{ flex: 1 }}>
                        <div className="progress-fill" style={{ width: `${c.threat}%`, background: c.threat >= 80 ? '#dc2626' : c.threat >= 60 ? '#d97706' : '#6b7280' }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.threat >= 80 ? '#dc2626' : c.threat >= 60 ? '#d97706' : '#6b7280', minWidth: 24 }}>{c.threat}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{c.engagement}%</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => toast.show(`Analyzing ${c.name}…`, 'info')}>Analyze</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Gap Analysis */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', background: 'linear-gradient(135deg,rgba(168,85,247,0.06),rgba(99,102,241,0.06))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={16} style={{ color: '#a855f7' }} />
            <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827' }}>AI Gap Analysis</div>
          </div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>Opportunities identified from competitive intelligence</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, padding: '20px' }}>
          {GAP_ANALYSIS.map((g, i) => (
            <div key={i} style={{ borderRadius: 10, background: '#f9fafb', border: `1px solid ${g.color}30`, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: g.color + '18', color: g.color }}>{g.type}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{g.title}</div>
              <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>{g.desc}</div>
              <button className="mh-btn mh-btn-ghost" style={{ marginTop: 12, width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Action plan for: ${g.title}`, 'info')}>
                <TrendingUp size={12} /> Create Action Plan
              </button>
            </div>
          ))}
        </div>
      </div>

      {showAdd && (
        <AddCompetitorModal
          onClose={() => setShowAdd(false)}
          onCreated={(c) => { setCompetitors(prev => [c, ...prev]); toast.show('Competitor added!', 'success'); }}
        />
      )}
    </div>
  );
}
