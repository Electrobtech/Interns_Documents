'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Inbox, Headphones, Sparkles, MessageSquare, Clock, User,
  AlertTriangle, ShieldAlert, Filter, Search, X, ChevronRight,
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useConversations } from '@/lib/queries/crm';
import { useRunSupportAgent, useSupportRuns } from '@/lib/queries/aiAgents';
import { useSocketEvent } from '@/lib/socket';

/* ── helpers ─────────────────────────── */
function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const STATUS_CFG = {
  open:     'bg-emerald-50 text-emerald-700',
  pending:  'bg-amber-50 text-amber-700',
  handoff:  'bg-fuchsia-50 text-fuchsia-700',
  resolved: 'bg-slate-100 text-slate-500',
  closed:   'bg-slate-100 text-slate-400',
};
const PRIORITY_CFG = {
  urgent: 'bg-red-100 text-red-700',
  high:   'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-700',
  low:    'bg-slate-100 text-slate-500',
};

/* ── Support Agent panel ─────────────── */
function SupportAgentPanel() {
  const run = useRunSupportAgent();
  const { data: runsData } = useSupportRuns();
  const [query, setQuery]     = useState('');
  const [cname, setCname]     = useState('');
  const runs = Array.isArray(runsData) ? runsData : [];
  const out  = run.data;

  const submit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    run.mutate({ brief: query.trim(), customer_name: cname.trim() || null });
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      {/* form */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
            <Sparkles size={15} />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm">Support Agent Assistant</h4>
            <p className="text-[11px] text-slate-400">Paste a customer message — AI drafts a reply from your knowledge base</p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />
        <form onSubmit={submit} className="space-y-3.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Customer Name</label>
            <input value={cname} onChange={(e) => setCname(e.target.value)}
              placeholder="Optional" className="input-premium" />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Customer Message *</label>
            <textarea required rows={5} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. I paid the deposit but never received a confirmation email…"
              className="input-premium resize-none" />
          </div>
          {run.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{run.error?.message}</p>
            </div>
          )}
          <button disabled={run.isPending || !query.trim()} className="btn-violet w-full">
            <Sparkles size={14} />
            {run.isPending ? 'Analysing…' : 'Get AI Reply'}
          </button>
        </form>
      </div>

      {/* result */}
      <div className="space-y-4">
        {run.isPending && (
          <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-8 text-center animate-scale-in">
            <div className="relative inline-block mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
                <Sparkles size={22} className="text-violet-500 animate-pulse" />
              </div>
              <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-violet-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Searching knowledge base…</p>
            <div className="flex justify-center gap-1.5 mt-3">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        )}

        {out && (
          <div className="space-y-3 animate-slide-up">
            {out.escalation_needed && (
              <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl">
                <ShieldAlert size={15} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">Escalation Recommended</p>
                  <p className="text-xs text-red-600 mt-0.5">{out.human_handoff_note}</p>
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
              <div className="flex flex-wrap gap-2 mb-3">
                {out.ticket_category && <span className="badge-violet capitalize">{out.ticket_category}</span>}
                {out.priority_level  && (
                  <span className={`badge border capitalize ${PRIORITY_CFG[out.priority_level] || 'bg-slate-100 text-slate-500'}`}>
                    {out.priority_level} priority
                  </span>
                )}
              </div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Issue Summary</p>
              <p className="text-sm text-slate-700 leading-relaxed">{out.issue_summary}</p>
            </div>
            {out.suggested_reply && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Suggested Reply</p>
                <div className="bg-slate-50 rounded-xl p-3 text-sm text-slate-700 whitespace-pre-line leading-relaxed border border-slate-100">
                  {out.suggested_reply}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">AI-generated — review before sending.</p>
              </div>
            )}
          </div>
        )}

        {/* recent runs */}
        {runs.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
            <p className="font-bold text-slate-800 text-xs mb-3">Recent AI Replies ({runs.length})</p>
            <div className="space-y-1.5">
              {runs.slice(0, 4).map((r) => (
                <div key={r.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="p-1 rounded-md bg-violet-50 shrink-0">
                    <Sparkles size={10} className="text-violet-500" />
                  </div>
                  <p className="text-xs text-slate-600 truncate flex-1">{r.brief}</p>
                  {r.output?.ticket_category && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-50 text-violet-600 shrink-0 capitalize">
                      {r.output.ticket_category}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── conversation list ───────────────── */
function ConversationList() {
  const { data, isLoading } = useConversations();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');

  // Live updates — see services/inbox-service/src/realtime.js. Unlike the
  // per-channel page (which only cares about one channel_type), the
  // Unified Inbox shows every channel, so any update refetches.
  useSocketEvent('conversation:updated', () => {
    qc.invalidateQueries({ queryKey: ['conversations', 'list'] });
  }, [qc]);

  const all = Array.isArray(data) ? data : [];
  const filtered = all.filter((c) => {
    if (statusF && c.status !== statusF) return false;
    if (search.trim() && !(c.contact_name || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations…" className="input-premium pl-8 text-xs" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
              <X size={13} />
            </button>
          )}
        </div>
        <select value={statusF} onChange={(e) => setStatusF(e.target.value)} className="input-premium text-xs w-36">
          <option value="">All statuses</option>
          {['open','pending','handoff','resolved','closed'].map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[0,1,2].map((i) => <div key={i} className="h-16 skeleton rounded-2xl" />)}
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-slate-50 mb-3">
            <Inbox size={24} className="text-slate-300" />
          </div>
          <p className="text-sm font-medium text-slate-400">
            {search || statusF ? 'No conversations match your filters' : 'No conversations yet'}
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
        {filtered.map((c, i) => (
          <Link key={c.id} href={`/app/inbox/${c.id}`}
            className={`flex items-center gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors cursor-pointer
              ${i < filtered.length - 1 ? 'border-b border-slate-50' : ''}`}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center shrink-0">
              <User size={15} className="text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-semibold text-slate-800">{c.contact_name || 'Unknown'}</span>
                <span className="text-[10px] text-slate-400 capitalize bg-slate-100 px-1.5 py-0.5 rounded-md">{c.channel_type}</span>
              </div>
              <p className="text-xs text-slate-500 truncate">{c.last_message_preview || 'No messages'}</p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize block
                ${STATUS_CFG[c.status] || 'bg-slate-100 text-slate-500'}`}>
                {c.status}
              </span>
              <p className="text-[10px] text-slate-400 flex items-center gap-1 justify-end">
                <Clock size={10} /> {timeAgo(c.last_message_at)}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ── page ────────────────────────────── */
export default function InboxPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-0 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 text-slate-600 shadow-sm">
          <Inbox size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">Unified Inbox</h1>
          <p className="text-xs text-slate-400 mt-0.5">All conversations + AI support assistant</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* conversation list — 3 cols */}
        <div className="xl:col-span-3">
          <ConversationList />
        </div>

        {/* support agent — 2 cols */}
        <div className="xl:col-span-2">
          <div className="sticky top-24">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-violet-600 to-purple-700 p-5 mb-4">
              <div className="absolute inset-0 opacity-10"
                style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
              <div className="relative flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20 border border-white/30">
                  <Headphones size={18} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white">Support Agent</p>
                  <p className="text-violet-200 text-xs mt-0.5">Replies grounded in your knowledge base</p>
                </div>
                <div className="ml-auto flex items-center gap-1.5 bg-white/10 rounded-xl px-2.5 py-1 border border-white/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span className="text-white text-[10px] font-medium">Online</span>
                </div>
              </div>
            </div>
            <SupportAgentPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
