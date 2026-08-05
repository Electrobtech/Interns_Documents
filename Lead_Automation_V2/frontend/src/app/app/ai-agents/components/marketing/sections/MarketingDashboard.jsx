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
import { useMemo, useState } from 'react';
import {
  Megaphone, Sparkles, CheckCircle2, Play, CalendarClock, FileEdit,
  RefreshCw, AlertTriangle, ChevronRight, Download, Maximize2, Users,
  MousePointerClick, DollarSign, Eye, TrendingUp, Target,
} from 'lucide-react';

import { useAgentStatus, useAgentRuns, usePendingApprovals } from '@/lib/queries/aiAgents';
import { useCampaigns } from '@/lib/queries/campaigns';
import { useBroadcasts, useContent, useReports } from '@/lib/queries/marketing';
import {
  Card, Stat, SectionTitle, Badge, Button, EmptyState, ConfidenceMeter, KpiCard, fmt,
} from '../MarketingUI';

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
  const { data: campaignPage } = useCampaigns({ limit: 200 });
  const { data: broadcasts = [] } = useBroadcasts();
  const { data: content = [] } = useContent();
  const { data: reports = [] } = useReports();

  const agent = status?.agents?.find((a) => a.id === 'marketing');
  const summary = status?.summary ?? {};

  const campaigns = campaignPage?.items || [];
  const counts = useMemo(() => {
    const by = {};
    campaigns.forEach((c) => { by[c.status] = (by[c.status] || 0) + 1; });
    return by;
  }, [campaigns]);

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ range, generated_at: new Date().toISOString(), campaigns: counts, broadcasts: broadcasts.length, content: content.length }, null, 2)],
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
            <Button icon={RefreshCw} onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>
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
                         focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
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

      {/* ── Row 1: campaign counts (real, from the campaigns table) ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total campaigns"     value={campaigns.length}       icon={Megaphone}     tone="violet" />
        <KpiCard label="Running campaigns"   value={counts.running || 0}    icon={Play}          tone="green" />
        <KpiCard label="Scheduled campaigns" value={counts.scheduled || 0}  icon={CalendarClock} tone="amber" />
        <KpiCard label="Draft campaigns"     value={counts.draft || 0}      icon={FileEdit}      tone="slate" />
      </div>

      {/* ── Row 2: AI activity (real, from agent executions) ───────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Agent runs today"  value={isLoading ? null : agent?.completed}          icon={Sparkles}    tone="violet" />
        <KpiCard label="Avg confidence"    value={isLoading ? null : agent?.confidence} suffix="%" icon={Target}   tone="blue" />
        <KpiCard label="Awaiting approval" value={isLoading ? null : summary.pendingApprovals}  icon={CheckCircle2} tone="amber" />
        <KpiCard label="Knowledge sources" value={isLoading ? null : summary.knowledgeSources}  icon={Eye}         tone="slate" />
      </div>

      {/* ── Row 3: assets produced (real) ─────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Broadcasts"       value={broadcasts.length} icon={Users}              tone="blue" />
        <KpiCard label="Content pieces"   value={content.length}    icon={FileEdit}           tone="violet" />
        <KpiCard label="Reports"          value={reports.length}    icon={TrendingUp}         tone="green" />
        <KpiCard label="Credits used"     value={isLoading ? null : summary.creditsToday} icon={DollarSign} tone="slate" />
      </div>

      {/* ── Row 4: delivery metrics — no source, shown honestly ───── */}
      <Card className="p-4">
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
    </div>
  );
}
