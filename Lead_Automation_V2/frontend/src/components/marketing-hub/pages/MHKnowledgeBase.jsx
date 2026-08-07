'use client';
import { useState } from 'react';
import { Plus, Search, Download, Eye, FileText, Tag } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { knowledgeDocs } from '../mockData';

const CATEGORIES = ['All', 'Brand Guidelines', 'Reports', 'Case Studies', 'Marketing Docs', 'Templates'];

const CAT_COLORS = {
  'Brand Guidelines': '#6366f1',
  'Reports': '#3b82f6',
  'Case Studies': '#10b981',
  'Marketing Docs': '#f59e0b',
  'Templates': '#8b5cf6',
};

export default function MHKnowledgeBase() {
  const toast = useMHToast();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = knowledgeDocs.filter(d =>
    (activeCategory === 'All' || d.category === activeCategory) &&
    (d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some(t => t.toLowerCase().includes(search.toLowerCase())))
  );

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Knowledge Base</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Store and organize marketing documents, templates, and guidelines</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Opening document upload…', 'info')}>
          <Plus size={15} /> Upload Document
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 20, maxWidth: 420 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input className="mh-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents, tags…" style={{ paddingLeft: 32, width: '100%' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Sidebar Categories */}
        <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, boxShadow: 'var(--mh-shadow-sm)', padding: '8px' }}>
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#9ca3af' }}>Categories</div>
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', border: 'none',
                borderRadius: 8, fontSize: 13, cursor: 'pointer', fontWeight: activeCategory === cat ? 600 : 400,
                background: activeCategory === cat ? '#eef2ff' : 'transparent',
                color: activeCategory === cat ? '#6366f1' : '#374151',
                transition: 'all 0.15s', marginBottom: 2,
              }}>
              {cat}
              <span style={{ float: 'right', fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>
                {cat === 'All' ? knowledgeDocs.length : knowledgeDocs.filter(d => d.category === cat).length}
              </span>
            </button>
          ))}
        </div>

        {/* Documents Grid */}
        <div>
          {filtered.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '60px 24px', textAlign: 'center' }}>
              <FileText size={36} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No documents found</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filtered.map(doc => (
                <div key={doc.id} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: '18px', boxShadow: 'var(--mh-shadow-sm)', transition: 'box-shadow 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--mh-shadow-md)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--mh-shadow-sm)'}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: (CAT_COLORS[doc.category] || '#6b7280') + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <FileText size={18} style={{ color: CAT_COLORS[doc.category] || '#6b7280' }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827', marginBottom: 4, lineHeight: 1.3 }}>{doc.title}</div>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: (CAT_COLORS[doc.category] || '#6b7280') + '18', color: CAT_COLORS[doc.category] || '#6b7280' }}>{doc.category}</span>
                    </div>
                  </div>
                  {/* Tags */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                    {doc.tags.map(tag => (
                      <span key={tag} style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#f3f4f6', color: '#6b7280' }}>
                        <Tag size={9} />{tag}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
                    <span>Updated {new Date(doc.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <span>{doc.size}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => toast.show(`Viewing ${doc.title}`, 'info')}>
                      <Eye size={12} /> View
                    </button>
                    <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => toast.show(`Downloading ${doc.title}`, 'success')}>
                      <Download size={12} /> Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
