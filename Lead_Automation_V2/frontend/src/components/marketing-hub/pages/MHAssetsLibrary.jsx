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

const TABS = ['All', 'Images', 'Videos', 'Documents', 'Audio', 'Templates'];

const TYPE_ICONS = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: FileArchive,
  template: FileArchive,
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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  const getTypeLabel = (type) => {
    return TYPE_LABELS[type] || type;
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const validFiles = Array.from(files).filter(file => {
      if (file.size > MAX_FILE_SIZE) {
        toast.show(`${file.name} exceeds 300MB limit`, 'error');
        return false;
      }
      return true;
    });
    
    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.show('Please select files to upload', 'error');
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        await uploadAsset.mutateAsync(file);
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      }

      setUploading(false);
      setUploadProgress(0);
      setSelectedFiles([]);
      setShowUploadModal(false);
      toast.show(`Successfully uploaded ${selectedFiles.length} file(s)`, 'success');
    } catch (error) {
      console.error('Upload failed:', error);
      setUploading(false);
      setUploadProgress(0);
      toast.show('Failed to upload files', 'error');
    }
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

      {/* Upload Modal */}
      {showUploadModal && (
        <MHModal title="Upload Assets" onClose={() => setShowUploadModal(false)} width={600}>
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${dragActive ? '#6366f1' : '#d1d5db'}`,
              borderRadius: 12,
              padding: '40px 24px',
              textAlign: 'center',
              background: dragActive ? '#eef2ff' : '#f9fafb',
              cursor: 'pointer',
              transition: 'all 0.2s',
              marginBottom: 20
            }}
            onClick={() => document.getElementById('file-input').click()}
          >
            <Upload size={48} style={{ color: dragActive ? '#6366f1' : '#9ca3af', marginBottom: 16 }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
              {dragActive ? 'Drop files here' : 'Drag & drop files here'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              or click to browse (Max 300MB per file)
            </div>
            <input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="image/*,video/*,.pdf,.doc,.docx,.zip"
            />
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 12 }}>
                Selected Files ({selectedFiles.length})
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto', background: '#f9fafb', borderRadius: 8, padding: 12 }}>
                {selectedFiles.map((file, index) => (
                  <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                    <FileIcon size={16} style={{ color: '#6b7280', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatFileSize(file.size)}</div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4, borderRadius: 4 }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 6 }}>
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#6366f1', transition: 'width 0.3s', width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              className="mh-btn mh-btn-ghost"
              onClick={() => {
                setShowUploadModal(false);
                setSelectedFiles([]);
                setUploadProgress(0);
              }}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              className="mh-btn mh-btn-primary"
              onClick={handleUpload}
              disabled={uploading || selectedFiles.length === 0}
              style={{ opacity: uploading || selectedFiles.length === 0 ? 0.5 : 1 }}
            >
              {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} File${selectedFiles.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </MHModal>
      )}
    </div>
  );
}