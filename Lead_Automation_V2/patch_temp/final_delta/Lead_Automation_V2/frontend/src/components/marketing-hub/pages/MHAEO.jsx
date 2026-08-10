'use client';
import { useState } from 'react';
import { Zap, RefreshCw, Plus, Copy, Trash2, Sparkles } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { useAeoList, useCreateAeoOptimization, useDeleteAeoOptimization, useAeoOverview } from '@/lib/queries/marketingHub';

const ANSWER_TYPES = [
  { value: 'featured_snippet', label: 'Featured Snippet' },
  { value: 'local_pack', label: 'Local Pack' },
  { value: 'knowledge_panel', label: 'Knowledge Panel' },
];

export default function MHAEO() {
  const toast = useMHToast();
  const [queryText, setQueryText] = useState('');
  const [answerType, setAnswerType] = useState('featured_snippet');
  const [currentContent, setCurrentContent] = useState('');
  const [expanded, setExpanded] = useState(null);

  const { data: items = [], isLoading } = useAeoList();
  const create = useCreateAeoOptimization();
  const remove = useDeleteAeoOptimization();
  const { data: overview } = useAeoOverview();

  const handleCreate = async () => {
    if (!queryText.trim()) return toast.show('Enter a question or query first', 'error');
    try {
      const row = await create.mutateAsync({ query: queryText.trim(), answer_type: answerType, current_content: currentContent.trim() || null });
      setExpanded(row.id);
      setQueryText(''); setCurrentContent('');
      toast.show('AI-optimized answer generated', 'success');
    } catch (err) {
      toast.show(err.message || 'Could not generate optimization', 'error');
    }
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>AEO — Answer Engine Optimization</h1>
        <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Generate AI-answer-engine-optimized content per query, with a real LLM call</p>
      </div>

      {/* Overview strip */}
      {overview?.status_distribution?.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {overview.status_distribution.map((s, i) => (
            <span key={i} style={{ fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 99, background: '#fff', border: '1px solid var(--mh-border)', color: '#374151' }}>
              {s.count} {s.answer_type?.replace('_', ' ')} ({s.status})
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* New optimization form */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: 20, boxShadow: 'var(--mh-shadow-sm)', position: 'sticky', top: 24 }}>
          <div style={{ fontFamily: 'var(--mh-font-display)', fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 14 }}>New Optimization</div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Query / Question</label>
          <input className="mh-input" value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder='e.g. "what is the best CRM for small teams"' style={{ width: '100%', marginBottom: 14 }} />
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Target Answer Type</label>
          <select className="mh-input" value={answerType} onChange={(e) => setAnswerType(e.target.value)} style={{ width: '100%', marginBottom: 14 }}>
            {ANSWER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 6 }}>Existing Content (optional)</label>
          <textarea className="mh-input" value={currentContent} onChange={(e) => setCurrentContent(e.target.value)} rows={4}
            placeholder="Paste your current page content to improve — or leave blank to generate from scratch." style={{ width: '100%', resize: 'vertical', marginBottom: 16 }} />
          <button className="mh-btn mh-btn-ai" onClick={handleCreate} disabled={create.isPending} style={{ width: '100%', justifyContent: 'center' }}>
            {create.isPending ? <><RefreshCw size={14} className="mh-animate-spin" />Generating…</> : <><Sparkles size={14} />Generate Optimized Answer</>}
          </button>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>}
          {!isLoading && items.length === 0 && (
            <div style={{ background: '#fff', border: '1px dashed #e5e7eb', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
              <Zap size={28} style={{ color: '#d1d5db', margin: '0 auto 10px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No optimizations yet</div>
              <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Generate one from the form on the left.</p>
            </div>
          )}
          {items.map((item) => {
            const isOpen = expanded === item.id;
            const fromLlm = item.performance?.generated_by === 'llm';
            return (
              <div key={item.id} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{item.query}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ textTransform: 'capitalize' }}>{item.answer_type?.replace('_', ' ')}</span>
                      {fromLlm && <span style={{ color: '#a855f7', fontWeight: 600 }}>· AI-generated</span>}
                    </div>
                  </div>
                  <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }}
                    onClick={(e) => { e.stopPropagation(); remove.mutate(item.id, { onSuccess: () => toast.show('Deleted', 'success') }); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 18px 18px' }}>
                    <pre style={{ fontFamily: 'var(--mh-font-body)', fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: '0 0 12px', background: '#f9fafb', borderRadius: 10, padding: 14, border: '1px solid #f3f4f6' }}>{item.optimized_content}</pre>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {(item.optimization_tips || []).map((tip, i) => (
                        <span key={i} style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '3px 9px', borderRadius: 99 }}>{tip}</span>
                      ))}
                    </div>
                    <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => { navigator.clipboard?.writeText(item.optimized_content || ''); toast.show('Copied', 'success'); }}>
                      <Copy size={12} /> Copy
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
