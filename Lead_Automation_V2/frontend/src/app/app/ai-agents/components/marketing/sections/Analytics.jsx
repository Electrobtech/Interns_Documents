'use client';
/** Analytics — capability-level metrics from Orbq. Campaign delivery stats
 *  (reach, CTR, ROAS) belong to campaign-service and are not faked here. */
import { useState } from 'react';
import { PieChart } from 'lucide-react';
import { useAgentAnalytics } from '@/lib/queries/aiAgents';
import { Card, SectionTitle, Stat, DataTable, Badge, EmptyState, ProgressBar, NotConnected } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip, ViewSwitcher, SplitPane,
} from '../HubUI';

const RANGES = ['24h', '7d', '30d', '90d'];

export default function Analytics() {
  const [range, setRange] = useState('7d');
  const { data, isLoading } = useAgentAnalytics(range);

  const caps = (data?.capabilities || []).filter((c) => c.workspace === 'marketing');
  const series = data?.series?.marketing || [];
  const totalRuns = series.reduce((n, p) => n + (p.runs || 0), 0);
  const totalTokens = series.reduce((n, p) => n + (p.tokens || 0), 0);
  const scored = caps.filter((c) => c.confidence != null);
  const avgConf = scored.length ? scored.reduce((n, c) => n + c.confidence, 0) / scored.length : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Agent activity — how often the Marketing Agent ran and how confident it was. Campaign delivery performance is a separate surface and is not shown here."
      />

      <Toolbar
        right={
          <div className="flex items-center gap-1">
            {['24h', '7d', '30d', '90d'].map((r) => (
              <ToolButton key={r} active={range === r} onClick={() => setRange(r)}>{r}</ToolButton>
            ))}
          </div>
        }
      >
        <span className="text-[12px] text-slate-500 px-1">Agent activity across the marketing workspace</span>
      </Toolbar>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-8">
          <Stat label="Runs" value={isLoading ? null : totalRuns} />
          <Stat label="Avg confidence" value={avgConf != null ? Math.round(avgConf * 100) : null} suffix="%" />
          <Stat label="Tokens" value={isLoading ? null : totalTokens} />
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`text-xs px-2.5 py-1.5 rounded-lg transition-colors ${
                r === range ? 'bg-rose-50 text-rose-700 font-semibold' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <Card className="p-5">
        <SectionTitle
          title="Capability performance"
          subtitle="Which skills get used, how confident they are, and how often they fail"
        />
        <DataTable
          columns={[
            { key: 'capability', label: 'Capability', render: (r) => <span className="font-medium">{r.capability}</span> },
            { key: 'invocations', label: 'Runs' },
            {
              key: 'confidence',
              label: 'Confidence',
              render: (r) => (
                <div className="w-24">
                  <div className="text-[11px] mb-1">
                    {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '\u2014'}
                  </div>
                  <ProgressBar value={(r.confidence || 0) * 100} />
                </div>
              ),
            },
            { key: 'avgDurationMs', label: 'Avg time', render: (r) => `${((r.avgDurationMs || 0) / 1000).toFixed(1)}s` },
            {
              key: 'failures',
              label: 'Failures',
              render: (r) => (r.failures ? <Badge tone="red">{r.failures}</Badge> : <span className="text-slate-300">0</span>),
            },
          ]}
          rows={caps}
          empty={<EmptyState icon={PieChart} title="No runs in this window" body="Use any AI section and metrics appear here." />}
        />
      </Card>

      <Card className="p-5">
        <SectionTitle title="Campaign delivery" subtitle="Reach, CTR, ROAS and spend" />
        <NotConnected what="Delivery and revenue metrics" where="campaign-service" />
      </Card>
    </div>
  );
}
