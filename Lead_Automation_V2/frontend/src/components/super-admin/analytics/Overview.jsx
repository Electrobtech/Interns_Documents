// Overview tab — the original three widgets (KPI cards, channel
// distribution, AI & automation) exactly as they were on the analytics
// page before the Sales AI / Marketing AI / Support AI / Finance tabs
// were split out. No behavior change, just relocated.
'use client';
import Link from 'next/link';
import {
  Users, MessageSquareText, IndianRupee, Send, Bot, UserRound, Workflow, TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { useAnalyticsOverview, useAnalyticsChannels, useAnalyticsAutomation } from '@/lib/queries/superAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Badge from '@/components/ui/Badge.jsx';
import { money } from './shared';

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', linkedin: 'LinkedIn',
  sms_rcs: 'SMS / RCS', webchat: 'Web Chat', voice: 'Voice Call', email: 'Email',
};

// Distinct colors per channel, not a generic categorical palette — keeps
// the same channel readable across the pie chart and the table beneath it.
const CHANNEL_COLORS = {
  whatsapp: '#22c55e', instagram: '#ec4899', messenger: '#3b82f6', linkedin: '#0ea5e9',
  sms_rcs: '#f59e0b', webchat: '#8b5cf6', voice: '#14b8a6', email: '#64748b',
};

export default function Overview({ rangeParams }) {
  return (
    <div className="space-y-6">
      <OverviewCards rangeParams={rangeParams} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChannelDistribution rangeParams={rangeParams} />
        <AutomationMetrics rangeParams={rangeParams} />
      </div>
    </div>
  );
}

function OverviewCards({ rangeParams }) {
  const { data, isLoading, error } = useAnalyticsOverview(rangeParams || { range: '7d' });

  if (!rangeParams) {
    return <p className="text-sm text-slate-400">Pick a start and end date to see this range.</p>;
  }
  if (isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const cards = [
    { label: 'New Tenants', value: data.newTenants, icon: Users },
    { label: 'New Conversations', value: data.newConversations, icon: MessageSquareText },
    { label: 'Messages Sent', value: data.messagesOutbound, icon: Send },
    { label: 'Platform Revenue', value: money(data.platformRevenue), icon: IndianRupee },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-lg font-semibold mt-1">{value}</p>
            </div>
            <Icon className="size-7 text-slate-300 shrink-0" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ---------- Multi-Channel Distribution ----------
function ChannelDistribution({ rangeParams }) {
  const { data, isLoading, error } = useAnalyticsChannels(rangeParams || { range: '7d' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Channel Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {!rangeParams ? (
          <p className="text-sm text-slate-400">Pick a custom range above.</p>
        ) : isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <ChannelDistributionBody channels={data.channels} />
        )}
      </CardContent>
    </Card>
  );
}

function ChannelDistributionBody({ channels }) {
  const active = channels.filter((c) => c.conversations > 0);
  const pieData = (active.length ? active : channels).map((c) => ({
    name: CHANNEL_LABELS[c.channel] || c.channel,
    value: c.conversations,
    channel: c.channel,
  }));

  return (
    <div className="grid sm:grid-cols-2 gap-4 items-center">
      <div className="h-56">
        {active.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {pieData.map((d) => (
                  <Cell key={d.channel} fill={CHANNEL_COLORS[d.channel] || '#94a3b8'} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `${v} conversations`} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full grid place-items-center text-sm text-slate-400">
            No conversations in this range
          </div>
        )}
      </div>
      <div className="space-y-2 text-sm">
        {channels.map((c) => (
          <div key={c.channel} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ background: CHANNEL_COLORS[c.channel] || '#94a3b8' }}
              />
              <span className="truncate">{CHANNEL_LABELS[c.channel] || c.channel}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-slate-500">
              <span>{c.conversations}</span>
              <Badge tone="slate">{c.pctOfConversations}%</Badge>
              <span className="text-xs w-16 text-right">{c.tenantsEnabled} tenants</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- AI & Automation Metrics ----------
function AutomationMetrics({ rangeParams }) {
  const { data, isLoading, error } = useAnalyticsAutomation(rangeParams || { range: '7d' });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Workflow className="size-4" /> AI & Automation
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!rangeParams ? (
          <p className="text-sm text-slate-400">Pick a custom range above.</p>
        ) : isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <AutomationBody data={data} />
        )}
      </CardContent>
    </Card>
  );
}

function AutomationBody({ data }) {
  const { totalExecutions, byStatus, aiResolutionRatePct, handledBy, topPlaybooks } = data;
  const statusData = [
    { name: 'Completed', value: byStatus.completed, color: '#22c55e' },
    { name: 'Handed off', value: byStatus.handed_off, color: '#f59e0b' },
    { name: 'Active', value: byStatus.active, color: '#3b82f6' },
    { name: 'Expired', value: byStatus.expired, color: '#94a3b8' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <StatBlock label="Executions" value={totalExecutions} icon={TrendingUp} />
        <StatBlock
          label="AI resolution rate"
          value={aiResolutionRatePct == null ? '—' : `${aiResolutionRatePct}%`}
          icon={Bot}
        />
        <StatBlock
          label="Bot vs human"
          value={`${handledBy.bot} / ${handledBy.human}`}
          icon={UserRound}
        />
      </div>

      <div className="h-8 rounded-full overflow-hidden flex bg-slate-100">
        {statusData
          .filter((s) => s.value > 0)
          .map((s) => (
            <div
              key={s.name}
              title={`${s.name}: ${s.value}`}
              style={{ width: `${(s.value / (totalExecutions || 1)) * 100}%`, background: s.color }}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        {statusData.map((s) => (
          <span key={s.name} className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: s.color }} />
            {s.name} ({s.value})
          </span>
        ))}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 uppercase mb-2">Top playbooks</p>
        {!topPlaybooks.length ? (
          <p className="text-sm text-slate-400">No playbook executions in this range.</p>
        ) : (
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topPlaybooks} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v, _n, p) => [`${v} executions`, p.payload.organizationName]} />
                <Bar dataKey="executions" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <ul className="mt-2 space-y-1 text-xs text-slate-500">
          {topPlaybooks.map((p) => (
            <li key={p.playbookId} className="flex justify-between">
              <Link href={`/super-admin/companies/${p.organizationId}`} className="hover:underline truncate pr-2">
                {p.name} · {p.organizationName}
              </Link>
              <span className="shrink-0">{p.executions}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatBlock({ label, value, icon: Icon }) {
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
