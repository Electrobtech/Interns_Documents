'use client';
/**
 * Assets Library — real uploads at /ai-agents/marketing/assets.
 *
 * Previews use an object URL built from the authenticated download endpoint,
 * not a bare <img src>: the API needs a Bearer token, so a plain URL would
 * render a broken image.
 */
import { useEffect, useState } from 'react';
import {
  FolderOpen, Folder, Upload, Trash2, Plus, Loader2, Download,
  Image as ImageIcon, Video, FileText, Music, File, LayoutGrid, List, FolderPlus} from 'lucide-react';

import {
  useAssets, useAssetFolders, useCreateAssetFolder, useUploadAsset, useDeleteAsset, ASSET_TYPES,
} from '@/lib/queries/marketing';
import { getToken } from '@/lib/auth';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip, ViewSwitcher, SplitPane,
} from '../HubUI';
import { Modal, Field, Input, Select, SearchInput, ErrorNote, timeAgo } from './Shared';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const TYPE_ICON = {
  image: ImageIcon, video: Video, pdf: FileText, audio: Music,
  document: FileText, icon: ImageIcon, logo: ImageIcon,
};

function humanSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export default function AssetsLibrary() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [folderId, setFolderId] = useState('');
  const [folderOpen, setFolderOpen] = useState(false);
  const [view, setView] = useState('grid');

  const { data: folders = [] } = useAssetFolders();
  const { data: assets = [], isLoading } = useAssets({
    search: search || undefined,
    asset_type: typeFilter || undefined,
    folder_id: folderId || undefined,
  });

  const upload = useUploadAsset();
  const del = useDeleteAsset();

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    for (const file of files) {
      await upload.mutateAsync({ file, folder_id: folderId || undefined });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assets Library"
        subtitle="Images, video, and documents. Downloads are gated on a clean virus scan."
        count={assets.length}
      />

      <Toolbar
        right={
          <>
            <ToolSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets…" />
            <ViewSwitcher
              value={view}
              onChange={setView}
              views={[
                { id: 'grid', icon: LayoutGrid, label: 'Grid' },
                { id: 'list', icon: List, label: 'List' },
              ]}
            />
          </>
        }
      >
        <ToolButton icon={FolderPlus} onClick={() => setFolderOpen(true)}>New folder</ToolButton>
        <ToolButton icon={Upload} disabled title="Use the drop zone below to upload">Upload</ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Assets', value: assets.length, tone: 'violet' },
          { label: 'Folders', value: folders.length, tone: 'slate' },
          { label: 'Images', value: assets.filter((a) => a.asset_type === 'image').length, tone: 'blue' },
          { label: 'Video', value: assets.filter((a) => a.asset_type === 'video').length, tone: 'green' },
          { label: 'Documents', value: assets.filter((a) => ['pdf', 'document'].includes(a.asset_type)).length, tone: 'amber' },
          { label: 'Total size', value: Math.round(assets.reduce((s, a) => s + (a.byte_size || 0), 0) / 1048576), suffix: ' MB', tone: 'slate' },
        ]}
      />

      <Card className="p-4">
        <SectionTitle
          title="Assets Library"
          subtitle="Images, video, and documents used across campaigns. Max 25MB per file."
          action={
            <div className="flex items-center gap-2">
              <Button icon={Plus} onClick={() => setFolderOpen(true)}>New folder</Button>
              <label className="inline-flex">
                <input type="file" multiple className="hidden" onChange={onFiles} />
                <span
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white
                             shadow-sm cursor-pointer hover:opacity-90 transition-all"
                  style={{ background: 'linear-gradient(135deg, #E11D48 0%, #FB923C 100%)' }}
                >
                  {upload.isPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {upload.isPending ? 'Uploading…' : 'Upload'}
                </span>
              </label>
            </div>
          }
        />
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search assets…" />
          <div className="w-40">
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={ASSET_TYPES} placeholder="All types" />
          </div>
          <div className="w-44">
            <Select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              options={folders.map((f) => ({ value: f.id, label: f.name }))}
              placeholder="All folders"
            />
          </div>
        </div>
      </Card>

      <ErrorNote error={upload.error || del.error} />

      {folders.length > 0 && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setFolderId('')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] transition-all ${
                !folderId ? 'border-rose-300 bg-rose-50/50 text-rose-700' : 'border-[#E4E8F0] text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FolderOpen size={14} /> All
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => setFolderId(f.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[13px] transition-all ${
                  folderId === f.id ? 'border-rose-300 bg-rose-50/50 text-rose-700' : 'border-[#E4E8F0] text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Folder size={14} /> {f.name}
              </button>
            ))}
          </div>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-10 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></Card>
      ) : !assets.length ? (
        <Card className="p-5">
          <EmptyState
            icon={FolderOpen}
            title="No assets yet"
            body="Upload images, video, PDFs, or documents. Executables and unknown file types are rejected."
          />
        </Card>
      ) : (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {assets.map((a) => (
            <AssetCard key={a.id} asset={a} onDelete={() => del.mutate(a.id)} />
          ))}
        </div>
      )}

      <NewFolderModal open={folderOpen} onClose={() => setFolderOpen(false)} folders={folders} />
    </div>
  );
}

function AssetCard({ asset, onDelete }) {
  const [preview, setPreview] = useState(null);
  const isImage = asset.asset_type === 'image' || asset.asset_type === 'logo' || asset.asset_type === 'icon';
  const Icon = TYPE_ICON[asset.asset_type] || File;

  // The download endpoint requires a Bearer token, so fetch the bytes and
  // render them from an object URL rather than pointing <img> at the API.
  useEffect(() => {
    if (!isImage) return undefined;
    let url;
    let cancelled = false;
    fetch(`${API}/ai-agents/marketing/assets/${asset.id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setPreview(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [asset.id, isImage]);

  const download = async () => {
    const res = await fetch(`${API}/ai-agents/marketing/assets/${asset.id}/download`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = asset.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card hover className="overflow-hidden flex flex-col">
      <div className="aspect-[4/3] bg-slate-50 flex items-center justify-center overflow-hidden">
        {preview ? (
          <img src={preview} alt={asset.name} className="w-full h-full object-cover" />
        ) : (
          <Icon size={26} className="text-slate-300" />
        )}
      </div>
      <div className="p-3 flex-1 flex flex-col">
        <p className="text-[13px] font-medium text-[#0F1929] truncate">{asset.name}</p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <Badge tone="slate">{asset.asset_type}</Badge>
          <span className="text-[10px] text-slate-400">{humanSize(asset.byte_size)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-2.5 pt-2.5 border-t border-[#EEF1F6]">
          <span className="text-[10px] text-slate-400">{timeAgo(asset.created_at)}</span>
          <div className="flex items-center gap-1.5">
            <Button icon={Download} onClick={download} className="!px-2 !py-1.5" />
            <Button variant="danger" icon={Trash2} onClick={onDelete} className="!px-2 !py-1.5" />
          </div>
        </div>
      </div>
    </Card>
  );
}

function NewFolderModal({ open, onClose, folders }) {
  const create = useCreateAssetFolder();
  const [form, setForm] = useState({ name: '', parent_id: '' });

  const submit = async () => {
    await create.mutateAsync({ name: form.name.trim(), parent_id: form.parent_id || null });
    setForm({ name: '', parent_id: '' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New folder"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Brand kit" />
      </Field>
      <Field label="Parent folder">
        <Select
          value={form.parent_id}
          onChange={(e) => setForm((f) => ({ ...f, parent_id: e.target.value }))}
          options={folders.map((f) => ({ value: f.id, label: f.name }))}
          placeholder="Top level"
        />
      </Field>
    </Modal>
  );
}
