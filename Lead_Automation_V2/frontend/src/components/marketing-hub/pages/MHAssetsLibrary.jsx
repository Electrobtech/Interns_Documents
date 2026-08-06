'use client';
import { useState } from 'react';
import { Plus, Search, Download, Trash2, Image as ImageIcon, FileText, Video, FileArchive } from 'lucide-react';
import MHBadge from '../ui/MHBadge';
import { useMHToast } from '../ui/MHToast';
import { assets } from '../mockData';

const TABS = ['All', 'Images', 'Videos', 'PDFs', 'Logos', 'AI Generated'];

const TYPE_ICONS = {
  Images: ImageIcon,
  Videos: Video,
  PDFs: FileText,
  Logos: FileArchive,
  'AI Generated Images': ImageIcon,
};

export default function MHAssetsLibrary() {
  const toast = useMHToast();
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');

  const filtered = assets.filter(a =>
    (activeTab === 'All' || a.type === activeTab || (activeTab === 'AI Generated' && a.type === 'AI Generated Images')) &&
    a.name.toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (type) => {
    const Icon = TYPE_ICONS[type] || FileText;
    return Icon;
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Assets Library</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Store, organize, and access marketing assets</p>
        </div>
        <button className="mh-btn mh-btn-primary" onClick={() => toast.show('Opening upload dialog…', 'info')}>
          <Plus size={15} /> Upload Asset
        </button>
      </div>

      {/* Search + Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="mh-input" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assets…" style={{ paddingLeft: 32, width: '100%' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--mh-border)', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{
              padding: '10px 16px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer',
              borderBottom: `2px solid ${activeTab === t ? '#6366f1' : 'transparent'}`,
              color: activeTab === t ? '#6366f1' : '#6b7280', fontWeight: activeTab === t ? 600 : 400,
              transition: 'color 0.15s', whiteSpace: 'nowrap',
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 24px' }}>
          <ImageIcon size={36} style={{ color: '#d1d5db', margin: '0 auto 12px' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>No assets found</div>
          <div style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Try adjusting your filters or upload new assets.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
          {filtered.map(a => {
            const Icon = getIcon(a.type);
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, overflow: 'hidden', boxShadow: 'var(--mh-shadow-sm)', transition: 'box-shadow 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = 'var(--mh-shadow-md)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = 'var(--mh-shadow-sm)'}>
                {/* Thumbnail */}
                <div style={{ width: '100%', height: 140, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {a.url ? (
                    <img src={a.url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon size={36} style={{ color: '#d1d5db' }} />
                  )}
                </div>
                {/* Info */}
                <div style={{ padding: '14px' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.name}>{a.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: '#e0e7ff', color: '#3730a3' }}>{a.type}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{a.size}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>Modified {new Date(a.modified).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => toast.show(`Downloading ${a.name}`, 'success')}>
                      <Download size={12} /> Download
                    </button>
                    <button className="mh-btn mh-btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => toast.show(`Deleted ${a.name}`, 'info')}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
