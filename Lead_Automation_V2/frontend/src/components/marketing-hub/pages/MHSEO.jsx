'use client';
import { useState } from 'react';
import { Search, Zap, RefreshCw, ChevronDown, ChevronRight, FileText } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { PageHeader, SectionCard, EmptyState } from './_shared';
import { useSeoBriefs, useGenerateSeoBrief } from '@/lib/queries/marketingHub';

// This page used to show a live keyword-rank table (search volume, position,
// difficulty). There's no rank-tracking data source anywhere in this app —
// the real backend (ai-agent-backend's SeoService) is an LLM that, given a
// topic, generates a one-off SEO brief (suggested keywords, search intent,
// a content brief, on-page recommendations) and stores it. So instead of a
// rankings table, this is a "generate a brief, browse past briefs" flow.

function BriefRow({ brief, expanded, onToggle }) {
  const out = brief.output || {};
  const primaryKeywords = out.primary_keywords || [];
  const longTail = out.long_tail_keywords || [];
  const onPage = out.on_page_recommendations || [];
  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        {expanded ? <ChevronDown size={15} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <FileText size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{brief.topic}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(brief.created_at).toLocaleString()}</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6, flexShrink: 0 }}>
          {primaryKeywords.length} keywords
        </span>
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 18px 41px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {primaryKeywords.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Primary Keywords</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {primaryKeywords.map((k, i) => (
                  <span key={i} style={{ fontSize: 12, background: '#eef2ff', color: '#4338ca', padding: '3px 9px', borderRadius: 99 }}>
                    {typeof k === 'string' ? k : k.keyword || JSON.stringify(k)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {longTail.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Long-tail Keywords</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {longTail.map((k, i) => (
                  <span key={i} style={{ fontSize: 12, background: '#f3f4f6', color: '#374151', padding: '3px 9px', borderRadius: 99 }}>
                    {typeof k === 'string' ? k : k.keyword || JSON.stringify(k)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {onPage.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>On-page Recommendations</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                {onPage.map((r, i) => <li key={i}>{typeof r === 'string' ? r : JSON.stringify(r)}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MHSEO() {
  const toast = useMHToast();
  const [topic, setTopic] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const { data: briefs, isLoading, isError } = useSeoBriefs();
  const generate = useGenerateSeoBrief();

  const handleGenerate = () => {
    if (!topic.trim()) return;
    generate.mutate({ topic: topic.trim() }, {
      onSuccess: (res) => {
        toast.show('SEO brief generated.', 'success');
        setExpandedId(res.id);
        setTopic('');
      },
      onError: (err) => toast.show(err.message || 'Failed to generate SEO brief', 'error'),
    });
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      <PageHeader
        title="SEO Intelligence"
        subtitle="AI-generated keyword research and content briefs — not a live rank tracker; no external SEO data source is connected."
      />

      <SectionCard
        title="Generate a Brief"
        subtitle="Give the agent a topic or goal and it will suggest keywords, search intent, and on-page recommendations"
      >
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
            <input
              className="mh-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              placeholder="e.g. AI-powered lead generation for SMBs"
              style={{ paddingLeft: 30, width: '100%' }}
            />
          </div>
          <button className="mh-btn mh-btn-primary" onClick={handleGenerate} disabled={generate.isPending || !topic.trim()}>
            {generate.isPending ? <><RefreshCw size={14} className="mh-animate-spin" />Generating…</> : <><Zap size={14} />Generate Brief</>}
          </button>
        </div>
      </SectionCard>

      <div style={{ height: 20 }} />

      <SectionCard title="Past Briefs" subtitle={briefs?.length ? `${briefs.length} generated` : undefined}>
        {isLoading && <div style={{ padding: 20, fontSize: 13, color: '#6b7280' }}>Loading…</div>}
        {isError && <div style={{ padding: 20, fontSize: 13, color: '#dc2626' }}>Couldn't load past briefs.</div>}
        {!isLoading && !isError && (!briefs || briefs.length === 0) && (
          <EmptyState icon={FileText} title="No briefs yet" desc="Generate your first SEO brief above to see it here." />
        )}
        {!isLoading && briefs && briefs.length > 0 && (
          <div style={{ margin: '-16px -20px' }}>
            {briefs.map((b) => (
              <BriefRow key={b.id} brief={b} expanded={expandedId === b.id} onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
