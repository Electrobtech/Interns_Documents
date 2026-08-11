'use client';
import { useMemo, useState, useRef, useEffect } from 'react';
import {
  Headphones, Sparkles, AlertTriangle, MessageSquare, Inbox,
  Database, ShieldAlert, ListChecks, HelpCircle, BookOpen,
  Clock, User, Hash, ChevronRight, Zap, UserCheck, Send,
  LayoutGrid, Ticket, CalendarDays, FileBarChart2, Sheet,
  Copy, CheckCircle2, Search, Filter, X, ChevronDown, ChevronUp,
  ArrowRight, RefreshCw, Eye, EyeOff, Wand2, MessageCircleMore,
} from 'lucide-react';
import {
  useRunSupportAgent, useSupportRuns, useAgentAnalytics, useKnowledgeSources,
} from '@/lib/queries/aiAgents';
import { useConversations, useSendReply, useFindConversationByName } from '@/lib/queries/crm';
import KpiCard from './KpiCard';
import WorkspaceHeader from './shared/WorkspaceHeader';
import RAGAuditorPanel from './support/RAGAuditorPanel';
import KnowledgeUploadPanel from './KnowledgeUploadPanel';
import NotificationBell from './support/NotificationBell';
import OverviewSummary from './support/OverviewSummary';
import CalendarTab from './support/CalendarTab';
import DailyReportTab from './support/DailyReportTab';
import ImportTab from './support/ImportTab';

const TABS = [
  { key: 'overview',  label: 'Overview',  icon: LayoutGrid },
  { key: 'tickets',   label: 'Tickets',   icon: Ticket },
  { key: 'calendar',  label: 'Calendar',  icon: CalendarDays },
  { key: 'reports',   label: 'Reports',   icon: FileBarChart2 },
  { key: 'import',    label: 'Import',    icon: Sheet },
  { key: 'knowledge', label: 'Knowledge', icon: BookOpen },
];

const TONE_OPTIONS = [
  { key: 'professional', label: 'Professional', emoji: '🎩' },
  { key: 'empathetic',   label: 'Empathetic',   emoji: '💙' },
  { key: 'concise',      label: 'Concise',      emoji: '⚡' },
];

/* ── helpers ─────────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const PRIORITY_BADGE = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high:   'bg-red-50 text-red-600 border-red-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low:    'bg-slate-100 text-slate-500 border-slate-200',
};

const PRIORITY_LEFT = {
  urgent: 'border-l-red-500',
  high:   'border-l-orange-400',
  medium: 'border-l-amber-400',
  low:    'border-l-slate-200',
};

const STATUS_BADGE = {
  open:     'bg-blue-50 text-blue-700',
  pending:  'bg-amber-50 text-amber-700',
  handoff:  'bg-fuchsia-50 text-fuchsia-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed:   'bg-slate-100 text-slate-500',
};

const CSAT_COLOR = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-600' };

const TICKETS_PAGE_SIZE = 15;

function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/* ── Tab nav with animated indicator ─────────────────────────── */
function TabNav({ active, onChange, counts }) {
  const tabRefs = useRef({});

  return (
    <div className="relative flex items-center gap-0.5 overflow-x-auto border-b border-slate-100 -mx-1 px-1">
      {TABS.map(({ key, label, icon: Icon }) => {
        const isActive = active === key;
        const count = counts?.[key];
        return (
          <button
            key={key}
            ref={(el) => (tabRefs.current[key] = el)}
            onClick={() => onChange(key)}
            className={`relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 -mb-px transition-all duration-200 ${
              isActive
                ? 'border-violet-500 text-violet-600 bg-violet-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-200 hover:bg-slate-50/50'
            }`}
          >
            <Icon size={13} className={`transition-colors ${isActive ? 'text-violet-500' : ''}`} />
            {label}
            {count != null && count > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold transition-all ${
                isActive ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Section card ─────────────────────────────────────────────── */
function ResultSection({ icon: Icon, title, children, accent = 'from-violet-50 to-purple-100', iconColor = 'text-violet-600' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`p-2 rounded-xl bg-gradient-to-br ${accent} ${iconColor}`}>
          <Icon size={14} />
        </div>
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
      </div>
      {children}
    </div>
  );
}

/* ── Copy button ──────────────────────────────────────────────── */
function CopyButton({ text, className = '' }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition-all ${
        copied
          ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
          : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:text-violet-600'
      } ${className}`}
    >
      {copied ? <CheckCircle2 size={11} /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

/* ── Thinking animation ───────────────────────────────────────── */
function ThinkingAnimation() {
  return (
    <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-8 text-center animate-scale-in">
      <div className="relative inline-block mb-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center shadow-inner">
          <Sparkles size={26} className="text-violet-500 animate-pulse" />
        </div>
        <div className="absolute inset-0 rounded-2xl animate-ping opacity-10 bg-violet-400" />
      </div>
      <p className="text-sm font-bold text-slate-700">Analyzing your knowledge base…</p>
      <p className="text-xs text-slate-400 mt-1">Drafting a grounded reply</p>
      <div className="flex items-center justify-center gap-2 mt-5">
        {['Searching docs', 'Generating reply', 'Reviewing tone'].map((step, i) => (
          <span key={step} className="flex items-center gap-1 text-[10px] text-slate-400 animate-pulse" style={{ animationDelay: `${i * 400}ms` }}>
            {i > 0 && <ArrowRight size={9} className="text-slate-300" />}
            {step}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-center gap-1.5 mt-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }} />
        ))}
      </div>
    </div>
  );
}

/* ── Expandable ticket row ────────────────────────────────────── */
function TicketRow({ c, isSelected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const priority = c.priority || 'low';
  const leftBorder = PRIORITY_LEFT[priority] || 'border-l-slate-200';

  return (
    <>
      <tr
        onClick={() => onSelect(c)}
        className={`group cursor-pointer border-l-[3px] transition-all ${leftBorder} ${
          isSelected ? 'bg-violet-50/60' : 'hover:bg-slate-50/60'
        }`}
        title="Click to load this ticket into the AI Support Assistant"
      >
        <td className="px-4 py-3">
          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
            #{c.id.slice(0, 8)}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center shrink-0">
              <User size={11} className="text-violet-600" />
            </div>
            <span className="font-medium text-slate-700 text-xs">{c.contact_name || 'Unknown'}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="capitalize text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">{c.channel_type}</span>
        </td>
        <td className="px-4 py-3">
          <span className="text-xs text-slate-500 max-w-[160px] truncate block">
            {c.last_message_preview || '—'}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize ${STATUS_BADGE[c.status] || 'bg-slate-100 text-slate-500'}`}>
            {c.status}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Clock size={10} />{timeAgo(c.last_message_at)}
          </span>
        </td>
        <td className="px-4 py-3">
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
            className="text-slate-300 hover:text-violet-500 transition-colors p-1 rounded-lg hover:bg-violet-50"
            title="Preview message"
          >
            {expanded ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </td>
      </tr>
      {expanded && c.last_message_preview && (
        <tr className="animate-fade-in">
          <td colSpan={7} className="px-4 pb-3 pt-0">
            <div className="ml-[calc(1rem+2px)] mr-4 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3 text-xs text-slate-600 leading-relaxed">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Last Message Preview</p>
              {c.last_message_preview}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/* ── Main component ───────────────────────────────────────────── */
export default function SupportWorkspace() {
  const run                 = useRunSupportAgent();
  const { data: runsData }  = useSupportRuns();
  const { data: convoData } = useConversations();
  const { data: analytics } = useAgentAnalytics('7d');
  const { data: knowledge } = useKnowledgeSources('support');
  const sendReply           = useSendReply();
  const findConversation    = useFindConversationByName();

  const [query,         setQuery]        = useState('');
  const [customerName,  setCName]        = useState('');
  const [selectedTicket,setSelected]     = useState(null);
  const [sendState,     setSendState]    = useState('idle');
  const [tab,           setTab]          = useState('overview');
  const [tone,          setTone]         = useState('professional');
  const [ticketSearch,  setTicketSearch] = useState('');
  const [statusFilter,  setStatusFilter] = useState('');
  const [showReply,     setShowReply]    = useState(true);
  const [visibleTicketCount, setVisibleTicketCount] = useState(TICKETS_PAGE_SIZE);

  const conversations = Array.isArray(convoData) ? convoData : [];
  const runs          = Array.isArray(runsData)  ? runsData  : [];
  const chunkCount    = Array.isArray(knowledge)
    ? knowledge.reduce((n, s) => n + (s.chunk_count || 0), 0)
    : undefined;

  const openCount = useMemo(() =>
    conversations.filter((c) => ['open','new','pending','handoff'].includes(c.status)).length,
    [conversations]);
  const escalations = useMemo(() => runs.filter((r) => r.output?.escalation_needed), [runs]);

  const filteredTickets = useMemo(() => {
    return conversations.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (ticketSearch.trim()) {
        const q = ticketSearch.toLowerCase();
        const hay = `${c.contact_name || ''} ${c.last_message_preview || ''} ${c.channel_type || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [conversations, ticketSearch, statusFilter]);

  // Reset pagination whenever the ticket search/filter narrows or widens the result set
  useEffect(() => {
    setVisibleTicketCount(TICKETS_PAGE_SIZE);
  }, [ticketSearch, statusFilter]);

  const tabCounts = {
    tickets:  openCount || undefined,
    overview: escalations.length || undefined,
  };

  const submit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSendState('idle');
    run.mutate({
      brief: query.trim() + (tone !== 'professional' ? ` [Tone: ${tone}]` : ''),
      customer_name: customerName.trim() || null,
      session_id: `dashboard:${customerName.trim() || 'anonymous'}`,
    });
  };

  const out = run.data;

  const selectTicket = (c) => {
    setSelected(c);
    setCName(c.contact_name || '');
    setSendState('idle');
  };

  const openNotificationTarget = (n) => {
    const match = conversations.find((c) => c.contact_name && c.contact_name === n.contact_name);
    if (match) selectTicket(match);
    else setCName(n.contact_name || '');
    setTab('tickets');
  };

  const sendViaInbox = async () => {
    if (!out?.suggested_reply) return;
    setSendState('sending');
    try {
      const conversationId = selectedTicket?.id
        || (await findConversation.mutateAsync(customerName.trim()))?.id;
      if (!conversationId) { setSendState('not_found'); return; }
      await sendReply.mutateAsync({ conversationId, content: out.suggested_reply });
      setSendState('sent');
    } catch {
      setSendState('error');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header + notification bell */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <WorkspaceHeader
            agent="support"
            icon={Headphones}
            title="Support Agent"
            subtitle="Resolve issues, retain customers, and escalate intelligently"
          />
        </div>
        <div className="pt-1">
          <NotificationBell onSelect={openNotificationTarget} />
        </div>
      </div>

      <TabNav active={tab} onChange={setTab} counts={tabCounts} />

      {/* ══ OVERVIEW ══ */}
      {tab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Inbox,      label: 'Open Tickets',       tone: 'brand',   value: openCount,                             loading: convoData === undefined },
              { icon: ShieldAlert,label: 'Escalations (7d)',   tone: 'amber',   value: analytics?.totals?.supportEscalations, loading: !analytics },
              { icon: Sparkles,   label: 'AI Replies Drafted', tone: 'emerald', value: runs.length,                           loading: runsData === undefined },
              { icon: Database,   label: 'Knowledge Chunks',   tone: 'violet',  value: chunkCount,                            loading: chunkCount === undefined },
            ].map(({ icon, label, tone: t, value, loading }, i) => (
              <div key={label} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
                <KpiCard icon={icon} label={label} tone={t} value={value} loading={loading} />
              </div>
            ))}
          </div>

          <OverviewSummary />

          {escalations.length > 0 && (
            <div className="bg-gradient-to-br from-red-50 to-rose-50 border border-red-200 rounded-2xl p-5 animate-slide-up">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-2 rounded-xl bg-red-100 text-red-600">
                  <ShieldAlert size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-red-800 text-sm">Escalation Alerts</h4>
                  <p className="text-[11px] text-red-400">{escalations.length} unreviewed escalation{escalations.length > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setTab('tickets')}
                  className="ml-auto text-xs font-semibold text-red-600 hover:text-red-800 flex items-center gap-1 transition-colors"
                >
                  View tickets <ChevronRight size={13} />
                </button>
              </div>
              <div className="space-y-2">
                {escalations.slice(0, 4).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-2.5 border border-red-100 shadow-sm">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 animate-pulse" />
                      <span className="text-xs font-medium text-red-700 truncate">{r.brief}</span>
                    </div>
                    <span className="text-[10px] text-red-400 shrink-0">{timeAgo(r.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ CALENDAR / REPORTS / IMPORT / KNOWLEDGE ══ */}
      {tab === 'calendar'  && <CalendarTab />}
      {tab === 'reports'   && <DailyReportTab />}
      {tab === 'import'    && <ImportTab />}
      {tab === 'knowledge' && (
        <div className="space-y-6 animate-fade-in">
          <RAGAuditorPanel />
          <KnowledgeUploadPanel agentType="support" />
        </div>
      )}

      {/* ══ TICKETS ══ */}
      {tab === 'tickets' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-fade-in">

          {/* LEFT: Ticket queue + AI assistant */}
          <div className="xl:col-span-2 space-y-6">

            {/* Ticket Queue */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                    <MessageSquare size={15} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Ticket Queue</h4>
                    <p className="text-[11px] text-slate-400">Live from Unified Inbox · <span className="font-semibold text-emerald-600">{openCount} open</span></p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                  {conversations.length} total
                </span>
              </div>

              {/* Ticket search + status filter */}
              {conversations.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-50 bg-slate-50/40">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={ticketSearch}
                      onChange={(e) => setTicketSearch(e.target.value)}
                      placeholder="Search tickets…"
                      className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-7 pr-7 text-xs outline-none focus:border-violet-300 focus:ring-1 focus:ring-violet-100 transition-all"
                    />
                    {ticketSearch && (
                      <button onClick={() => setTicketSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {['', 'open', 'pending', 'handoff', 'resolved', 'closed'].map((s) => (
                      <button
                        key={s || 'all'}
                        onClick={() => setStatusFilter(s)}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${
                          statusFilter === s
                            ? 'bg-violet-600 text-white shadow-sm'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {s || 'All'}
                      </button>
                    ))}
                  </div>
                  {(ticketSearch || statusFilter) && (
                    <span className="text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-600">{filteredTickets.length}</span> results
                    </span>
                  )}
                </div>
              )}

              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="p-5 rounded-2xl bg-slate-50 mb-3 shadow-inner">
                    <Inbox size={24} className="text-slate-300" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">No conversations yet</p>
                  <p className="text-xs text-slate-300 mt-1">Tickets from all channels appear here</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-slate-400">No tickets match your search</p>
                  <button onClick={() => { setTicketSearch(''); setStatusFilter(''); }}
                    className="mt-2 text-xs font-semibold text-violet-500 hover:text-violet-700 transition-colors">
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-premium">
                    <thead>
                      <tr>
                        <th>Ticket</th>
                        <th>Customer</th>
                        <th>Channel</th>
                        <th>Preview</th>
                        <th>Status</th>
                        <th>Updated</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTickets.slice(0, visibleTicketCount).map((c) => (
                        <TicketRow
                          key={c.id}
                          c={c}
                          isSelected={selectedTicket?.id === c.id}
                          onSelect={selectTicket}
                        />
                      ))}
                    </tbody>
                  </table>
                  {filteredTickets.length > TICKETS_PAGE_SIZE && (
                    <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-slate-50 bg-slate-50/40">
                      {visibleTicketCount < filteredTickets.length ? (
                        <button
                          onClick={() => setVisibleTicketCount((n) => Math.min(n + TICKETS_PAGE_SIZE, filteredTickets.length))}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                        >
                          <ChevronDown size={12} />
                          Load {Math.min(TICKETS_PAGE_SIZE, filteredTickets.length - visibleTicketCount)} more
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">{filteredTickets.length - visibleTicketCount} remaining</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setVisibleTicketCount(TICKETS_PAGE_SIZE)}
                          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-400 transition-all hover:text-violet-600"
                        >
                          <ChevronUp size={12} />
                          Showing all {filteredTickets.length} — collapse
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Support Assistant */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
              <div className="flex items-center gap-2.5 mb-1">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                  <Wand2 size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">AI Support Assistant</h4>
                  <p className="text-[11px] text-slate-400">
                    {selectedTicket
                      ? `Loaded: ${selectedTicket.contact_name || 'Selected ticket'}`
                      : 'Paste a customer message — AI drafts a reply from your knowledge base'}
                  </p>
                </div>
                {selectedTicket && (
                  <button onClick={() => { setSelected(null); setCName(''); }}
                    className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors">
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-violet-200 to-transparent my-4" />

              {/* Tone selector */}
              <div className="mb-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Reply Tone</p>
                <div className="flex gap-2">
                  {TONE_OPTIONS.map((t) => (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setTone(t.key)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold transition-all ${
                        tone === t.key
                          ? 'border-violet-300 bg-violet-50 text-violet-700 shadow-sm'
                          : 'border-slate-200 bg-white text-slate-500 hover:border-violet-200 hover:bg-violet-50'
                      }`}
                    >
                      <span>{t.emoji}</span> {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={submit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                    Customer Name
                  </label>
                  <input
                    value={customerName}
                    onChange={(e) => setCName(e.target.value)}
                    placeholder="Optional — auto-fills from selected ticket"
                    className="input-premium"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      Customer Message *
                    </label>
                    <span className="text-[10px] text-slate-300 tabular-nums">{query.length} chars</span>
                  </div>
                  <textarea
                    required rows={4}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. I paid the deposit but never received a confirmation email…"
                    className="input-premium resize-none"
                  />
                </div>

                {run.isError && (
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
                    <AlertTriangle size={13} className="text-red-500 shrink-0" />
                    <p className="text-xs text-red-600">{run.error?.message}</p>
                  </div>
                )}

                <button disabled={run.isPending || !query.trim()} className="btn-violet w-full">
                  <Sparkles size={14} />
                  {run.isPending ? 'Analyzing…' : 'Get AI Reply'}
                </button>
              </form>
            </div>

            {/* Thinking animation */}
            {run.isPending && <ThinkingAnimation />}

            {/* Results */}
            {out && (
              <div className="space-y-4 animate-slide-up">

                {out.escalation_needed && (
                  <div className="flex items-start gap-3 px-4 py-3.5 bg-red-50 border border-red-200 rounded-2xl">
                    <div className="p-1.5 rounded-lg bg-red-100 text-red-600 shrink-0">
                      <ShieldAlert size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-800">Escalation Recommended</p>
                      <p className="text-xs text-red-600 mt-0.5">{out.human_handoff_note}</p>
                    </div>
                  </div>
                )}

                {out.human_handoff && !out.escalation_needed && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <UserCheck size={15} className="text-amber-600 shrink-0" />
                    <p className="text-sm text-amber-800 font-medium">This ticket should be reviewed by a human before responding.</p>
                  </div>
                )}

                {/* Classification */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Ticket Classification</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {out.ticket_category && <span className="badge-violet capitalize">{out.ticket_category}</span>}
                    {out.priority_level && (
                      <span className={`badge border capitalize ${PRIORITY_BADGE[out.priority_level] || 'bg-slate-100 text-slate-500'}`}>
                        {out.priority_level} priority
                      </span>
                    )}
                    {out.csat_risk && (
                      <span className={`text-xs font-semibold ${CSAT_COLOR[out.csat_risk] || 'text-slate-500'}`}>
                        CSAT risk: {out.csat_risk}
                      </span>
                    )}
                    <span className="ml-auto text-[10px] text-slate-400 flex items-center gap-1">
                      <Wand2 size={10} className="text-violet-400" /> {tone} tone
                    </span>
                  </div>
                  {out.issue_summary && (
                    <>
                      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Issue Summary</p>
                      <p className="text-sm text-slate-700 leading-relaxed">{out.issue_summary}</p>
                    </>
                  )}
                </div>

                {/* Suggested Reply */}
                {!isEmpty(out.suggested_reply) && (
                  <ResultSection icon={MessageCircleMore} title="Suggested Reply">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        AI-generated — review before sending
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowReply((v) => !v)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1 transition-colors"
                        >
                          {showReply ? <><EyeOff size={11} /> Hide</> : <><Eye size={11} /> Show</>}
                        </button>
                        <CopyButton text={out.suggested_reply} />
                      </div>
                    </div>

                    {showReply && (
                      <div className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line border border-slate-100 leading-relaxed animate-fade-in">
                        {out.suggested_reply}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                      <button
                        onClick={sendViaInbox}
                        disabled={sendState === 'sending' || sendState === 'sent'}
                        className="btn-violet btn-sm"
                      >
                        <Send size={13} />
                        {sendState === 'sending' ? 'Sending…' : sendState === 'sent' ? '✓ Sent!' : 'Send via Unified Inbox'}
                      </button>
                      {sendState === 'not_found' && (
                        <span className="text-[11px] text-amber-600">
                          No matching ticket{customerName ? ` for "${customerName}"` : ''} — click a row above.
                        </span>
                      )}
                      {sendState === 'error' && <span className="text-[11px] text-red-500">Failed. Try from Unified Inbox.</span>}
                      {sendState === 'sent' && <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 size={12} /> Reply delivered!</span>}
                    </div>

                    {out.knowledge_base_references?.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-slate-100">
                        <Database size={10} className="text-violet-400" />
                        <p className="text-[10px] text-violet-500 font-medium">
                          Sources: {out.knowledge_base_references.join(', ')}
                        </p>
                      </div>
                    )}
                  </ResultSection>
                )}

                {/* Resolution Steps */}
                {!isEmpty(out.resolution_steps) && (
                  <ResultSection icon={ListChecks} title="Resolution Steps (Internal)">
                    <ul className="space-y-2">
                      {(out.resolution_steps || []).map((s, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center text-[10px] font-bold mt-0.5">
                            {i + 1}
                          </span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}

                {/* Follow-up Questions */}
                {!isEmpty(out.follow_up_questions) && (
                  <ResultSection icon={HelpCircle} title="Follow-up Questions" accent="from-amber-50 to-orange-100" iconColor="text-amber-600">
                    <ul className="space-y-2">
                      {(out.follow_up_questions || []).map((q, i) => (
                        <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                          <span className="flex-shrink-0 text-amber-500 font-bold mt-0.5">?</span>
                          {q}
                        </li>
                      ))}
                    </ul>
                  </ResultSection>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Recent AI replies */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
              <div className="flex items-center justify-between gap-2.5 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                    <BookOpen size={15} />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">Recent AI Replies</h4>
                    <p className="text-[11px] text-slate-400">{runs.length} drafted so far</p>
                  </div>
                </div>
              </div>

              {!runs.length ? (
                <div className="text-center py-10">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 w-fit mx-auto mb-3 shadow-inner">
                    <Sparkles size={20} className="text-slate-300" />
                  </div>
                  <p className="text-xs font-medium text-slate-400">No replies drafted yet</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Use the assistant to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {runs.slice(0, 6).map((r, i) => (
                    <div
                      key={r.id}
                      className="group p-3 rounded-xl bg-slate-50 hover:bg-violet-50/40 border border-transparent hover:border-violet-100 transition-all duration-150 cursor-pointer animate-fade-in"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <div className="flex items-start gap-2 mb-1.5">
                        <div className="p-1 rounded-md bg-white shadow-sm shrink-0 mt-0.5">
                          <Zap size={10} className="text-violet-500" />
                        </div>
                        <p className="text-xs font-semibold text-slate-700 truncate leading-snug">{r.brief}</p>
                      </div>
                      <div className="flex items-center gap-2 pl-6 flex-wrap">
                        {r.output?.ticket_category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 font-semibold capitalize">
                            {r.output.ticket_category}
                          </span>
                        )}
                        {r.output?.escalation_needed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">escalated</span>
                        )}
                        {r.output?.priority_level && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize ${PRIORITY_BADGE[r.output.priority_level] || 'bg-slate-100 text-slate-500'}`}>
                            {r.output.priority_level}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 ml-auto">{timeAgo(r.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}