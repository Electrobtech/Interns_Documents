'use client';
import { useRef, useState } from 'react';
import { Plus, Search, Download, Trash2, Image as ImageIcon, FileText, Video, FileArchive } from 'lucide-react';
import { useMHToast } from '../ui/MHToast';
import { EmptyState } from './_shared';
import {
  useMarketingAssets,
  useUploadMarketingAsset,
  useDeleteMarketingAsset,
} from '@/lib/queries/marketingHub';

const TABS = ['All', 'Images', 'Videos', 'PDFs', 'Logos', 'AI Generated'];

const TYPE_ICONS = {
  Images: ImageIcon,
  Videos: Video,
  PDFs: FileText,
  Logos: FileArchive,
  'AI Generated Images': ImageIcon,
};

function formatBytes(n) {
  if (n == null || Number.isNaN(Number(n))) return '-';
  const bytes = Number(n);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function isImageType(type, mime) {
  if (type === 'Images' || type === 'Logos' || type === 'AI Generated Images') return true;
  return Boolean(mime && mime.startsWith('image/'));
}

export default function MHAssetsLibrary() {
  const toast = useMHToast();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');

  const { data: assets = [], isLoading, isError } = useMarketingAssets(activeTab);
  const uploadMutation = useUploadMarketingAsset();
  const deleteMutation = useDeleteMarketingAsset();

  const filtered = (Array.isArray(assets) ? assets : []).filter((a) =>
    (a.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const getIcon = (type) => TYPE_ICONS[type] || FileText;

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    if (activeTab === 'Logos') formData.append('type', 'Logos');
    else if (activeTab === 'AI Generated') formData.append('type', 'AI Generated Images');

    try {
      await uploadMutation.mutateAsync(formData);
      toast.show('Uploaded ' + file.name, 'success');
    } catch (err) {
      toast.show(err?.message || 'Upload failed', 'error');
    }
  };

  const handleDelete = async (asset) => {
    try {
      await deleteMutation.mutateAsync(asset.id);
      toast.show('Deleted ' + asset.name, 'info');
    } catch (err) {
      toast.show(err?.message || 'Delete failed', 'error');
    }
  };

  const handleDownload = (asset) => {
    if (!asset.storage_url) {
      toast.show('No download URL available', 'error');
      return;
    }
    window.open(asset.storage_url, '_blank', 'noopener,noreferrer');
    toast.show('Opening ' + asset.name, 'success');
  };

  return (
    <div style={{ padding: '24px 28px', background: 'var(--mh-bg)', minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--mh-font-display)', fontSize: 22, fontWeight: 700, color: 'var(--mh-text)', margin: 0 }}>Assets Library</h1>
          <p style={{ fontSize: 13, color: 'var(--mh-text-3)', marginTop: 4 }}>Store, organize, and access marketing assets</p>
        </div>
        <button
          className="mh-btn mh-btn-primary"
          onClick={handleUploadClick}
          disabled={uploadMutation.isPending}
        >
          <Plus size={15} /> {uploadMutation.isPending ? 'Uploading...' : 'Upload Asset'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/mp4,video/webm,video/quicktime,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            className="mh-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets..."
            style={{ paddingLeft: 32, width: '100%' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              className={`mh-btn ${activeTab === tab ? 'mh-btn-primary' : 'mh-btn-ghost'}`}
              style={{ fontSize: 12, padding: '6px 12px' }}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#6b7280' }}>Loading assets...</div>
      )}

      {isError && !isLoading && (
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: '#b91c1c' }}>
          Failed to load assets. Check that marketing-hub-service is running.
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <EmptyState
          icon={ImageIcon}
          title="No assets found"
          desc={search ? 'Try adjusting your filters or search.' : 'Upload your first logo, image, video, or PDF to get started.'}
          action={
            <button className="mh-btn mh-btn-primary" onClick={handleUploadClick}>
              <Plus size={15} /> Upload Asset
            </button>
          }
        />
      )}

      {!isLoading && !isError && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          {filtered.map((a) => {
            const Icon = getIcon(a.type);
            const showThumb = isImageType(a.type, a.mime_type) && a.storage_url;
            const modified = a.updated_at || a.created_at;
            return (
              <div
                key={a.id}
                style={{
                  background: '#fff',
                  border: '1px solid var(--mh-border)',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: 'var(--mh-shadow-sm)',
                }}
              >
                <div
                  style={{
                    height: 140,
                    background: '#f3f4f6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  {showThumb ? (
                    <img src={a.storage_url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Icon size={36} style={{ color: '#d1d5db' }} />
                  )}
                </div>
                <div style={{ padding: '14px' }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#111827',
                      marginBottom: 6,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={a.name}
                  >
                    {a.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 7px',
                        borderRadius: 99,
                        background: '#e0e7ff',
                        color: '#3730a3',
                      }}
                    >
                      {a.type}
                    </span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatBytes(a.size_bytes)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>
                    {modified
                      ? 'Modified ' +
                        new Date(modified).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })
                      : ''}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="mh-btn mh-btn-ghost"
                      style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
                      onClick={() => handleDownload(a)}
                    >
                      <Download size={12} /> Download
                    </button>
                    <button
                      className="mh-btn mh-btn-ghost"
                      style={{ padding: '4px 10px', fontSize: 11 }}
                      onClick={() => handleDelete(a)}
                      disabled={deleteMutation.isPending}
                    >
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
