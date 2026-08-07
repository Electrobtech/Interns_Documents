'use client';
import { useState } from 'react';
import { Zap, RefreshCw, ChevronDown, ChevronRight, ShieldAlert, Target } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { PageHeader, SectionCard, EmptyState } from './_shared';
import { useCompetitorReports, useGenerateCompetitorIntel } from '@/lib/queries/marketingHub';

// This used to show a table of tracked competitors with live DA/traffic/
// backlink numbers. There's no such data source connected anywhere in the
// app — the real backend (CompetitorService) is an LLM that reasons about a
// subject (a competitor, category, or market) you give it, and every
// response carries a `disclaimer` the API explicitly requires be shown, so
// this always renders it rather than presenting the output as fact.

function ReportRow({ report, expanded, onToggle }) {
  const out = report.output || {};
  const angles = out.likely_competitor_angles || [];
  const diffs = out.differentiation_suggestions || [];
  const gaps = out.content_gaps || [];
  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        {expanded ? <ChevronDown size={15} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <Target size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{report.subject}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(report.created_at).toLocaleString()}</div>
        </div>
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 18px 41px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {out.disclaimer && (
            <div style={{ display: 'flex', gap: 8, fontSize: 12, color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
              <ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{out.disclaimer}</span>
            </div>
          )}
          {out.positioning_summary && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Positioning Summary</div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>{out.positioning_summary}</div>
            </div>
          )}
          {angles.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Likely Competitor Angles</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                {angles.map((a, i) => <li key={i}>{typeof a === 'string' ? a : JSON.stringify(a)}</li>)}
              </ul>
            </div>
          )}
          {diffs.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Differentiation Suggestions</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                {diffs.map((d, i) => <li key={i}>{typeof d === 'string' ? d : JSON.stringify(d)}</li>)}
              </ul>
            </div>
          )}
          {gaps.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Content Gaps</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                {gaps.map((g, i) => <li key={i}>{typeof g === 'string' ? g : JSON.stringify(g)}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MHCompetitorAnalysis() {
  const toast = useMHToast();
  const [subject, setSubject] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data: reports, isLoading, isError } = useCompetitorReports();
  const generate = useGenerateCompetitorIntel();

  const handleGenerate = () => {
    if (!subject.trim()) return;
    generate.mutate({ subject: subject.trim() }, {
      onSuccess: (res) => {
        toast.show('Competitor report generated.', 'success');
        setExpandedId(res.id);
        setSubject('');
      },
      onError: (err) => toast.show(err.message || 'Failed to generate report', 'error'),
    });
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      <PageHeader
        title="Competitor Analysis"
        subtitle="AI-reasoned competitive intelligence — not live tracked data; no external competitor data source is connected."
      />

      <SectionCard
        title="Generate a Report"
        subtitle="Name a competitor, category, or market and the agent will reason about positioning and gaps"
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="mh-input"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            placeholder="e.g. HubSpot, or 'WhatsApp CRM tools for India'"
            style={{ flex: 1 }}
          />
          <button className="mh-btn mh-btn-primary" onClick={handleGenerate} disabled={generate.isPending || !subject.trim()}>
            {generate.isPending ? <><RefreshCw size={14} className="mh-animate-spin" />Analyzing…</> : <><Zap size={14} />Generate Report</>}
          </button>
        </div>
      </SectionCard>

      <div style={{ height: 20 }} />

      <SectionCard title="Past Reports" subtitle={reports?.length ? `${reports.length} generated` : undefined}>
        {isLoading && <div style={{ padding: 20, fontSize: 13, color: '#6b7280' }}>Loading…</div>}
        {isError && <div style={{ padding: 20, fontSize: 13, color: '#dc2626' }}>Couldn't load past reports.</div>}
        {!isLoading && !isError && (!reports || reports.length === 0) && (
          <EmptyState icon={Target} title="No reports yet" desc="Generate your first competitor report above to see it here." />
        )}
        {!isLoading && reports && reports.length > 0 && (
          <div style={{ margin: '-16px -20px' }}>
            {reports.map((r) => (
              <ReportRow key={r.id} report={r} expanded={expandedId === r.id} onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
