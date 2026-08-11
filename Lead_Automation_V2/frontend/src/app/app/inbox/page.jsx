'use client';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Inbox, Search, X, Send, User, Loader2, AlertTriangle, Bot, UserCheck,
  Mail, Phone, Tag, Clock, Globe, MessageCircle, Instagram, MessageSquare,
  Smartphone, Linkedin, ExternalLink, Sparkles, ChevronRight, Copy,
  GripVertical, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useConversation, useSendReply, useConversationChannelCounts } from '@/lib/queries/crm';
import { useSocketEvent } from '@/lib/socket';
import SuggestedReplyCard from '@/components/ai-agents/inbox/SuggestedReplyCard';

/* ── channel config, keyed on channel_type — every channel the account can
   connect (Sidebar's CHANNELS nav list), not just ones with conversations
   today, so the filter bar stays stable as new channels get connected. ── */
const CHANNELS = {
  whatsapp:  { label: 'WhatsApp',  Icon: MessageCircle, tone: 'text-emerald-600 bg-emerald-50', ring: 'ring-emerald-200', dot: 'bg-emerald-500', chipActive: 'border-emerald-300 bg-emerald-100 text-emerald-700', chipCount: 'bg-emerald-200 text-emerald-700' },
  instagram: { label: 'Instagram', Icon: Instagram,     tone: 'text-pink-600 bg-pink-50',       ring: 'ring-pink-200',    dot: 'bg-pink-500',    chipActive: 'border-pink-300 bg-pink-100 text-pink-700',       chipCount: 'bg-pink-200 text-pink-700' },
  messenger: { label: 'Facebook',  Icon: MessageSquare, tone: 'text-blue-600 bg-blue-50',       ring: 'ring-blue-200',    dot: 'bg-blue-500',    chipActive: 'border-blue-300 bg-blue-100 text-blue-700',       chipCount: 'bg-blue-200 text-blue-700' },
  email:     { label: 'Email',     Icon: Mail,          tone: 'text-violet-600 bg-violet-50',   ring: 'ring-violet-200',  dot: 'bg-violet-500',  chipActive: 'border-violet-300 bg-violet-100 text-violet-700', chipCount: 'bg-violet-200 text-violet-700' },
  sms:       { label: 'SMS',       Icon: Smartphone,    tone: 'text-amber-600 bg-amber-50',     ring: 'ring-amber-200',   dot: 'bg-amber-500',   chipActive: 'border-amber-300 bg-amber-100 text-amber-700',   chipCount: 'bg-amber-200 text-amber-700' },
  webchat:   { label: 'Web chat',  Icon: Globe,         tone: 'text-sky-600 bg-sky-50',         ring: 'ring-sky-200',     dot: 'bg-sky-500',     chipActive: 'border-sky-300 bg-sky-100 text-sky-700',         chipCount: 'bg-sky-200 text-sky-700' },
  linkedin:  { label: 'LinkedIn',  Icon: Linkedin,      tone: 'text-blue-700 bg-blue-50',       ring: 'ring-blue-200',    dot: 'bg-blue-700',    chipActive: 'border-blue-400 bg-blue-100 text-blue-800',       chipCount: 'bg-blue-200 text-blue-800' },
  voice:     { label: 'Voice',     Icon: Phone,         tone: 'text-orange-600 bg-orange-50',   ring: 'ring-orange-200',  dot: 'bg-orange-500',  chipActive: 'border-orange-300 bg-orange-100 text-orange-700', chipCount: 'bg-orange-200 text-orange-700' },
};
// Fixed display order for the filter bar — independent of which channels
// happen to have conversations right now.
const CHANNEL_ORDER = ['whatsapp', 'instagram', 'messenger', 'email', 'sms', 'webchat', 'linkedin', 'voice'];
const channelCfg = (t) => CHANNELS[t] || { label: t || 'Unknown', Icon: MessageSquare, tone: 'text-slate-500 bg-slate-100', ring: 'ring-slate-200', dot: 'bg-slate-400', chipActive: 'border-slate-300 bg-slate-100 text-slate-700', chipCount: 'bg-slate-200 text-slate-600' };

const STATUS_CFG = {
  open:     'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending:  'bg-amber-50 text-amber-700 border-amber-200',
  missed:   'bg-red-50 text-red-700 border-red-200',
  handoff:  'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
  campaign: 'bg-violet-50 text-violet-700 border-violet-200',
  resolved: 'bg-slate-100 text-slate-500 border-slate-200',
  closed:   'bg-slate-100 text-slate-400 border-slate-200',
};

function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const initials = (name) => (name || '?')
  .split(' ').filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

/* ── Resizable sidebar hook ── */
const MIN_WIDTH = 220;
const MAX_WIDTH = 520;
const STORAGE_KEY = 'inbox_sidebar_width';

function useResizableSidebar(defaultWidth = 300) {
  const storedWidth = typeof window !== 'undefined'
    ? parseInt(localStorage.getItem(STORAGE_KEY) || String(defaultWidth), 10)
    : defaultWidth;
  const [width, setWidth] = useState(storedWidth);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);

  const onMouseDown = useCallback((e) => {
    dragging.current = true;
    startX.current = e.clientX;
    startW.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW.current + delta));
      setWidth(newW);
    };
    const onUp = () => {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      setWidth((w) => {
        localStorage.setItem(STORAGE_KEY, String(w));
        return w;
      });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return { width, onMouseDown };
}

/* ── Skeleton shimmer card ── */
function SkeletonCard() {
  return (
    <div className="flex items-start gap-2.5 px-3 py-3 border-b border-slate-50">
      <div className="skeleton h-9 w-9 rounded-full shrink-0 mt-0.5" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="flex justify-between">
          <div className="skeleton h-3 rounded-full w-28" />
          <div className="skeleton h-2.5 rounded-full w-10" />
        </div>
        <div className="skeleton h-2.5 rounded-full w-full" />
        <div className="flex gap-1.5">
          <div className="skeleton h-4 rounded-full w-14" />
          <div className="skeleton h-4 rounded-full w-10" />
        </div>
      </div>
    </div>
  );
}

/* ── Channel filter chip — sized as a real touch target (min ~40px tall,
   generous horizontal padding), not a tiny 10px pill. ── */
function FilterChip({ active, onClick, label, Icon, count, cfg }) {
  const activeClass = cfg ? cfg.chipActive : 'border-violet-300 bg-violet-100 text-violet-700';
  const activeCount = cfg ? cfg.chipCount : 'bg-violet-200 text-violet-700';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-bold transition-all duration-150 ${
        active
          ? activeClass
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {Icon && <Icon className="h-3.5 w-3.5" />}
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold transition-all ${active ? activeCount : 'bg-slate-100 text-slate-400'}`}>
        {count}
      </span>
    </button>
  );
}

/* ── Main page (inside Suspense) ── */
function InboxPageInner() {
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [channelF, setChannelF] = useState(() => searchParams.get('channel') || '');
  // Server-side channel filter — tapping a chip fetches that channel's own
  // conversations directly, instead of filtering the (possibly channel-100-
  // capped) "all" page client-side, which could show a channel as empty
  // even when it genuinely has conversations further back than the cap.
  const { data, isLoading, refetch, isFetching } = useConversations(channelF || undefined);
  const { data: counts } = useConversationChannelCounts();
  const { width, onMouseDown } = useResizableSidebar(300);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  useSocketEvent('conversation:updated', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
    setLastRefreshed(new Date());
  }, [qc]);

  const all = Array.isArray(data) ? data : [];
  const byChannel = counts?.byChannel || {};
  const totalCount = counts?.total ?? all.length;

  // Always show every channel the account can connect (fixed order), plus
  // any channel_type present in the real counts that isn't in that list (so
  // a custom/future channel type still gets a chip instead of disappearing).
  const presentChannels = useMemo(() => {
    const extra = Object.keys(byChannel).filter((t) => !CHANNEL_ORDER.includes(t));
    return [...CHANNEL_ORDER, ...extra];
  }, [byChannel]);

  const filtered = useMemo(() => all.filter((c) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${c.contact_name || ''} ${c.last_message_preview || ''} ${c.contact_email || ''} ${c.contact_phone || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [all, search]);

  useEffect(() => {
    if (!filtered.length) { setSelectedId(null); return; }
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  const handleRefresh = () => {
    refetch();
    setLastRefreshed(new Date());
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* ── Header ── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3 shadow-sm">
        <div className="rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 p-2 text-white shadow-md shadow-violet-500/25">
          <Inbox size={18} />
        </div>
        <div className="flex-1">
          <h1 className="text-base font-bold leading-tight text-slate-900">Unified Inbox</h1>
          <p className="text-[11px] text-slate-400">
            {totalCount} conversation{totalCount === 1 ? '' : 's'} across every connected channel
            {' · '}
            <span className="text-slate-300">refreshed {timeAgo(lastRefreshed.toISOString())}</span>
          </p>
        </div>
        <button
          onClick={handleRefresh}
          title="Refresh conversations"
          className={`grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition-all hover:bg-violet-50 hover:text-violet-600 ${isFetching ? 'animate-spin text-violet-500' : ''}`}
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── Pane 1: conversation list (resizable) ── */}
        <aside
          className="relative flex shrink-0 flex-col border-r border-slate-200 bg-white"
          style={{ width }}
        >
          {/* Search + channel chips */}
          <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-2 pl-8 pr-7 text-xs outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <FilterChip
                active={!channelF}
                onClick={() => setChannelF('')}
                label="All"
                count={totalCount}
              />
              {presentChannels.map((t) => {
                const cfg = channelCfg(t);
                return (
                  <FilterChip
                    key={t}
                    active={channelF === t}
                    onClick={() => setChannelF(channelF === t ? '' : t)}
                    label={cfg.label}
                    Icon={cfg.Icon}
                    count={byChannel[t] || 0}
                    cfg={cfg}
                  />
                );
              })}
            </div>

            {(search || channelF) && (
              <p className="text-[10px] text-slate-400">
                Showing <span className="font-bold text-slate-600">{filtered.length}</span> result{filtered.length !== 1 ? 's' : ''}
                {channelF && <> in <span className="font-bold text-violet-600">{channelCfg(channelF).label}</span></>}
              </p>
            )}
          </div>

          {/* List */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && [0, 1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}

            {!isLoading && !filtered.length && (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="mb-3 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 p-5 shadow-inner">
                  <Inbox size={24} className="text-slate-300" />
                </div>
                <p className="text-xs font-semibold text-slate-400">
                  {search || channelF ? 'No conversations match' : 'No conversations yet'}
                </p>
                <p className="mt-1 text-[10px] text-slate-300">
                  {search || channelF ? 'Try adjusting your filters' : 'Messages will appear here when received'}
                </p>
              </div>
            )}

            {filtered.map((c, idx) => {
              const cfg = channelCfg(c.channel_type);
              const active = c.id === selectedId;
              const hasUnread = c.inbound_count > 0;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  style={{ animationDelay: `${idx * 20}ms` }}
                  className={`group flex w-full items-start gap-2.5 border-b border-slate-50 px-3 py-3 text-left transition-all duration-150 animate-fade-in ${
                    active
                      ? 'border-l-[3px] border-l-violet-500 bg-gradient-to-r from-violet-50/80 to-white pl-[calc(0.75rem-1px)]'
                      : 'border-l-[3px] border-l-transparent hover:bg-slate-50/80'
                  }`}
                >
                  {/* Avatar — channel-tinted with a prominent channel-icon badge */}
                  <span className="relative mt-0.5 shrink-0">
                    <span className={`grid h-9 w-9 place-items-center rounded-full text-[11px] font-bold ring-2 ring-white transition-all ${cfg.tone} ${active ? 'shadow-md' : 'group-hover:shadow-sm'}`}>
                      {initials(c.contact_name)}
                    </span>
                    <span
                      className={`absolute -bottom-1 -right-1 grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-white text-white shadow-sm ${cfg.dot}`}
                      title={cfg.label}
                    >
                      <cfg.Icon className="h-2.5 w-2.5" />
                    </span>
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-1">
                      <span className={`truncate text-[13px] font-bold ${active ? 'text-violet-900' : 'text-slate-800'}`}>
                        {c.contact_name || 'Unknown'}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(c.last_message_at)}</span>
                    </span>
                    <span className={`mt-0.5 block truncate text-[11px] ${hasUnread ? 'font-semibold text-slate-700' : 'text-slate-400'}`}>
                      {c.last_message_preview || 'No messages yet'}
                    </span>
                    <span className="mt-1.5 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${cfg.tone}`}>
                        <cfg.Icon className="h-2.5 w-2.5" /> {cfg.label}
                      </span>
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold capitalize ${STATUS_CFG[c.status] || STATUS_CFG.closed}`}>
                        {c.status}
                      </span>
                      {hasUnread && (
                        <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white animate-pulse shadow-sm shadow-violet-500/40">
                          {c.inbound_count}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onMouseDown}
            title="Drag to resize"
            className="absolute right-0 top-0 flex h-full w-1.5 cursor-col-resize items-center justify-center group"
          >
            <div className="h-12 w-1 rounded-full bg-transparent transition-all group-hover:bg-violet-300 group-active:bg-violet-500" />
          </div>
        </aside>

        {/* ── Panes 2 + 3 ── */}
        {selectedId ? (
          <ConversationPanes conversationId={selectedId} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-gradient-to-br from-slate-50 to-violet-50/30">
            <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <Inbox size={28} className="mx-auto text-slate-200" />
            </div>
            <p className="text-sm font-medium text-slate-400">Select a conversation to view it</p>
            <p className="text-xs text-slate-300">Your messages will appear in the thread panel</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={null}>
      <InboxPageInner />
    </Suspense>
  );
}

/* ── Conversation thread + context rail ── */
function ConversationPanes({ conversationId }) {
  const { data: conv, isLoading, isError, error } = useConversation(conversationId);
  const send = useSendReply();
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);

  const messages = conv?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversationId]);

  useEffect(() => { setDraft(''); }, [conversationId]);

  // Auto-expand the composer textarea to fit content, animated via CSS height transition
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, 144); // caps at max-h-36 (144px)
    el.style.height = `${next}px`;
  }, [draft]);

  const lastInboundBrief = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direction === 'inbound') return messages[i].body || '';
      if (messages[i].direction === 'outbound') return '';
    }
    return '';
  }, [messages]);

  async function submit(e) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text) return;
    await send.mutateAsync({ conversationId, body: text }).catch(() => null);
    setDraft('');
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-slate-50/60">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-violet-400" />
          <p className="text-xs text-slate-400">Loading conversation…</p>
        </div>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 bg-slate-50/60">
        <AlertTriangle className="h-4 w-4 text-red-500" />
        <p className="text-sm text-red-600">{error.message}</p>
      </div>
    );
  }

  const cfg = channelCfg(conv.channel_type);

  return (
    <>
      {/* Pane 2 — thread */}
      <section className="flex min-w-0 flex-1 flex-col bg-slate-50/40">
        {/* Thread header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          <span className="relative shrink-0">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-rose-100 text-xs font-bold text-violet-700 ring-2 ring-violet-100">
              {initials(conv.contact_name)}
            </span>
            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white ${cfg.dot}`} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-900">{conv.contact_name || 'Unknown contact'}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-bold text-[9px] ${cfg.tone}`}>
                <cfg.Icon className="h-2.5 w-2.5" /> {cfg.label}
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-semibold text-slate-500">
                {conv.handled_by === 'bot' ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                {conv.handled_by}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CFG[conv.status] || STATUS_CFG.closed}`}>
              {conv.status}
            </span>
            <Link
              href={`/app/inbox/${conversationId}`}
              title="Open full conversation view"
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-violet-50 hover:text-violet-600 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {!messages.length && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
                <MessageSquare size={22} className="text-slate-200" />
              </div>
              <p className="text-xs text-slate-400">No messages in this conversation yet.</p>
            </div>
          )}
          {messages.map((m, idx) => {
            const out = m.direction === 'outbound';
            return (
              <div
                key={m.id}
                className={`flex animate-fade-in ${out ? 'justify-end' : 'justify-start'}`}
                style={{ animationDelay: `${idx * 30}ms` }}
              >
                {!out && (
                  <span className="mr-2 mt-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[9px] font-bold text-slate-500 ring-1 ring-slate-200 shadow-sm">
                    {initials(conv.contact_name)}
                  </span>
                )}
                <div className={`group relative max-w-[68%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm ${
                  out
                    ? 'rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 text-white'
                    : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
                }`}>
                  {m.subject && (
                    <p className={`mb-1.5 text-[11px] font-bold ${out ? 'text-violet-200' : 'text-slate-400'}`}>
                      {m.subject}
                    </p>
                  )}
                  <p className="whitespace-pre-line">{m.body || <em className="opacity-60">(no text)</em>}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className={`text-[10px] ${out ? 'text-violet-200' : 'text-slate-400'}`}>
                      {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                    </p>
                    {out && (
                      <button
                        onClick={() => { navigator.clipboard.writeText(m.body || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy message"
                      >
                        {copied ? <CheckCircle2 size={11} className="text-violet-200" /> : <Copy size={11} className="text-violet-300 hover:text-white" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI suggestion */}
        {lastInboundBrief && (
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-2.5">
            <SuggestedReplyCard
              brief={lastInboundBrief}
              customerName={conv.contact_name}
              channel={conv.channel_type}
              sessionId={conversationId}
              contactId={conv.contact_id}
              onUse={(text) => setDraft(text)}
            />
          </div>
        )}

        {/* Composer */}
        <form onSubmit={submit} className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          {send.error && (
            <p className="mb-2 flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-600">
              <AlertTriangle className="h-3 w-3 shrink-0" /> {send.error.message}
            </p>
          )}
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
                }}
                placeholder="Type a message…  (Enter ↵ to send · Shift+Enter for new line)"
                className="max-h-36 min-h-[44px] w-full resize-none overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 pr-16 text-sm outline-none transition-[height,box-shadow,border-color,background-color] duration-150 ease-out focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 placeholder:text-slate-400"
              />
              {draft.length > 0 && (
                <span className="absolute bottom-2.5 right-12 text-[10px] text-slate-300 tabular-nums">
                  {draft.length}
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={!draft.trim() || send.isPending}
              className="mb-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-rose-500 text-white shadow-md shadow-violet-500/30 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-500/40 active:translate-y-0 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-md"
              aria-label="Send reply"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-slate-300 flex items-center gap-2">
            <Sparkles size={9} className="text-violet-300" />
            <span>AI suggestions appear above when a customer messages</span>
          </p>
        </form>
      </section>

      {/* Pane 3 — context rail */}
      <ContextRail conv={conv} />
    </>
  );
}

function ContextRail({ conv }) {
  const score = conv.lead_score;
  const hasScore = typeof score === 'number';

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white xl:flex">
      {/* Contact card */}
      <div className="border-b border-slate-100 px-4 py-5 text-center bg-gradient-to-b from-violet-50/40 to-white">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-violet-100 to-rose-100 text-xl font-black text-violet-700 shadow-md shadow-violet-100/60 ring-4 ring-white">
          {initials(conv.contact_name)}
        </span>
        <p className="mt-3 text-sm font-bold text-slate-900">{conv.contact_name || 'Unknown contact'}</p>
        {conv.contact_source && (
          <p className="text-[11px] text-slate-400">via {conv.contact_source}</p>
        )}
        <div className="mt-2.5 flex items-center justify-center gap-1.5 flex-wrap">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold capitalize ${STATUS_CFG[conv.status] || STATUS_CFG.closed}`}>
            {conv.status}
          </span>
          {conv.lead_stage && (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold capitalize text-violet-700">
              {conv.lead_stage}
            </span>
          )}
        </div>
      </div>

      <RailSection title="Contact details">
        <RailRow Icon={Mail} value={conv.contact_email} href={conv.contact_email ? `mailto:${conv.contact_email}` : null} />
        <RailRow Icon={Phone} value={conv.contact_phone} href={conv.contact_phone ? `tel:${conv.contact_phone}` : null} />
        <RailRow Icon={Clock} value={conv.contact_created_at ? `Added ${new Date(conv.contact_created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : null} />
        {!conv.contact_email && !conv.contact_phone && (
          <p className="text-[11px] text-slate-400 italic">No contact details on record.</p>
        )}
      </RailSection>

      {hasScore && (
        <RailSection title="AI lead score">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black tabular-nums text-slate-900">{score}</span>
            <span className="text-[11px] font-bold text-slate-400">/ 100</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-violet-500 to-rose-500 transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-300">
            <span>Cold</span><span>Hot</span>
          </div>
          {conv.lead_priority && (
            <p className="mt-2 text-[11px] text-slate-500">
              Priority <span className="font-bold capitalize text-slate-700">{conv.lead_priority}</span>
            </p>
          )}
        </RailSection>
      )}

      <RailSection title="Assignment">
        <RailRow Icon={UserCheck} value={conv.assigned_to_name || 'Unassigned'} />
        <RailRow Icon={conv.handled_by === 'bot' ? Bot : User} value={`Handled by ${conv.handled_by}`} />
      </RailSection>

      {conv.contact_tags?.length ? (
        <RailSection title="Tags">
          <div className="flex flex-wrap gap-1">
            {conv.contact_tags.map((t) => (
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-600">
                <Tag className="h-2.5 w-2.5" /> {t}
              </span>
            ))}
          </div>
        </RailSection>
      ) : null}

      <RailSection title="Activity">
        <Timeline conv={conv} />
      </RailSection>

      {conv.contact_notes && (
        <RailSection title="Notes">
          <p className="whitespace-pre-line break-words text-[11px] leading-relaxed text-slate-600 bg-slate-50 rounded-lg p-2.5">
            {conv.contact_notes.length > 400 ? `${conv.contact_notes.slice(0, 400)}…` : conv.contact_notes}
          </p>
        </RailSection>
      )}

      <div className="mt-auto border-t border-slate-100 p-3">
        <Link
          href="/app/contacts"
          className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-[11px] font-bold text-slate-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 hover:shadow-sm"
        >
          Open in Contacts <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}

function RailSection({ title, children }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3.5">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function RailRow({ Icon, value, href }) {
  if (!value) return null;
  const body = (
    <span className="flex items-start gap-2 text-[11px] text-slate-600">
      <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="min-w-0 break-words">{value}</span>
    </span>
  );
  return href
    ? <a href={href} className="block rounded-lg px-1 hover:bg-violet-50 hover:text-violet-700 transition-colors">{body}</a>
    : <div className="px-1">{body}</div>;
}

function Timeline({ conv }) {
  const msgs = conv.messages ?? [];
  const events = [];

  if (conv.created_at) {
    events.push({ at: conv.created_at, label: `Conversation opened on ${channelCfg(conv.channel_type).label}`, tone: 'bg-violet-500' });
  }
  const firstInbound = msgs.find((m) => m.direction === 'inbound');
  if (firstInbound) events.push({ at: firstInbound.created_at, label: 'First message received', tone: 'bg-emerald-500' });

  const firstOutbound = msgs.find((m) => m.direction === 'outbound');
  if (firstOutbound) events.push({ at: firstOutbound.created_at, label: 'First reply sent', tone: 'bg-sky-500' });

  if (typeof conv.lead_score === 'number') {
    events.push({ at: conv.contact_created_at, label: `Lead scored ${conv.lead_score}/100`, tone: 'bg-rose-500' });
  }
  if (conv.last_message_at) {
    events.push({ at: conv.last_message_at, label: 'Last activity', tone: 'bg-slate-400' });
  }

  const ordered = events.filter((e) => e.at).sort((a, b) => new Date(b.at) - new Date(a.at));

  if (!ordered.length) {
    return <p className="text-[11px] text-slate-400 italic">No activity recorded yet.</p>;
  }

  return (
    <div className="relative space-y-3 pl-3 before:absolute before:left-[5px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-slate-100">
      {ordered.map((e, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <span className={`relative mt-1 h-2 w-2 shrink-0 rounded-full ${e.tone} ring-2 ring-white`} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight text-slate-700">{e.label}</p>
            <p className="text-[10px] text-slate-400">{timeAgo(e.at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}