'use client';
import { useState } from 'react';
import { Zap, RefreshCw, ChevronDown, ChevronRight, MessageSquare } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { PageHeader, SectionCard, EmptyState } from './_shared';
import { useAeoOptimizations, useGenerateAeoOptimization } from '@/lib/queries/marketingHub';

// This used to show four fixed platform scores (ChatGPT/Gemini/Claude/
// Perplexity) that never changed. There's no per-platform citation tracking
// anywhere in the backend — the real endpoint (AeoService) takes one piece
// of copy, scores it, and returns rewritten copy plus concrete suggestions.
// So this is a "paste copy, get one score + a rewrite" flow, same shape as
// SEO/Competitor above.

function ScoreRing({ score, size = 120 }) {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#059669' : score >= 50 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="46%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 24, fontWeight: 800, fill: '#111827', fontFamily: 'Outfit,sans-serif' }}>{score}</text>
      <text x="50%" y="62%" dominantBaseline="middle" textAnchor="middle" style={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}>/ 100</text>
    </svg>
  );
}

function OptimizationRow({ item, expanded, onToggle }) {
  const out = item.output || {};
  const hooks = out.citation_hooks || [];
  const qa = out.structured_qa || [];
  const improvements = out.improvements || [];
  const quickWins = out.quick_wins || [];
  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        {expanded ? <ChevronDown size={15} style={{ color: '#9ca3af', flexShrink: 0 }} /> : <ChevronRight size={15} style={{ color: '#9ca3af', flexShrink: 0 }} />}
        <MessageSquare size={15} style={{ color: '#6366f1', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.input_text}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{new Date(item.created_at).toLocaleString()}</div>
        </div>
        {typeof out.aeo_score === 'number' && (
          <span style={{ fontSize: 12, fontWeight: 700, color: out.aeo_score >= 80 ? '#059669' : out.aeo_score >= 50 ? '#d97706' : '#dc2626', flexShrink: 0 }}>
            {out.aeo_score}/100
          </span>
        )}
      </button>
      {expanded && (
        <div style={{ padding: '0 16px 18px 41px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {out.score_reason && (
            <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.6 }}>{out.score_reason}</div>
          )}
          {out.optimized_copy && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Optimized Copy</div>
              <div style={{ fontSize: 13, color: '#111827', lineHeight: 1.6, background: '#f9fafb', border: '1px solid #f3f4f6', borderRadius: 8, padding: 12 }}>{out.optimized_copy}</div>
            </div>
          )}
          {quickWins.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Quick Wins</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                {quickWins.map((q, i) => <li key={i}>{typeof q === 'string' ? q : JSON.stringify(q)}</li>)}
              </ul>
            </div>
          )}
          {improvements.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Improvements</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.8 }}>
                {improvements.map((im, i) => <li key={i}>{typeof im === 'string' ? im : JSON.stringify(im)}</li>)}
              </ul>
            </div>
          )}
          {qa.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Structured Q&amp;A</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {qa.map((item2, i) => (
                  <div key={i} style={{ fontSize: 12, color: '#374151' }}>
                    {typeof item2 === 'object' ? (
                      <>
                        <div style={{ fontWeight: 700 }}>{item2.question}</div>
                        <div style={{ color: '#6b7280' }}>{item2.answer}</div>
                      </>
                    ) : JSON.stringify(item2)}
                  </div>
                ))}
              </div>
            </div>
          )}
          {hooks.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Citation Hooks</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {hooks.map((h, i) => (
                  <span key={i} style={{ fontSize: 12, background: '#eef2ff', color: '#4338ca', padding: '3px 9px', borderRadius: 99 }}>
                    {typeof h === 'string' ? h : JSON.stringify(h)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MHAEO() {
  const toast = useMHToast();
  const [copy, setCopy] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [lastResult, setLastResult] = useState(null);

  const { data: history, isLoading, isError } = useAeoOptimizations();
  const generate = useGenerateAeoOptimization();

  const handleOptimize = () => {
    if (!copy.trim()) return;
    generate.mutate({ copy: copy.trim() }, {
      onSuccess: (res) => {
        toast.show('AEO analysis complete.', 'success');
        setLastResult(res);
        setExpandedId(res.id);
        setCopy('');
      },
      onError: (err) => toast.show(err.message || 'Failed to run AEO optimization', 'error'),
    });
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      <PageHeader
        title="AEO Citation Engine"
        subtitle="Paste marketing copy to get an AI-answer-engine citation score and a rewrite — scored per submission, not a live multi-platform tracker."
      />

      <div style={{ display: 'grid', gridTemplateColumns: lastResult ? '1fr 220px' : '1fr', gap: 20, alignItems: 'start', marginBottom: 20 }}>
        <SectionCard title="Optimize Copy" subtitle="Paste a headline, page copy, or FAQ answer to score and improve">
          <textarea
            className="mh-input"
            value={copy}
            onChange={(e) => setCopy(e.target.value)}
            placeholder="Paste the marketing copy you want AI search engines to be able to cite…"
            rows={5}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <button className="mh-btn mh-btn-ai" onClick={handleOptimize} disabled={generate.isPending || !copy.trim()} style={{ marginTop: 10 }}>
            {generate.isPending ? <><RefreshCw size={14} className="mh-animate-spin" />Optimizing…</> : <><Zap size={14} />Optimize for AI</>}
          </button>
        </SectionCard>

        {lastResult && typeof lastResult.aeo_score === 'number' && (
          <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '20px', boxShadow: 'var(--mh-shadow-sm)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280', marginBottom: 12 }}>Latest Score</div>
            <ScoreRing score={lastResult.aeo_score} />
          </div>
        )}
      </div>

      <SectionCard title="History" subtitle={history?.length ? `${history.length} optimizations` : undefined}>
        {isLoading && <div style={{ padding: 20, fontSize: 13, color: '#6b7280' }}>Loading…</div>}
        {isError && <div style={{ padding: 20, fontSize: 13, color: '#dc2626' }}>Couldn't load history.</div>}
        {!isLoading && !isError && (!history || history.length === 0) && (
          <EmptyState icon={MessageSquare} title="No optimizations yet" desc="Paste some copy above to run your first AEO analysis." />
        )}
        {!isLoading && history && history.length > 0 && (
          <div style={{ margin: '-16px -20px' }}>
            {history.map((item) => (
              <OptimizationRow key={item.id} item={item} expanded={expandedId === item.id} onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)} />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
