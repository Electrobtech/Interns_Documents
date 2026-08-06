'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutTemplate, Plus, Search, X, ChevronDown, ChevronRight,
  CheckCircle2, Clock, XCircle, AlertTriangle, Image as ImageIcon,
  MessageCircle, Smartphone, Mail, Radio,
} from 'lucide-react';
import { useTemplates } from '@/lib/queries/templates';

// Template Dashboard — sidebar: Automation > Templates. Grid of saved
// message templates with status badges; each card opens the Template
// Detail view (frontend/src/app/app/campaigns/templates/[id]/page.jsx),
// which matches the target screenshot's detail panel + live preview.
// Creation happens on its own route (./new) using the shared
// TemplateEditor form (components/campaigns/templates/TemplateEditor.jsx).

const STATUS_CFG = {
  APPROVED: { label: 'Approved', Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700' },
  PENDING:  { label: 'Pending',  Icon: Clock,         bg: 'bg-amber-50',   text: 'text-amber-700'   },
  REJECTED: { label: 'Rejected', Icon: XCircle,       bg: 'bg-red-50',     text: 'text-red-700'     },
};

const CHANNEL_ICON = {
  WHATSAPP: MessageCircle, RCS: Smartphone, SMS: Smartphone, EMAIL: Mail,
};

const ALL_CHANNELS = ['all', 'WHATSAPP', 'RCS', 'SMS', 'EMAIL'];
const ALL_STATUSES = ['all', 'APPROVED', 'PENDING', 'REJECTED'];

function StatusBadge({ status }) {
  const st = STATUS_CFG[status] || STATUS_CFG.PENDING;
  const { Icon } = st;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${st.bg} ${st.text}`}>
      <Icon size={11} /> {st.label}
    </span>
  );
}

function TemplateCard({ t }) {
  const ChannelIcon = CHANNEL_ICON[t.channels?.[0]] || Radio;
  return (
    <Link href={`/app/campaigns/templates/${t.id}`}
      className="group bg-white rounded-2xl border border-slate-100 shadow-card hover:shadow-card-lg hover:border-violet-200 transition-all overflow-hidden flex flex-col">
      <div className="h-28 bg-slate-50 flex items-center justify-center overflow-hidden">
        {t.header_type === 'IMAGE' && t.header_media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={t.header_media_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon size={22} className="text-slate-200" />
        )}
      </div>
      <div className="p-4 space-y-2 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-bold text-slate-800 truncate">{t.name}</p>
          <StatusBadge status={t.status} />
        </div>
        <p className="text-xs text-slate-400 line-clamp-2 flex-1">{t.body || 'No body text'}</p>
        <div className="flex items-center justify-between pt-1">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500">
            <ChannelIcon size={11} /> {(t.channels || []).join(', ') || '—'}
          </span>
          <ChevronRight size={13} className="text-slate-300 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
        </div>
      </div>
    </Link>
  );
}

export default function TemplatesPage() {
  const [search, setSearch] = useState('');
  const [channel, setChannel] = useState('all');
  const [status, setStatus] = useState('all');

  const { data, isLoading, isError } = useTemplates({
    channel: channel === 'all' ? undefined : channel,
    status: status === 'all' ? undefined : status,
    search: search || undefined,
  });
  const templates = data || [];
  const hasFilters = channel !== 'all' || status !== 'all' || !!search;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <LayoutTemplate size={20} className="text-brand" />
          <h2 className="text-lg font-bold">Templates</h2>
        </div>
        <Link href="/app/campaigns/templates/new" className="btn-primary btn-sm">
          <Plus size={13} /> New Template
        </Link>
      </div>

      {/* toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="input-premium pl-9 w-full" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={14} />
            </button>
          )}
        </div>

        {[
          { value: channel, onChange: setChannel, options: ALL_CHANNELS,
            label: (v) => v === 'all' ? 'All Channels' : v },
          { value: status, onChange: setStatus, options: ALL_STATUSES,
            label: (v) => v === 'all' ? 'All Statuses' : (STATUS_CFG[v]?.label || v) },
        ].map(({ value, onChange, options, label }, i) => (
          <div key={i} className="relative">
            <select
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="input-premium pr-8 text-xs appearance-none cursor-pointer min-w-[120px]"
            >
              {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        ))}

        {hasFilters && (
          <button
            onClick={() => { setChannel('all'); setStatus('all'); setSearch(''); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-red-500 transition-colors px-2 py-2"
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-52 w-full skeleton rounded-2xl" />)}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Failed to load templates. Please try again.</p>
        </div>
      )}

      {!isLoading && !isError && templates.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col items-center justify-center py-20 text-center">
          <div className="p-5 rounded-2xl bg-slate-50 mb-4">
            <LayoutTemplate size={28} className="text-slate-300" />
          </div>
          <p className="text-sm font-semibold text-slate-400">
            {hasFilters ? 'No templates match your filters' : 'No templates yet'}
          </p>
          <p className="text-xs text-slate-300 mt-1 max-w-sm mx-auto">
            {hasFilters ? 'Adjust your filters or create a new template.' : 'Reusable WhatsApp / RCS / SMS / Email templates you build here show up in the Broadcast builder once approved.'}
          </p>
          <Link href="/app/campaigns/templates/new" className="btn-primary mt-5 btn-sm">
            <Plus size={13} /> New Template
          </Link>
        </div>
      )}

      {!isLoading && templates.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((t) => <TemplateCard key={t.id} t={t} />)}
        </div>
      )}
    </div>
  );
}