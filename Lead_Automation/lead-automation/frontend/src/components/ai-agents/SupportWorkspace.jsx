'use client';
import { useMemo, useState } from 'react';
import {
  Headphones, Sparkles, AlertTriangle, MessageSquare, Inbox,
  Database, ShieldAlert, ListChecks, HelpCircle, BookOpen,
  Clock, User, Hash, ChevronRight, Zap, UserCheck,
} from 'lucide-react';
import {
  useRunSupportAgent, useSupportRuns, useAgentAnalytics, useKnowledgeSources,
} from '@/lib/queries/aiAgents';
import { useConversations } from '@/lib/queries/crm';
import KpiCard from './KpiCard';
import KnowledgeUploadPanel from './KnowledgeUploadPanel';

/* ── helpers ─────────────────────────────────────────────── */
function timeAgo(iso) {
  if (!iso) return '—';
  const m = Math.round((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const PRIORITY_BADGE = {
  urgent: 'bg-red-100 text-red-700 border-red-200',
  high:   'bg-red-50 text-red-600 border-red-100',
  medium: 'bg-amber-50 text-amber-700 border-amber-100',
  low:    'bg-slate-100 text-slate-500 border-slate-200',
};
const STATUS_BADGE = {
  open:     'bg-blue-50 text-blue-700',
  pending:  'bg-amber-50 text-amber-700',
  handoff:  'bg-fuchsia-50 text-fuchsia-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  closed:   'bg-slate-100 text-slate-500',
};
const CSAT_COLOR = { low: 'text-emerald-600', medium: 'text-amber-600', high: 'text-red-600' };

function isEmpty(v) {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'string') return v.trim() === '';
  return false;
}

/* ── sub-components ──────────────────────────────────────── */
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

/* ── main component ──────────────────────────────────────── */
export default function SupportWorkspace() {
  const run                   = useRunSupportAgent();
  const { data: runsData }    = useSupportRuns();
  const { data: convoData }   = useConversations();
  const { data: analytics }   = useAgentAnalytics('7d');
  const { data: knowledge }   = useKnowledgeSources('support');

  const [query, setQuery]         = useState('');
  const [customerName, setCName]  = useState('');

  const conversations = Array.isArray(convoData) ? convoData  : [];
  const runs          = Array.isArray(runsData)  ? runsData   : [];
  const chunkCount    = Array.isArray(knowledge)
    ? knowledge.reduce((n, s) => n + (s.chunk_count || 0), 0)
    : undefined;

  const openCount    = useMemo(() =>
    conversations.filter((c) => ['open','new','pending','handoff'].includes(c.status)).length,
    [conversations]);
  const escalations  = useMemo(() =>
    runs.filter((r) => r.output?.escalation_needed),
    [runs]);

  const submit = (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    run.mutate({
      brief: query.trim(),
      customer_name: customerName.trim() || null,
      session_id: `dashboard:${customerName.trim() || 'anonymous'}`,
    });
  };

  const out = run.data;

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Hero banner ─────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-violet-600 via-violet-700 to-purple-700 p-6 shadow-violet">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 70% 30%, white 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-pink-400 to-violet-400" />
        <div className="relative flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30">
            <Headphones size={22} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-lg">Support Agent</h3>
            <p className="text-violet-200 text-sm mt-0.5">Resolve issues, retain customers, and escalate intelligently</p>
          </div>
          <div className="ml-auto hidden sm:flex items-center gap-2 bg-white/10 rounded-xl px-3 py-1.5 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
            <span className="text-white text-xs font-medium">Agent Online</span>
          </div>
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Inbox,      label: 'Open Tickets',      tone: 'brand',   value: openCount,                                loading: convoData === undefined },
          { icon: ShieldAlert,label: 'Escalations (7d)',  tone: 'amber',   value: analytics?.totals?.supportEscalations,    loading: !analytics },
          { icon: Sparkles,   label: 'AI Replies Drafted',tone: 'emerald', value: runs.length,                              loading: runsData === undefined },
          { icon: Database,   label: 'Knowledge Chunks',  tone: 'violet',  value: chunkCount,                               loading: chunkCount === undefined },
        ].map(({ icon, label, tone, value, loading }, i) => (
          <div key={label} className="animate-slide-up" style={{ animationDelay: `${i * 60}ms` }}>
            <KpiCard icon={icon} label={label} tone={tone} value={value} loading={loading} />
          </div>
        ))}
      </div>

      {/* ── Escalation alerts ───────────────────────────── */}
      {escalations.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5 animate-slide-up">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-red-100 text-red-600">
              <ShieldAlert size={15} />
            </div>
            <div>
              <h4 className="font-bold text-red-800 text-sm">Escalation Alerts</h4>
              <p className="text-[11px] text-red-400">{escalations.length} unreviewed escalation{escalations.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="space-y-2">
            {escalations.slice(0, 4).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 bg-white rounded-xl px-4 py-2.5 border border-red-100">
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

      {/* ── Main grid ───────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">

        {/* LEFT COLUMN — ticket queue + AI assistant ──── */}
        <div className="xl:col-span-2 space-y-6">

          {/* Ticket Queue */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                  <MessageSquare size={15} />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">Ticket Queue</h4>
                  <p className="text-[11px] text-slate-400">Live from Unified Inbox — {openCount} open</p>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-lg">
                {conversations.length} total
              </span>
            </div>

            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-2xl bg-slate-50 mb-3">
                  <Inbox size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-400">No conversations yet</p>
                <p className="text-xs text-slate-300 mt-1">Tickets from all channels appear here</p>
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
                    </tr>
                  </thead>
                  <tbody>
                    {conversations.slice(0, 10).map((c) => (
                      <tr key={c.id} className="group cursor-pointer">
                        <td>
                          <span className="font-mono text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                            #{c.id.slice(0, 8)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-100 to-purple-200 flex items-center justify-center shrink-0">
                              <User size={11} className="text-violet-600" />
                            </div>
                            <span className="font-medium text-slate-700 text-xs">{c.contact_name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td>
                          <span className="capitalize text-xs text-slate-500">{c.channel_type}</span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-500 max-w-[180px] truncate block">
                            {c.last_message_preview || '—'}
                          </span>
                        </td>
                        <td>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize
                            ${STATUS_BADGE[c.status] || 'bg-slate-100 text-slate-500'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Clock size={10} />
                            {timeAgo(c.last_message_at)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI Support Assistant */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center gap-2.5 mb-1">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                <Sparkles size={15} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">AI Support Assistant</h4>
                <p className="text-[11px] text-slate-400">Paste a customer message — AI drafts a reply from your knowledge base</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent my-4" />

            <form onSubmit={submit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Customer Name
                </label>
                <input
                  value={customerName}
                  onChange={(e) => setCName(e.target.value)}
                  placeholder="Optional"
                  className="input-premium"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Customer Message *
                </label>
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

          {/* Loading state */}
          {run.isPending && (
            <div className="bg-white rounded-2xl border border-violet-100 shadow-card p-8 text-center animate-scale-in">
              <div className="relative inline-block mb-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
                  <Sparkles size={24} className="text-violet-500 animate-pulse" />
                </div>
                <div className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-violet-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Searching knowledge base…</p>
              <p className="text-xs text-slate-400 mt-1">Drafting a reply grounded in your documents</p>
              <div className="flex items-center justify-center gap-1.5 mt-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          )}

          {/* Results */}
          {out && (
            <div className="space-y-4 animate-slide-up">

              {/* Escalation alert */}
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

              {/* Classification row */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-3">Ticket Classification</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {out.ticket_category && (
                    <span className="badge-violet capitalize">{out.ticket_category}</span>
                  )}
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
                <ResultSection icon={MessageSquare} title="Suggested Reply">
                  <div className="bg-slate-50 rounded-xl p-4 text-sm text-slate-700 whitespace-pre-line border border-slate-100 leading-relaxed">
                    {out.suggested_reply}
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="w-1 h-1 rounded-full bg-amber-400" />
                    <p className="text-[11px] text-slate-400">AI-generated — review before sending via Unified Inbox.</p>
                  </div>
                  {out.knowledge_base_references?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Database size={10} className="text-violet-400" />
                      <p className="text-[10px] text-violet-500">
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

        {/* RIGHT COLUMN — recent AI replies + knowledge base ─ */}
        <div className="space-y-6">

          {/* Recent AI Replies */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600">
                <BookOpen size={15} />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Recent AI Replies</h4>
                <p className="text-[11px] text-slate-400">{runs.length} drafted so far</p>
              </div>
            </div>

            {!runs.length ? (
              <div className="text-center py-8">
                <div className="p-3 rounded-xl bg-slate-50 w-fit mx-auto mb-2">
                  <Sparkles size={18} className="text-slate-300" />
                </div>
                <p className="text-xs font-medium text-slate-400">No replies drafted yet</p>
                <p className="text-[11px] text-slate-300 mt-0.5">Use the assistant panel to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.slice(0, 6).map((r, i) => (
                  <div key={r.id}
                    className="group p-3 rounded-xl bg-slate-50 hover:bg-violet-50/40 border border-transparent hover:border-violet-100 transition-all duration-150 cursor-pointer animate-fade-in"
                    style={{ animationDelay: `${i * 50}ms` }}>
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 font-semibold">
                          escalated
                        </span>
                      )}
                      {r.output?.priority_level && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold capitalize
                          ${PRIORITY_BADGE[r.output.priority_level] || 'bg-slate-100 text-slate-500'}`}>
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

          <KnowledgeUploadPanel agentType="support" />
        </div>
      </div>
    </div>
  );
}
