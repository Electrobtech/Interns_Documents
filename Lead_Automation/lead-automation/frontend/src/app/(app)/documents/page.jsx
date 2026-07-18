'use client';
import { useMemo, useRef, useState } from 'react';
import {
  FileText, Database, Loader2, CheckCircle2, XCircle, Upload,
  Trash2, RefreshCw, Megaphone, TrendingUp, Headphones, X,
  AlertTriangle, Eye,
} from 'lucide-react';
import {
  useKnowledgeSources, useUploadKnowledge, useDeleteKnowledge, useReindexKnowledge,
} from '@/lib/queries/aiAgents';

const AGENT_CFG = {
  marketing: { label: 'Marketing', icon: Megaphone,  tone: 'text-blue-600 bg-blue-50'       },
  sales:     { label: 'Sales',     icon: TrendingUp,  tone: 'text-emerald-600 bg-emerald-50' },
  support:   { label: 'Support',   icon: Headphones,  tone: 'text-violet-600 bg-violet-50'   },
};
const AGENT_TYPES = Object.keys(AGENT_CFG);

const STATUS_META = {
  processing: { icon: Loader2,      text: 'text-amber-500',   bg: 'bg-amber-50',   label: 'Processing', spin: true  },
  ready:      { icon: CheckCircle2, text: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Ready',      spin: false },
  failed:     { icon: XCircle,      text: 'text-red-500',     bg: 'bg-red-50',     label: 'Failed',     spin: false },
};

const SOURCE_TYPES = ['all', 'pdf', 'docx', 'txt', 'csv', 'md', 'note', 'web'];

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Merges the three per-agent-type knowledge queries into one list — the
// backend has no "list across all agent types" endpoint, but each row
// already carries its own agent_type field, so a client-side merge is
// enough (no new backend query needed).
function useAllKnowledgeSources() {
  const marketing = useKnowledgeSources('marketing');
  const sales = useKnowledgeSources('sales');
  const support = useKnowledgeSources('support');

  const sources = useMemo(() => [
    ...(Array.isArray(marketing.data) ? marketing.data : []),
    ...(Array.isArray(sales.data) ? sales.data : []),
    ...(Array.isArray(support.data) ? support.data : []),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)), [marketing.data, sales.data, support.data]);

  return {
    sources,
    isLoading: marketing.isLoading || sales.isLoading || support.isLoading,
    isError: marketing.isError || sales.isError || support.isError,
  };
}

function StatCard({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
      <div className="flex items-center gap-2.5 mb-2">
        <div className={`p-2 rounded-xl ${tone}`}><Icon size={14} /></div>
      </div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-slate-800 mt-0.5 tabular-nums">{value}</p>
    </div>
  );
}

/* ─── right column: upload form (idle state) ────────────── */
function UploadPanel() {
  const [agentType, setAgentType] = useState('marketing');
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const upload = useUploadKnowledge(agentType);

  const doUpload = (file) => {
    if (!file) return;
    upload.mutate(file);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600">
          <Upload size={15} />
        </div>
        <div>
          <h4 className="font-bold text-slate-800 text-sm">Upload Source</h4>
          <p className="text-[11px] text-slate-400">Add a document to an agent's knowledge base</p>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Agent</label>
      <select value={agentType} onChange={(e) => setAgentType(e.target.value)} className="input-premium mb-4">
        {AGENT_TYPES.map((t) => <option key={t} value={t}>{AGENT_CFG[t].label} Agent</option>)}
      </select>

      {upload.isError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mb-3">
          <AlertTriangle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{upload.error?.message}</p>
        </div>
      )}

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); doUpload(e.dataTransfer.files?.[0]); }}
        className={`
          flex flex-col items-center justify-center gap-2 py-10 rounded-xl border-2 border-dashed cursor-pointer
          transition-all duration-150
          ${dragging ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50/60'}
        `}
      >
        <div className="p-3 rounded-xl bg-slate-100">
          {upload.isPending ? <Loader2 size={18} className="text-slate-400 animate-spin" /> : <Upload size={18} className="text-slate-400" />}
        </div>
        <p className="text-xs font-semibold text-slate-600">
          {upload.isPending ? 'Uploading…' : 'Drop a file here or click to browse'}
        </p>
        <p className="text-[10px] text-slate-400">PDF, DOCX, TXT, CSV</p>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv"
          className="hidden"
          onChange={(e) => doUpload(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

/* ─── right column: detail panel (selected state) ───────── */
function DetailPanel({ source, onClose }) {
  const cfg = AGENT_CFG[source.agent_type] || {};
  const st = STATUS_META[source.status] || STATUS_META.processing;
  const StIcon = st.icon;
  const reindexInputRef = useRef(null);

  const del = useDeleteKnowledge(source.agent_type);
  const reindex = useReindexKnowledge(source.agent_type);

  const handleDelete = () => {
    if (!confirm(`Delete "${source.name}"? This removes it from the knowledge base.`)) return;
    del.mutate(source.id, { onSuccess: onClose });
  };

  const handleReprocessFile = (file) => {
    if (!file) return;
    reindex.mutate({ id: source.id, file });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-xl shrink-0 ${st.bg}`}>
            <StIcon size={15} className={`${st.text} ${st.spin ? 'animate-spin' : ''}`} />
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-slate-800 text-sm truncate">{source.name}</h4>
            <p className="text-[11px] text-slate-400">{st.label}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors shrink-0">
          <X size={15} />
        </button>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

      {source.status === 'failed' && source.error_detail && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mb-4">
          <AlertTriangle size={13} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-600">{source.error_detail}</p>
        </div>
      )}

      {/* metadata */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Agent</p>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full mt-1 ${cfg.tone}`}>
            {cfg.icon && <cfg.icon size={11} />} {cfg.label}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Type</p>
          <p className="text-xs font-semibold text-slate-700 mt-1.5 uppercase">{source.source_type}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Chunks</p>
          <p className="text-xs font-semibold text-slate-700 mt-1.5 tabular-nums">{source.chunk_count}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Version</p>
          <p className="text-xs font-semibold text-slate-700 mt-1.5 tabular-nums">v{source.version}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Created</p>
          <p className="text-xs text-slate-600 mt-1.5">{fmtDate(source.created_at)}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Updated</p>
          <p className="text-xs text-slate-600 mt-1.5">{fmtDate(source.updated_at)}</p>
        </div>
      </div>

      {reindex.isError && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl mb-3">
          <AlertTriangle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{reindex.error?.message}</p>
        </div>
      )}

      {/* actions */}
      <div className="flex gap-2">
        <button
          onClick={() => reindexInputRef.current?.click()}
          disabled={reindex.isPending}
          className="btn-ghost btn-sm flex-1"
        >
          <RefreshCw size={12} className={reindex.isPending ? 'animate-spin' : ''} />
          {reindex.isPending ? 'Reprocessing…' : 'Reprocess'}
        </button>
        <button
          onClick={handleDelete}
          disabled={del.isPending}
          className="btn-ghost btn-sm text-red-500 hover:bg-red-50 flex-1"
        >
          <Trash2 size={12} /> Delete
        </button>
        <input
          ref={reindexInputRef}
          type="file"
          accept=".pdf,.docx,.txt,.csv"
          className="hidden"
          onChange={(e) => handleReprocessFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

/* ─── page ───────────────────────────────────────────────── */
export default function DocumentsPage() {
  const { sources, isLoading, isError } = useAllKnowledgeSources();
  const [agentFilter, setAgentFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);

  const filtered = useMemo(() => sources.filter((s) => {
    if (agentFilter !== 'all' && s.agent_type !== agentFilter) return false;
    if (typeFilter !== 'all' && s.source_type !== typeFilter) return false;
    return true;
  }), [sources, agentFilter, typeFilter]);

  const stats = useMemo(() => ({
    total: sources.length,
    chunks: sources.reduce((sum, s) => sum + (s.chunk_count || 0), 0),
    processing: sources.filter((s) => s.status === 'processing').length,
    failed: sources.filter((s) => s.status === 'failed').length,
  }), [sources]);

  const selected = sources.find((s) => s.id === selectedId) || null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600 shadow-sm">
            <FileText size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Documents & Knowledge</h1>
            <p className="text-xs text-slate-400 mt-0.5">Source of truth for Marketing, Sales & Support agents via RAG</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* LEFT column */}
        <div className="lg:col-span-2 space-y-4">

          {/* summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={FileText} label="Sources" value={stats.total} tone="bg-gradient-to-br from-blue-50 to-indigo-100 text-blue-600" />
            <StatCard icon={Database} label="Chunks" value={stats.chunks} tone="bg-gradient-to-br from-emerald-50 to-teal-100 text-emerald-600" />
            <StatCard icon={Loader2} label="Processing" value={stats.processing} tone="bg-gradient-to-br from-amber-50 to-orange-100 text-amber-600" />
            <StatCard icon={XCircle} label="Failed" value={stats.failed} tone="bg-gradient-to-br from-red-50 to-rose-100 text-red-600" />
          </div>

          {/* filter strip */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              {['all', ...AGENT_TYPES].map((t) => (
                <button
                  key={t}
                  onClick={() => setAgentFilter(t)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                    agentFilter === t
                      ? 'bg-white shadow-sm text-slate-800 border border-slate-200/80'
                      : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {t === 'all' ? 'All' : AGENT_CFG[t].label}
                </button>
              ))}
            </div>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-premium text-xs w-32">
              {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t === 'all' ? 'All Types' : t.toUpperCase()}</option>)}
            </select>
          </div>

          {/* source table */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            {isLoading && (
              <div className="p-5 space-y-3">
                {[0, 1, 2].map((i) => <div key={i} className="h-10 w-full skeleton rounded-lg" />)}
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 m-4 rounded-2xl">
                <AlertTriangle size={16} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">Failed to load knowledge sources.</p>
              </div>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 mb-3">
                  <FileText size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">No documents match this filter</p>
                <p className="text-xs text-slate-300 mt-1">Upload a source from the panel on the right</p>
              </div>
            )}

            {!isLoading && !isError && filtered.length > 0 && (
              <table className="table-premium w-full">
                <thead>
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Chunks</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const cfg = AGENT_CFG[s.agent_type] || {};
                    const st = STATUS_META[s.status] || STATUS_META.processing;
                    const StIcon = st.icon;
                    return (
                      <tr key={s.id} className={`cursor-pointer ${selectedId === s.id ? 'bg-blue-50/50' : ''}`} onClick={() => setSelectedId(s.id)}>
                        <td className="px-4 py-3 min-w-0 max-w-[220px]">
                          <p className="text-sm font-semibold text-slate-800 truncate">{s.name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-full ${cfg.tone}`}>
                            {cfg.icon && <cfg.icon size={10} />} {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 uppercase">{s.source_type}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${st.bg} ${st.text}`}>
                            <StIcon size={10} className={st.spin ? 'animate-spin' : ''} /> {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">{s.chunk_count}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">{fmtDate(s.updated_at)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedId(s.id); }}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 transition-all"
                            title="View"
                          >
                            <Eye size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT column */}
        <div className="lg:col-span-1 lg:sticky lg:top-6">
          {selected ? (
            <DetailPanel source={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <UploadPanel />
          )}
        </div>
      </div>
    </div>
  );
}
