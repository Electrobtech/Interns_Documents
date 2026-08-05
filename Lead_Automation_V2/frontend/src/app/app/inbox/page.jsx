'use client';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Inbox, Search, X, Send, User, Loader2, AlertTriangle, Bot, UserCheck,
  Mail, Phone, Tag, Clock, Globe, MessageCircle, Instagram, MessageSquare,
  Smartphone, Linkedin, ExternalLink, Sparkles, Activity, ChevronRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations, useConversation, useSendReply } from '@/lib/queries/crm';
import { useSocketEvent } from '@/lib/socket';
import SuggestedReplyCard from '@/components/ai-agents/inbox/SuggestedReplyCard';

/* ── channel presentation, keyed on conversations.channel_type ── */
const CHANNELS = {
  whatsapp:  { label: 'WhatsApp',  Icon: MessageCircle,  tone: 'text-emerald-600 bg-emerald-50' },
  instagram: { label: 'Instagram', Icon: Instagram,      tone: 'text-pink-600 bg-pink-50'       },
  messenger: { label: 'Messenger', Icon: MessageSquare,  tone: 'text-blue-600 bg-blue-50'       },
  email:     { label: 'Email',     Icon: Mail,           tone: 'text-violet-600 bg-violet-50'   },
  sms:       { label: 'SMS',       Icon: Smartphone,     tone: 'text-amber-600 bg-amber-50'     },
  webchat:   { label: 'Web chat',  Icon: Globe,          tone: 'text-sky-600 bg-sky-50'         },
  linkedin:  { label: 'LinkedIn',  Icon: Linkedin,       tone: 'text-blue-700 bg-blue-50'       },
  voice:     { label: 'Voice',     Icon: Phone,          tone: 'text-rose-600 bg-rose-50'       },
};
const channelCfg = (t) => CHANNELS[t] || { label: t || 'Unknown', Icon: MessageSquare, tone: 'text-slate-500 bg-slate-100' };

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

/* ── page: three panes ── */
// useSearchParams needs a Suspense boundary to avoid de-opting the whole
// route during build — see the default export below.
function InboxPageInner() {
  const qc = useQueryClient();
  const { data, isLoading } = useConversations();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  // Seeded from ?channel=whatsapp when arriving via the dashboard's
  // Omnichannel Distribution widget (one-click filter into a channel).
  const searchParams = useSearchParams();
  const [channelF, setChannelF] = useState(() => searchParams.get('channel') || '');

  // Live updates — services/inbox-service/src/realtime.js. Refresh both the
  // list and the open thread so an inbound message lands without a reload.
  useSocketEvent('conversation:updated', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] });
  }, [qc]);

  const all = Array.isArray(data) ? data : [];

  // Only offer channel chips that actually occur in this org's data.
  const presentChannels = useMemo(() => {
    const seen = [];
    for (const c of all) if (c.channel_type && !seen.includes(c.channel_type)) seen.push(c.channel_type);
    return seen;
  }, [all]);

  const filtered = useMemo(() => all.filter((c) => {
    if (channelF && c.channel_type !== channelF) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const hay = `${c.contact_name || ''} ${c.last_message_preview || ''} ${c.contact_email || ''} ${c.contact_phone || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }), [all, channelF, search]);

  // Keep a conversation selected as the list loads/filters change.
  useEffect(() => {
    if (!filtered.length) { setSelectedId(null); return; }
    if (!filtered.some((c) => c.id === selectedId)) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-5 py-3">
        <div className="rounded-xl bg-gradient-to-br from-violet-50 to-rose-100 p-2 text-violet-600">
          <Inbox size={18} />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight text-slate-900">Unified Inbox</h1>
          <p className="text-[11px] text-slate-400">
            {all.length} conversation{all.length === 1 ? '' : 's'} across every connected channel
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* ── pane 1: conversation list ── */}
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <div className="shrink-0 space-y-2 border-b border-slate-100 p-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search conversations…"
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-8 pr-7 text-xs outline-none transition-all focus:border-violet-400 focus:ring focus:ring-violet-100"
              />
              {search && (
                <button onClick={() => setSearch('')} aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* channel filter chips */}
            <div className="flex flex-wrap gap-1">
              <FilterChip active={!channelF} onClick={() => setChannelF('')} label="All" count={all.length} />
              {presentChannels.map((t) => {
                const cfg = channelCfg(t);
                return (
                  <FilterChip
                    key={t}
                    active={channelF === t}
                    onClick={() => setChannelF(channelF === t ? '' : t)}
                    label={cfg.label}
                    Icon={cfg.Icon}
                    count={all.filter((c) => c.channel_type === t).length}
                  />
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading && (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />)}
              </div>
            )}

            {!isLoading && !filtered.length && (
              <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
                <div className="mb-3 rounded-2xl bg-slate-50 p-4">
                  <Inbox size={22} className="text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-400">
                  {search || channelF ? 'No conversations match' : 'No conversations yet'}
                </p>
              </div>
            )}

            {filtered.map((c) => {
              const cfg = channelCfg(c.channel_type);
              const active = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-start gap-2.5 border-b border-slate-50 px-3 py-2.5 text-left transition-colors ${
                    active ? 'border-l-2 border-l-violet-500 bg-violet-50/60' : 'hover:bg-slate-50'
                  }`}
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-rose-100 text-[11px] font-bold text-violet-700">
                    {initials(c.contact_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-bold text-slate-800">{c.contact_name || 'Unknown'}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(c.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                      {c.last_message_preview || 'No messages yet'}
                    </span>
                    <span className="mt-1 flex items-center gap-1.5">
                      <span className={`inline-flex items-center gap-1 rounded px-1 py-px text-[9px] font-bold ${cfg.tone}`}>
                        <cfg.Icon className="h-2.5 w-2.5" /> {cfg.label}
                      </span>
                      <span className={`rounded border px-1 py-px text-[9px] font-bold capitalize ${STATUS_CFG[c.status] || STATUS_CFG.closed}`}>
                        {c.status}
                      </span>
                      {c.inbound_count > 0 && (
                        <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-violet-600 px-1 text-[9px] font-bold text-white">
                          {c.inbound_count}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── panes 2 + 3 ── */}
        {selectedId ? (
          <ConversationPanes conversationId={selectedId} />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-slate-50/60">
            <p className="text-sm text-slate-400">Select a conversation to view it.</p>
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

function FilterChip({ active, onClick, label, Icon, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold transition-all ${
        active
          ? 'border-violet-300 bg-violet-100 text-violet-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50'
      }`}
    >
      {Icon && <Icon className="h-2.5 w-2.5" />}
      {label}
      <span className="text-slate-400">{count}</span>
    </button>
  );
}

/* ── pane 2 (thread) + pane 3 (context rail) ── */
function ConversationPanes({ conversationId }) {
  const { data: conv, isLoading, isError, error } = useConversation(conversationId);
  const send = useSendReply();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef(null);

  const messages = conv?.messages ?? [];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, conversationId]);

  useEffect(() => { setDraft(''); }, [conversationId]);

  // The last unanswered inbound message is what the AI suggests a reply to.
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
        <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
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
      {/* pane 2 — thread */}
      <section className="flex min-w-0 flex-1 flex-col bg-slate-50/60">
        {/* thread header */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-200 bg-white px-4 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-rose-100 text-xs font-bold text-violet-700">
            {initials(conv.contact_name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-900">{conv.contact_name || 'Unknown contact'}</p>
            <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className={`inline-flex items-center gap-1 rounded px-1 py-px font-bold ${cfg.tone}`}>
                <cfg.Icon className="h-2.5 w-2.5" /> {cfg.label}
              </span>
              · handled by
              <span className="inline-flex items-center gap-1 font-semibold text-slate-600">
                {conv.handled_by === 'bot' ? <Bot className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                {conv.handled_by}
              </span>
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CFG[conv.status] || STATUS_CFG.closed}`}>
              {conv.status}
            </span>
            <Link
              href={`/app/inbox/${conversationId}`}
              title="Open full conversation view"
              className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>

        {/* messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          {!messages.length && (
            <p className="py-10 text-center text-xs text-slate-400">No messages in this conversation yet.</p>
          )}
          {messages.map((m) => {
            const out = m.direction === 'outbound';
            return (
              <div key={m.id} className={`flex ${out ? 'justify-end' : 'justify-start'}`}>
                {!out && (
                  <span className="mr-2 mt-auto grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[9px] font-bold text-slate-500 ring-1 ring-slate-200">
                    {initials(conv.contact_name)}
                  </span>
                )}
                <div className={`max-w-[68%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed shadow-sm ${
                  out
                    ? 'rounded-br-md bg-gradient-to-br from-violet-600 to-violet-700 text-white'
                    : 'rounded-bl-md border border-slate-200 bg-white text-slate-700'
                }`}>
                  {m.subject && <p className={`mb-1 text-[11px] font-bold ${out ? 'text-violet-100' : 'text-slate-500'}`}>{m.subject}</p>}
                  <p className="whitespace-pre-line">{m.body || <em className="opacity-60">(no text)</em>}</p>
                  <p className={`mt-1 text-[10px] ${out ? 'text-violet-200' : 'text-slate-400'}`}>
                    {new Date(m.created_at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* AI suggestion — unchanged trust layer, never auto-sends */}
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

        {/* composer */}
        <form onSubmit={submit} className="shrink-0 border-t border-slate-200 bg-white px-4 py-3">
          {send.error && (
            <p className="mb-2 flex items-center gap-1.5 text-[11px] text-red-600">
              <AlertTriangle className="h-3 w-3" /> {send.error.message}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              rows={1}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
              }}
              placeholder="Type a message…  (Enter to send, Shift+Enter for a new line)"
              className="max-h-32 min-h-[40px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-all focus:border-violet-400 focus:ring focus:ring-violet-100"
            />
            <button
              type="submit"
              disabled={!draft.trim() || send.isPending}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-rose-600 to-violet-600 text-white shadow-md shadow-violet-500/25 transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:translate-y-0"
              aria-label="Send reply"
            >
              {send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </form>
      </section>

      {/* pane 3 — context rail */}
      <ContextRail conv={conv} />
    </>
  );
}

function ContextRail({ conv }) {
  const score = conv.lead_score;
  const hasScore = typeof score === 'number';

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white xl:flex">
      <div className="border-b border-slate-100 px-4 py-4 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-violet-100 to-rose-100 text-lg font-black text-violet-700">
          {initials(conv.contact_name)}
        </span>
        <p className="mt-2 text-sm font-bold text-slate-900">{conv.contact_name || 'Unknown contact'}</p>
        {conv.contact_source && (
          <p className="text-[11px] text-slate-400">via {conv.contact_source}</p>
        )}
        <div className="mt-2 flex items-center justify-center gap-1.5">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${STATUS_CFG[conv.status] || STATUS_CFG.closed}`}>
            {conv.status}
          </span>
          {conv.lead_stage && (
            <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold capitalize text-violet-700">
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
          <p className="text-[11px] text-slate-400">No email or phone on this contact.</p>
        )}
      </RailSection>

      {hasScore && (
        <RailSection title="AI lead score">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black tabular-nums text-slate-900">{score}</span>
            <span className="text-[11px] font-bold text-slate-400">/ 100</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 via-violet-500 to-rose-500 transition-all duration-700"
              style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">
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
              <span key={t} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
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
          <p className="whitespace-pre-line break-words text-[11px] leading-relaxed text-slate-600">
            {conv.contact_notes.length > 400 ? `${conv.contact_notes.slice(0, 400)}…` : conv.contact_notes}
          </p>
        </RailSection>
      )}

      <div className="mt-auto border-t border-slate-100 p-3">
        <Link
          href="/app/contacts"
          className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
        >
          Open in Contacts <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </aside>
  );
}

function RailSection({ title, children }) {
  return (
    <div className="border-b border-slate-100 px-4 py-3">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function RailRow({ Icon, value, href }) {
  if (!value) return null;
  const body = (
    <span className="flex items-start gap-2 text-[11px] text-slate-600">
      <Icon className="mt-px h-3 w-3 shrink-0 text-slate-400" />
      <span className="min-w-0 break-words">{value}</span>
    </span>
  );
  return href ? <a href={href} className="block hover:text-violet-700">{body}</a> : body;
}

/**
 * Timeline built only from events this conversation actually recorded —
 * message directions and their timestamps — rather than a scripted history.
 */
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

  const ordered = events
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  if (!ordered.length) {
    return <p className="text-[11px] text-slate-400">No activity recorded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {ordered.map((e, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${e.tone}`} />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-tight text-slate-700">{e.label}</p>
            <p className="text-[10px] text-slate-400">{timeAgo(e.at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}