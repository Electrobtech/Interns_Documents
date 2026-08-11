'use client';
import { useState } from 'react';
import { Plus, Search, FileText, Tag, ThumbsUp, Trash2, Eye } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import MHModal from '../ui/MHModal';
import { useKnowledgeArticles, useCreateKnowledgeArticle, useDeleteKnowledgeArticle, useMarkArticleHelpful, useKnowledgeCategories } from '@/lib/queries/marketingHub';

function NewArticleModal({ onClose, toast }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Getting Started');
  const [content, setContent] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const create = useCreateKnowledgeArticle();

  const submit = async () => {
    if (!title.trim() || !content.trim()) return;
    try {
      await create.mutateAsync({
        title: title.trim(), content: content.trim(), category,
        tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
        status: 'published',
      });
      toast.show('Article published', 'success');
      onClose();
    } catch (err) {
      toast.show(err.message || 'Could not save article', 'error');
    }
  };

  return (
    <MHModal title="New Article" onClose={onClose} width={520}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Title <span style={{ color: '#dc2626' }}>*</span></label>
          <input className="mh-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. How to launch your first campaign" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Category</label>
          <input className="mh-input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Getting Started" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Tags (comma-separated)</label>
          <input className="mh-input" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="campaigns, whatsapp" />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Content <span style={{ color: '#dc2626' }}>*</span></label>
          <textarea className="mh-input" rows={6} value={content} onChange={(e) => setContent(e.target.value)} style={{ resize: 'vertical' }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22, paddingTop: 16, borderTop: '1px solid #f3f4f6' }}>
        <button className="mh-btn mh-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="mh-btn mh-btn-primary" disabled={!title.trim() || !content.trim() || create.isPending} onClick={submit}>
          {create.isPending ? 'Publishing…' : 'Publish Article'}
        </button>
      </div>
    </MHModal>
  );
}

export default function MHKnowledgeBase() {
  const toast = useMHToast();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showNew, setShowNew] = useState(false);
  const [open, setOpen] = useState(null);

  const { data: articles = [], isLoading } = useKnowledgeArticles({ search: search || undefined, category: category === 'All' ? undefined : category });
  const { data: categories = [] } = useKnowledgeCategories();
  const deleteArticle = useDeleteKnowledgeArticle();
  const markHelpful = useMarkArticleHelpful();

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Knowledge Base</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Real, saved help articles — searchable and editable</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => setShowNew(true)}><Plus size={15} /> New Article</button>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="mh-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search articles…" style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <select className="mh-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="All">All Categories</option>
          {categories.map((c) => <option key={c.category} value={c.category}>{c.category} ({c.count})</option>)}
        </select>
      </div>

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>}

      {!isLoading && articles.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #e5e7eb', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <FileText size={28} style={{ color: '#d1d5db', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No articles found</div>
        </div>
      )}

      {!isLoading && articles.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {articles.map((a) => {
            const isOpen = open === a.id;
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={() => setOpen(isOpen ? null : a.id)}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <FileText size={15} style={{ color: '#6366f1' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>{a.category}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Eye size={10} /> {a.view_count || 0}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><ThumbsUp size={10} /> {a.helpful_count || 0}</span>
                      {a.status !== 'published' && <span style={{ color: '#d97706', fontWeight: 600 }}>{a.status}</span>}
                    </div>
                  </div>
                  <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#dc2626' }}
                    onClick={(e) => { e.stopPropagation(); deleteArticle.mutate(a.id, { onSuccess: () => toast.show('Deleted', 'success') }); }}>
                    <Trash2 size={12} />
                  </button>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 18px 18px' }}>
                    <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: '0 0 12px' }}>{a.content}</p>
                    {a.tags?.length > 0 && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                        {a.tags.map((t) => (
                          <span key={t} style={{ fontSize: 11, color: '#6366f1', background: '#eef2ff', padding: '2px 9px', borderRadius: 99, display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Tag size={9} />{t}
                          </span>
                        ))}
                      </div>
                    )}
                    <button className="mh-btn mh-btn-ghost" style={{ fontSize: 12 }}
                      onClick={() => markHelpful.mutate(a.id, { onSuccess: () => toast.show('Thanks for the feedback!', 'success') })}>
                      <ThumbsUp size={12} /> Helpful
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewArticleModal onClose={() => setShowNew(false)} toast={toast} />}
    </div>
  );
}
