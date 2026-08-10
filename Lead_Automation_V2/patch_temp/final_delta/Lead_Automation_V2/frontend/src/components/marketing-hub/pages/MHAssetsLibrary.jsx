'use client';
import { useRef, useState } from 'react';
import { Plus, Search, Download, Eye, FileText, Image as ImageIcon, Video, Music, Trash2, Upload as UploadIcon } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { useAssets, useUploadAsset, useDeleteAsset, useAssetStats } from '@/lib/queries/marketingHub';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const TYPE_ICON = { image: ImageIcon, video: Video, audio: Music, document: FileText, template: FileText };
const TYPE_COLOR = { image: '#10b981', video: '#6366f1', audio: '#f59e0b', document: '#3b82f6', template: '#a855f7' };

function fmtSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MHAssetsLibrary() {
  const toast = useMHToast();
  const [search, setSearch] = useState('');
  const [type, setType] = useState('All');
  const fileInputRef = useRef(null);

  const { data: assets = [], isLoading } = useAssets({ search: search || undefined, type: type === 'All' ? undefined : type });
  const { data: stats } = useAssetStats();
  const uploadAsset = useUploadAsset();
  const deleteAsset = useDeleteAsset();

  const handleFilePicked = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    try {
      await uploadAsset.mutateAsync(formData);
      toast.show(`Uploaded ${file.name}`, 'success');
    } catch (err) {
      toast.show(err.message || 'Upload failed', 'error');
    }
  };

  // Files are served with an Authorization header (routes/assets.js's
  // GET /:id/file), so a plain <a href> won't carry the token — fetch as a
  // blob and trigger the download client-side instead.
  const openAsset = async (asset, mode) => {
    try {
      const resp = await fetch(`${API_BASE}/marketing-hub/assets/${asset.id}/file`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!resp.ok) throw new Error(resp.status === 404 ? 'File not found on disk — this looks like seeded demo data with no real file behind it yet.' : `Failed (${resp.status})`);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      if (mode === 'view') {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url; a.download = asset.name;
        document.body.appendChild(a); a.click(); a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (err) {
      toast.show(err.message || 'Could not open file', 'error');
    }
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Assets Library</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>
            {stats ? `${stats.total} files · ${fmtSize(stats.total_size)} total` : 'Real files, stored on disk and tracked in Postgres'}
          </p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFilePicked} />
          <button className="mh-btn mh-btn-primary" onClick={() => fileInputRef.current?.click()} disabled={uploadAsset.isPending}>
            {uploadAsset.isPending ? <>Uploading…</> : <><UploadIcon size={15} /> Upload Asset</>}
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input className="mh-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets…" style={{ paddingLeft: 32, width: '100%' }} />
        </div>
        <select className="mh-input" value={type} onChange={(e) => setType(e.target.value)}>
          {['All', 'image', 'video', 'document', 'audio', 'template'].map((t) => <option key={t} value={t}>{t === 'All' ? 'All Types' : t}</option>)}
        </select>
      </div>

      {isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading…</div>}

      {!isLoading && assets.length === 0 && (
        <div style={{ background: '#fff', border: '1px dashed #e5e7eb', borderRadius: 14, padding: '48px 24px', textAlign: 'center' }}>
          <UploadIcon size={28} style={{ color: '#d1d5db', margin: '0 auto 10px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No assets yet</div>
          <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>Upload your first file to get started.</p>
        </div>
      )}

      {!isLoading && assets.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {assets.map((a) => {
            const Icon = TYPE_ICON[a.type] || FileText;
            const color = TYPE_COLOR[a.type] || '#6b7280';
            return (
              <div key={a.id} style={{ background: '#fff', border: '1px solid var(--mh-border)', borderRadius: 14, padding: 16, boxShadow: 'var(--mh-shadow-sm)' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Icon size={18} style={{ color }} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>{fmtSize(a.file_size)} · {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
                {a.tags?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                    {a.tags.slice(0, 3).map((t) => (
                      <span key={t} style={{ fontSize: 10, color: '#6366f1', background: '#eef2ff', padding: '2px 7px', borderRadius: 99 }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => openAsset(a, 'view')}><Eye size={12} /> View</button>
                  <button className="mh-btn mh-btn-ghost" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }} onClick={() => openAsset(a, 'download')}><Download size={12} /></button>
                  <button className="mh-btn mh-btn-ghost" style={{ fontSize: 11, color: '#dc2626' }}
                    onClick={() => deleteAsset.mutate(a.id, { onSuccess: () => toast.show('Deleted', 'success') })}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
