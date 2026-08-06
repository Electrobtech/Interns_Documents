'use client';
/**
 * Marketing Dashboard — toolbar, KPI grid, and the AI activity panels.
 *
 * The KPI grid follows the reference layout, but every tile is bound to a real
 * source. Delivery/spend metrics (CTR, CPC, CPM, ROAS, revenue) have no source
 * in this stack — no ad platform is connected — so those tiles render "—" with
 * a "needs an ad account" note instead of a plausible number. A fabricated
 * figure on a dashboard is indistinguishable from a measured one, which is the
 * one failure mode worth engineering against.
 */
import { useState } from 'react';
import {
  Megaphone, Sparkles, CheckCircle2, Play, CalendarClock, FileEdit,
  RefreshCw, AlertTriangle, ChevronRight, Download, Maximize2, Users,
  MousePointerClick, DollarSign, Eye, TrendingUp, Target,
} from 'lucide-react';

import { useAgentStatus, useAgentRuns, usePendingApprovals } from '@/lib/queries/aiAgents';
import { useMarketingDashboard } from '@/lib/queries/marketing';
import {
  Card, Stat, SectionTitle, Badge, Button, EmptyState, ConfidenceMeter, KpiCard, fmt,
} from '../MarketingUI';
import {
  ChartCard, AreaChart, BarList, Funnel, Donut, DemoToggle, DemoBanner,
} from '../Charts';
import {
  PageHeader, AIHero, QuickActions, KpiStrip, ActivityFeed, InsightCard,
} from '../HubUI';

const RANGES = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last quarter' },
];

export default function MarketingDashboard() {
  const [range, setRange] = useState('30d');

  const { data: status, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useAgentStatus();
  const { data: runs } = useAgentRuns('marketing', { limit: 6 });
  const { data: approvals } = usePendingApprovals('marketing');
  // One request for every marketing figure on this page. Previously this was
  // three hooks (broadcasts + content + reports) with the counts derived in the
  // component, which meant the dashboard's numbers depended on which other tabs
  // had been visited and cached.
  const { data: hub, refetch: refetchHub, isFetching: hubFetching } = useMarketingDashboard();

  const agent = status?.agents?.find((a) => a.id === 'marketing');
  const summary = status?.summary ?? {};

  const campaignStats = hub?.campaigns ?? {};
  const broadcastStats = hub?.broadcasts ?? {};
  const contentStats = hub?.content ?? {};
  const approvalStats = hub?.approvals ?? {};
  const activity = hub?.recent_activity ?? [];

  // Status breakdowns are real counts already in the payload — no extra fetch.
  const TONES = ['violet', 'green', 'amber', 'blue', 'slate', 'red'];
  const toSeries = (byStatus) =>
    Object.entries(byStatus || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, tone: TONES[i % TONES.length] }));
  const campaignMix = toSeries(campaignStats.by_status);
  const broadcastMix = toSeries(broadcastStats.by_status);
  const [aiOpenHint, setAiOpenHint] = useState(false);

  // Written from real counts only. With nothing to report it says so, rather
  // than manufacturing "3 campaigns need attention".
  const heroMessage = (() => {
    if (isLoading) return null;
    const bits = [];
    if (approvalStats.pending_count) bits.push(`${approvalStats.pending_count} item(s) awaiting your approval`);
    if (campaignStats.draft) bits.push(`${campaignStats.draft} campaign(s) still in draft`);
    if (contentStats.pending_approval) bits.push(`${contentStats.pending_approval} content piece(s) pending publish`);
    if (!bits.length) return 'Nothing needs your attention right now. Delivery and spend figures stay blank until an ad account or send provider is connected.';
    return `${bits.join(' · ')}.`;
  })();

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ range, generated_at: new Date().toISOString(), ...(hub || {}) }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing-dashboard-${range}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              icon={RefreshCw}
              onClick={() => { refetch(); refetchHub(); }}
              disabled={isFetching || hubFetching}
            >
              {isFetching || hubFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
            <DemoToggle />
            <Button icon={Download} onClick={exportJson}>Export</Button>
            <Button
              icon={Maximize2}
              onClick={() => document.documentElement.requestFullscreen?.()}
            >
              Full screen
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">Date range</span>
            <select
              value={range}
              onChange={(e) => setRange(e.target.value)}
              className="text-sm rounded-xl border border-[#E4E8F0] px-3 py-2 outline-none text-slate-700
                         focus:border-rose-300 focus:ring-2 focus:ring-rose-100 transition-all"
            >
              {RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mt-3">
          {isError
            ? 'AI service unreachable'
            : dataUpdatedAt
              ? `Live · updated ${new Date(dataUpdatedAt).toLocaleTimeString()}`
              : 'Loading…'}
        </p>
      </Card>

      <DemoBanner />

      {isError && (
        <Card className="p-4 border-red-200 bg-red-50/60">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">Cannot reach the AI service</p>
              <p className="text-xs text-red-500 mt-0.5">
                Figures below are unavailable. Nothing shown is cached or estimated.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ── Hero: AI summary + quick actions ──────────────────────── */}
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <AIHero
          title="Marketing agent summary"
          updatedAt={dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null}
          score={isLoading ? null : agent?.confidence ?? null}
          metrics={[
            { label: 'Campaigns', value: campaignStats.total ?? null },
            { label: 'Running', value: campaignStats.active ?? null },
            { label: 'Runs today', value: isLoading ? null : agent?.completed ?? null },
            { label: 'Revenue MTD', value: null, note: 'needs CRM' },
          ]}
          message={heroMessage}
          confidence={isLoading ? null : (agent?.confidence ?? null) / 100 || null}
          actions={
            <>
              <Button variant="primary" icon={Sparkles} onClick={() => setAiOpenHint(true)}>
                Ask the agent
              </Button>
              {approvalStats.pending_count > 0 && (
                <Button icon={CheckCircle2}>
                  {approvalStats.pending_count} awaiting approval
                </Button>
              )}
            </>
          }
        />

        <QuickActions
          actions={[
            { icon: Megaphone, label: 'New campaign', sub: 'Plan & schedule', tone: 'violet' },
            { icon: Users, label: 'New broadcast', sub: 'One-off send', tone: 'green' },
            { icon: FileEdit, label: 'Generate content', sub: 'AI studio', tone: 'blue' },
            { icon: TrendingUp, label: 'Generate report', sub: 'From live data', tone: 'amber' },
            { icon: Target, label: 'Build audience', sub: 'Targeting rule', tone: 'violet' },
            { icon: Eye, label: 'Knowledge base', sub: 'Sources & RAG', tone: 'slate' },
          ]}
        />
      </div>

      {/* ── KPI strip ─────────────────────────────────────────────── */}
      <KpiStrip
        items={[
          { label: 'Total campaigns',  value: campaignStats.total ?? null,     tone: 'violet' },
          { label: 'Running',          value: campaignStats.active ?? null,    tone: 'green' },
          { label: 'Scheduled',        value: campaignStats.scheduled ?? null, tone: 'amber' },
          { label: 'Drafts',           value: campaignStats.draft ?? null,     tone: 'slate' },
          { label: 'Broadcasts',       value: broadcastStats.total ?? null,    tone: 'blue' },
          { label: 'Content pieces',   value: contentStats.total ?? null,      tone: 'violet' },
          { label: 'Reports',          value: hub?.reports?.total ?? null,     tone: 'green' },
          { label: 'Agent runs today', value: isLoading ? null : agent?.completed ?? null, tone: 'violet' },
          { label: 'Avg confidence',   value: isLoading ? null : agent?.confidence ?? null, suffix: '%', tone: 'blue' },
          { label: 'Awaiting approval',value: isLoading ? null : summary.pendingApprovals ?? null, tone: 'amber' },
          { label: 'Knowledge sources',value: isLoading ? null : summary.knowledgeSources ?? null, tone: 'slate' },
          { label: 'Credits used',     value: isLoading ? null : summary.creditsToday ?? null, tone: 'slate' },
          { label: 'CTR',  value: null, tone: 'slate', note: 'needs ad account' },
          { label: 'CPC',  value: null, tone: 'slate', note: 'needs ad account' },
          { label: 'ROAS', value: null, tone: 'slate', note: 'needs ad account' },
        ]}
      />

      {/* ── Row 4: delivery metrics — no source, shown honestly ───── */}
      <Card className="p-4 hidden">
        <SectionTitle
          title="Delivery & spend"
          subtitle="Requires a connected ad account or send provider. Nothing is estimated."
        />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'CTR', icon: MousePointerClick },
            { label: 'CPC', icon: DollarSign },
            { label: 'CPM', icon: Eye },
            { label: 'ROAS', icon: TrendingUp },
          ].map((m) => (
            <KpiCard
              key={m.label}
              label={m.label}
              value={null}
              icon={m.icon}
              tone="slate"
              note="needs an ad account"
            />
          ))}
        </div>
      </Card>

      {/* ── Charts ──────────────────────────────────────────────────
          Campaign/broadcast mix comes from Orbq's own tables and is live.
          Everything needing spend or engagement data renders its frame with
          a reason, or a clearly-striped sample while Demo data is on. */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Campaign mix"
          subtitle="By status · live from your campaigns table"
          series={campaignMix}
          height={150}
        >
          {(d) => <Donut data={d} />}
        </ChartCard>

        <ChartCard
          title="Broadcast mix"
          subtitle="By status · live from your broadcasts table"
          series={broadcastMix}
          height={150}
        >
          {(d) => <BarList data={d} />}
        </ChartCard>

        <ChartCard
          title="Delivery funnel"
          subtitle="Sent → delivered → read → clicked"
          series={[]}
          needs="No messages have been sent yet. This fills from delivery events as broadcasts go out."
          sample={[
            { label: 'Sent', value: 12480 },
            { label: 'Delivered', value: 11840 },
            { label: 'Read', value: 7020 },
            { label: 'Clicked', value: 2140 },
            { label: 'Replied', value: 610 },
          ]}
        >
          {(d) => <Funnel stages={d} />}
        </ChartCard>

        <ChartCard
          title="Revenue vs target"
          subtitle="Monthly performance"
          series={[]}
          needs="Revenue attribution lives in the CRM, not in Orbq's marketing schema."
          sample={[
            { label: 'Mar', value: 420 }, { label: 'Apr', value: 510 },
            { label: 'May', value: 480 }, { label: 'Jun', value: 640 },
            { label: 'Jul', value: 720 }, { label: 'Aug', value: 842 },
          ]}
        >
          {(d) => <AreaChart data={d} tone="green" valueFormat={(v) => `₹${v}k`} />}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* ── Recent agent runs ───────────────────────────────────── */}
        <Card className="p-5 xl:col-span-2">
          <SectionTitle title="Recent agent runs" subtitle="What the Marketing Agent actually did" />
          {!runs?.length ? (
            <EmptyState
              icon={Sparkles}
              title="No runs yet"
              body="Ask the Marketing Agent for a campaign plan, SEO brief, or persona and it will appear here with its full reasoning trace."
            />
          ) : (
            <div className="space-y-2">
              {runs.map((r) => (
                <div
                  key={r.id}
                  className="flex items-start gap-3 p-3 rounded-xl border border-[#EEF1F6] hover:bg-slate-50/70 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-700 truncate">{r.request}</p>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
                      {(r.capabilities_used || []).map((c) => (
                        <span
                          key={c}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500"
                        >
                          {c}
                        </span>
                      ))}
                      {r.degraded && <Badge tone="amber">ungrounded</Badge>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 w-20">
                    <div
                      className="text-xs font-semibold text-slate-600"
                      style={{ fontFamily: "'JetBrains Mono', monospace" }}
                    >
                      {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '—'}
                    </div>
                    <div className="mt-1">
                      <ConfidenceMeter value={r.confidence != null ? r.confidence * 100 : null} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Pending approvals ───────────────────────────────────── */}
        <Card className="p-5">
          <SectionTitle
            title="Pending approvals"
            subtitle="Nothing reaches a customer without a human"
            action={approvals?.length ? <Badge tone="amber">{approvals.length}</Badge> : null}
          />
          {!approvals?.length ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nothing waiting"
              body="Actions the agent proposes — publishing a campaign, sending copy — queue here for review."
            />
          ) : (
            <div className="space-y-2">
              {approvals.slice(0, 5).map((a) => (
                <div key={a.id} className="p-3 rounded-xl border border-[#EEF1F6]">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[13px] font-medium text-slate-700 line-clamp-2">{a.summary}</p>
                    <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-0.5" />
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <Badge tone="violet">{a.action_type}</Badge>
                    {!a.reversible && <Badge tone="red">irreversible</Badge>}
                    {a.confidence != null && (
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {Math.round(a.confidence * 100)}% confident
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ── Recent activity ─────────────────────────────────────────
          Merged from campaign status transitions, generated reports, and
          broadcasts. Per-recipient delivery events are excluded on purpose:
          at send volume they would drown everything else, and they belong on
          a campaign's own Delivery tab. */}
      <Card className="p-4">
        <SectionTitle title="Recent activity" subtitle="Across campaigns, broadcasts, and reports" />
        {activity.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nothing has happened yet"
            body="Create a campaign or generate a report and it shows up here."
          />
        ) : (
          <ol className="space-y-2.5">
            {activity.map((a) => (
              <li key={`${a.kind}-${a.entity_id}-${a.at}`} className="flex items-start gap-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                  style={{ background: ACTIVITY_TONE[a.kind] || '#94A3B8' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-slate-700 truncate">
                    <span className="font-medium">{a.title}</span>
                    <span className="text-slate-400"> · {a.detail}</span>
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 flex-shrink-0">
                  {new Date(a.at).toLocaleString(undefined, {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

const ACTIVITY_TONE = {
  campaign_status: '#E11D48',
  broadcast: '#3B6EF0',
  report: '#059669',
};
