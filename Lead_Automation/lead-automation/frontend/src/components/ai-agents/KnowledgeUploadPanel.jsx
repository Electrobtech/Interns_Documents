'use client';
import { useRef, useState } from 'react';
import {
  Upload, FileText, CheckCircle2, XCircle, Loader2,
  Trash2, AlertTriangle, Database, File,
} from 'lucide-react';
import {
  useKnowledgeSources, useUploadKnowledge, useDeleteKnowledge,
} from '@/lib/queries/aiAgents';

const STATUS_META = {
  processing: { icon: Loader2,       cls: 'text-amber-500',  bg: 'bg-amber-50',   label: 'Processing', spin: true  },
  ready:      { icon: CheckCircle2,  cls: 'text-emerald-600',bg: 'bg-emerald-50', label: 'Ready',      spin: false },
  failed:     { icon: XCircle,       cls: 'text-red-500',    bg: 'bg-red-50',     label: 'Failed',     spin: false },
};

const AGENT_LABELS = { marketing: 'Marketing', sales: 'Sales', support: 'Support' };

export default function KnowledgeUploadPanel({ agentType }) {
  const { data, isLoading, isError, error } = useKnowledgeSources(agentType);
  const upload  = useUploadKnowledge(agentType);
  const del     = useDeleteKnowledge(agentType);
  const fileRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const sources = Array.isArray(data) ? data : [];

  const handleFile = (file) => {
    if (file) upload.mutate(file);
  };

  const onFileChange = (e) => {
    handleFile(e.target.files?.[0]);
    e.target.value = '';
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const agentLabel = AGENT_LABELS[agentType] || agentType;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
            <Database size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Knowledge Base</h4>
            <p className="text-[11px] text-slate-400">{agentLabel} agent source of truth</p>
          </div>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={upload.isPending}
          className="btn-primary btn-sm"
        >
          <Upload size={12} />
          {upload.isPending ? 'Uploading…' : 'Upload'}
        </button>
        <input
          ref={fileRef} type="file"
          accept=".pdf,.docx,.txt,.csv"
          className="hidden"
          onChange={onFileChange}
        />
      </div>

      {/* Error banners */}
      {upload.isError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl mb-3 text-xs text-red-600">
          <AlertTriangle size={12} className="shrink-0" /> {upload.error?.message}
        </div>
      )}
      {isError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-xl mb-3 text-xs text-red-600">
          <AlertTriangle size={12} className="shrink-0" /> {error?.message}
        </div>
      )}

      {/* Drop zone (shown only when empty) */}
      {!isLoading && sources.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`
            flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed cursor-pointer
            transition-all duration-150
            ${dragging
              ? 'border-blue-400 bg-blue-50/60'
              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'
            }
          `}
        >
          <div className="p-3 rounded-xl bg-slate-100">
            <Upload size={18} className="text-slate-400" />
          </div>
          <div className="text-center">
            <p className="text-xs font-semibold text-slate-600">
              {dragging ? 'Drop to upload' : 'Drop files here or click to browse'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">PDF, DOCX, TXT, CSV</p>
          </div>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-12 skeleton rounded-xl" />
          ))}
        </div>
      )}

      {/* Source list */}
      {!isLoading && sources.length > 0 && (
        <>
          <div className="space-y-1.5">
            {sources.map((s) => {
              const meta  = STATUS_META[s.status] || STATUS_META.processing;
              const Icon  = meta.icon;
              return (
                <div key={s.id}
                  className="group flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-slate-50 hover:bg-white hover:shadow-card border border-transparent hover:border-slate-200 transition-all duration-150">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`p-1.5 rounded-lg ${meta.bg} shrink-0`}>
                      <Icon size={12} className={`${meta.cls} ${meta.spin ? 'animate-spin' : ''}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{s.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {meta.label}
                        {s.chunk_count != null ? ` · ${s.chunk_count} chunks` : ''}
                        {s.version != null ? ` · v${s.version}` : ''}
                        {s.status === 'failed' && s.error_detail ? ` · ${s.error_detail}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => del.mutate(s.id)}
                    className="text-slate-300 hover:text-red-500 shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
          {/* Upload more */}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={upload.isPending}
            className="mt-3 w-full flex items-center justify-center gap-2 text-xs font-semibold text-blue-600
              py-2 rounded-xl border border-dashed border-blue-200 hover:border-blue-400 hover:bg-blue-50/40
              transition-all duration-150 disabled:opacity-50"
          >
            <Upload size={12} />
            {upload.isPending ? 'Uploading…' : 'Upload another document'}
          </button>
        </>
      )}

      {/* Summary footer */}
      {sources.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[10px] text-slate-400">
            {sources.length} document{sources.length > 1 ? 's' : ''} ·{' '}
            {sources.reduce((n, s) => n + (s.chunk_count || 0), 0)} chunks indexed
          </span>
          <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            RAG Ready
          </span>
        </div>
      )}
    </div>
  );
}
