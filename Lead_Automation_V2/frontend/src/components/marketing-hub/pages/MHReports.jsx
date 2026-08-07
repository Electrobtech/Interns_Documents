'use client';
import { useState } from 'react';
import { Plus, Download, Eye, FileText, Calendar, Clock } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import { useMHToast } from '../ui/MHToast';

const REPORTS = [
  { id: 1, title: 'Q2 2025 Campaign Performance', type: 'Campaign', date: '2025-07-05', size: '4.8 MB', status: 'Ready' },
  { id: 2, title: 'Monthly SEO Report — July', type: 'SEO', date: '2025-08-01', size: '2.1 MB', status: 'Ready' },
  { id: 3, title: 'Competitor Analysis Q3', type: 'Competitor', date: '2025-07-28', size: '3.4 MB', status: 'Ready' },
  { id: 4, title: 'WhatsApp Broadcast Analytics', type: 'Broadcast', date: '2025-07-22', size: '1.6 MB', status: 'Ready' },
  { id: 5, title: 'Audience Growth Insights', type: 'Audience', date: '2025-07-15', size: '940 KB', status: 'Ready' },
  { id: 6, title: 'Revenue Attribution Report', type: 'Revenue', date: '2025-08-01', size: '5.2 MB', status: 'Generating' },
];

const SCHEDULED = [
  { id: 1, name: 'Weekly Campaign Summary', frequency: 'Weekly', nextRun: '2025-08-11', recipients: 3, status: 'Active' },
  { id: 2, name: 'Monthly KPI Dashboard', frequency: 'Monthly', nextRun: '2025-09-01', recipients: 5, status: 'Active' },
  { id: 3, name: 'SEO Rankings Update', frequency: 'Weekly', nextRun: '2025-08-11', recipients: 2, status: 'Active' },
];

const TYPE_COLORS = {
  Campaign: '#6366f1', SEO: '#10b981', Competitor: '#f59e0b',
  Broadcast: '#3b82f6', Audience: '#8b5cf6', Revenue: '#ef4444',
};

export default function MHReports() {
  const toast = useMHToast();

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Reports</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Generate, schedule, and download marketing reports</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Opening report generator…', 'info')}>
          <Plus size={15} /> Generate Report
        </button>
      </div>

      {/* Reports Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
        {REPORTS.map(r => (
          <div key={r.id} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)', transition: 'box-shadow 0.2s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--mh-shadow-md)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--mh-shadow-sm)'}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: (TYPE_COLORS[r.type] || '#6b7280') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <FileText size={18} style={{ color: TYPE_COLORS[r.type] || '#6b7280' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: (TYPE_COLORS[r.type] || '#6b7280') + '18', color: TYPE_COLORS[r.type] || '#6b7280' }}>{r.type}</span>
                  {r.status === 'Generating' && <MHBadge label="Generating…" variant="warning" dot />}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 14, fontSize: 12, color: '#6b7280' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Calendar size={12} />{new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>{r.size}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Viewing ${r.title}`, 'info')}>
                <Eye size={13} /> View
              </button>
              <button className="mh-btn mh-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12 }} onClick={() => toast.show(`Downloading ${r.title}`, 'success')} disabled={r.status === 'Generating'}>
                <Download size={13} /> Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Scheduled Reports */}
      <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} style={{ color: '#6366f1' }} />
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 15, fontWeight: 700, color: '#111827', flex: 1 }}>Scheduled Reports</div>
          <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }} onClick={() => toast.show('Opening schedule builder…', 'info')}>
            <Plus size={13} /> Schedule New
          </button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['REPORT NAME', 'FREQUENCY', 'NEXT RUN', 'RECIPIENTS', 'STATUS', ''].map(h => (
                  <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', padding: '10px 14px', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEDULED.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#111827' }}>{s.name}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{s.frequency}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{new Date(s.nextRun).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: '#374151' }}>{s.recipients} recipients</td>
                  <td style={{ padding: '12px 14px' }}><MHBadge label={s.status} variant="active" dot /></td>
                  <td style={{ padding: '12px 14px' }}>
                    <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => toast.show(`Editing: ${s.name}`, 'info')}>Edit</button>
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
