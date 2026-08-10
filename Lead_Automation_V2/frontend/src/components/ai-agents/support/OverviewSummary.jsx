'use client';
import { useMemo } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Ticket, ShieldAlert, Sparkles, Database, TrendingUp, CalendarClock, CheckCircle2,
} from 'lucide-react';
import { useAgentAnalytics, useKnowledgeSources, useSupportRuns } from '@/lib/queries/aiAgents';
import { useConversations } from '@/lib/queries/crm';

/**
 * Task 1/5 (Support Agent — Overview): three horizontal rows of stat cards
 * (overall / today / month), at least one with a real graphical trend.
 *
 * Data sources, and why:
 *  - GET /ai-agents/analytics?range=all — added an 'all' bucket to the
 *    existing range map (analytics.py's _RANGE_TO_DAYS) rather than
 *    fabricating an "all-time" number from the 20-row-capped /support/runs
 *    list. Its `series` (per-day counts) also gives us "today" and "this
 *    month" for free from the SAME call, filtered client-side by date —
 *    one request instead of three.
 *  - GET /conversations — no `created_at` field is exposed (only
 *    `last_message_at`; see inbox-service's route), so "tickets opened
 *    today" is honestly labelled "Active Tickets Today" and measured by
 *    last-activity-today rather than claimed as a creation-date metric it
 *    isn't backed by.
 *  - Knowledge base chunk count — from useKnowledgeSources('support'),
 *    same computation SupportWorkspace's KPI row already uses.
 *
 * Anything with no real backing renders '—', per this codebase's existing
 * convention (see aiAgents.js's fmt() helper) rather than a fabricated number.
 */

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function thisMonthPrefix() {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function fmtNum(n) {
  return n === null || n === undefined || Number.isNaN(n) ? '—' : n.toLocaleString();
}

function StatCard({ icon: Icon, label, value, sublabel, sparkline, tone = 'violet' }) {
  const toneMap = {
    violet:  { bg: 'from-violet-50 to-purple-100', text: 'text-violet-600', line: '#7c3aed' },
    emerald: { bg: 'from-emerald-50 to-teal-100',  text: 'text-emerald-600', line: '#059669' },
    amber:   { bg: 'from-amber-50 to-orange-100',  text: 'text-amber-600', line: '#d97706' },
    slate:   { bg: 'from-slate-50 to-slate-100',   text: 'text-slate-500', line: '#64748b' },
  };
  const cfg = toneMap[tone] || toneMap.violet;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-4 min-w-[160px] flex-1">
      <div className="flex items-center gap-2 mb-3">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${cfg.bg} ${cfg.text}`}>
          <Icon size={13} />
        </div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide leading-none">{label}</p>
      </div>
      <p className="text-xl font-bold text-slate-800 leading-none tabular-nums">{fmtNum(value)}</p>
      {sublabel && <p className="text-[11px] text-slate-400 mt-1">{sublabel}</p>}
      {sparkline && (
        <div className="h-8 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline}>
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                labelFormatter={(d) => d}
                formatter={(v) => [v, 'runs']}
              />
              <Line type="monotone" dataKey="count" stroke={cfg.line} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function CardRow({ title, children }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</p>
      <div className="flex flex-col sm:flex-row gap-3 overflow-x-auto pb-1">
        {children}
      </div>
    </div>
  );
}

export default function OverviewSummary() {
  // 'all' is an additive range this task added to analytics.py's range
  // map (36,500 days) — the existing '24h'/'7d'/'30d'/'90d' values are
  // untouched, so every other caller of useAgentAnalytics is unaffected.
  const { data: analytics, isLoading: analyticsLoading } = useAgentAnalytics('all');
  const { data: convoData } = useConversations();
  const { data: knowledge } = useKnowledgeSources('support');
  // /support/runs is capped server-side at its own default page (see
  // ai-agent-backend's recent_runs()) — fine for "today's escalations",
  // which is realistically well under that cap for almost any org.
  const { data: runsData } = useSupportRuns({ limit: 200 });

  const conversations = Array.isArray(convoData) ? convoData : [];
  const chunkCount = Array.isArray(knowledge)
    ? knowledge.reduce((n, s) => n + (s.chunk_count || 0), 0)
    : undefined;

  const supportSeries = useMemo(
    () => (analytics?.series || []).filter((s) => s.agentType === 'support'),
    [analytics]
  );

  const todayCount = useMemo(
    () => supportSeries.find((s) => s.date === todayISO())?.count ?? 0,
    [supportSeries]
  );
  const monthCount = useMemo(
    () => supportSeries.filter((s) => s.date.startsWith(thisMonthPrefix())).reduce((n, s) => n + s.count, 0),
    [supportSeries]
  );
  // Last calendar month, for the "+N% vs last month" delta.
  const lastMonthCount = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    const prefix = d.toISOString().slice(0, 7);
    return supportSeries.filter((s) => s.date.startsWith(prefix)).reduce((n, s) => n + s.count, 0);
  }, [supportSeries]);

  const monthDelta = lastMonthCount > 0
    ? Math.round(((monthCount - lastMonthCount) / lastMonthCount) * 100)
    : null;

  const sparkline30d = useMemo(
    () => supportSeries.slice(-30).map((s) => ({ date: s.date.slice(5), count: s.count })),
    [supportSeries]
  );

  const activeToday = useMemo(
    () => conversations.filter((c) => c.last_message_at && c.last_message_at.slice(0, 10) === todayISO()).length,
    [conversations]
  );
  const resolvedToday = useMemo(
    () => conversations.filter((c) => c.status === 'resolved' && c.last_message_at?.slice(0, 10) === todayISO()).length,
    [conversations]
  );
  const runs = Array.isArray(runsData) ? runsData : [];
  const escalationsToday = useMemo(
    () => runs.filter((r) => r.output?.escalation_needed && r.created_at?.slice(0, 10) === todayISO()).length,
    [runs]
  );

  const totals = analytics?.totals;
  const loading = analyticsLoading;

  return (
    <div className="space-y-6">
      {/* Overall (all-time) */}
      <CardRow title="Overall Summary (All-time)">
        <StatCard icon={Ticket} label="Support Runs Handled" value={loading ? undefined : totals?.support} tone="violet"
          sparkline={sparkline30d.length ? sparkline30d : undefined} />
        <StatCard icon={ShieldAlert} label="Total Escalations" value={loading ? undefined : totals?.supportEscalations} tone="amber" />
        <StatCard icon={Sparkles} label="AI-Drafted Replies" value={loading ? undefined : totals?.support} tone="emerald"
          sublabel="Every support run drafts a reply" />
        <StatCard icon={Database} label="Knowledge Base Chunks" value={chunkCount} tone="slate" />
      </CardRow>

      {/* Today */}
      <CardRow title="Today">
        <StatCard icon={Sparkles} label="AI Replies Drafted" value={todayCount} tone="violet" />
        <StatCard icon={CalendarClock} label="Active Tickets Today" value={activeToday} tone="slate"
          sublabel="By last activity — conversations expose no creation date" />
        <StatCard icon={ShieldAlert} label="Escalations Today" value={escalationsToday} tone="amber" />
        <StatCard icon={CheckCircle2} label="Resolved Today" value={resolvedToday} tone="emerald" />
      </CardRow>

      {/* Monthly */}
      <CardRow title="This Month">
        <StatCard icon={Sparkles} label="AI Replies Drafted" value={monthCount} tone="violet"
          sublabel={monthDelta === null ? undefined : `${monthDelta >= 0 ? '+' : ''}${monthDelta}% vs last month`}
          sparkline={sparkline30d.length ? sparkline30d : undefined} />
        <StatCard icon={TrendingUp} label="Vs. Last Month" value={lastMonthCount > 0 ? monthDelta : undefined} tone="emerald"
          sublabel={lastMonthCount > 0 ? '% change in AI runs' : 'No data for last month yet'} />
        <StatCard icon={CalendarClock} label="Active Tickets" value={
          conversations.filter((c) => c.last_message_at?.slice(0, 7) === thisMonthPrefix()).length
        } tone="slate" />
        <StatCard icon={CheckCircle2} label="Resolved" value={
          conversations.filter((c) => c.status === 'resolved' && c.last_message_at?.slice(0, 7) === thisMonthPrefix()).length
        } tone="emerald" />
      </CardRow>
    </div>
  );
}
