'use client';
import Link from 'next/link';
import { Users, TrendingUp, IndianRupee, CalendarCheck } from 'lucide-react';
import {
  ResponsiveContainer, FunnelChart, Funnel, LabelList, Tooltip,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { useAnalyticsSales } from '@/lib/queries/superAdmin';
import { KpiCard, SectionCard, QueryGate, money, pct } from './shared';

const INTENT_COLORS = {
  high_intent: '#10b981',
  pricing: '#6366f1',
  general_query: '#f59e0b',
  unresponsive: '#94a3b8',
};

export default function SalesAI({ rangeParams }) {
  const query = useAnalyticsSales(rangeParams || { range: '7d' });

  return (
    <div className="space-y-6">
      <QueryGate rangeParams={rangeParams} query={query}>
        {(data) => (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                tone="emerald"
                icon={Users}
                label="Leads Engaged & Qualified"
                value={`${data.kpis.leadsEngaged} / ${data.kpis.leadsQualified}`}
              />
              <KpiCard tone="emerald" icon={TrendingUp} label="Conversion Rate" value={pct(data.kpis.conversionRatePct)} />
              <KpiCard
                tone="emerald"
                icon={IndianRupee}
                label="Pipeline Value"
                value={money(data.kpis.pipelineValueEstimated)}
                hint="Estimated — no deal-value field in schema"
              />
              <KpiCard
                tone="emerald"
                icon={CalendarCheck}
                label="Meeting Booking Rate"
                value={pct(data.kpis.meetingBookingRatePct)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Sales Funnel">
                <FunnelBody funnel={data.funnel} />
              </SectionCard>
              <SectionCard title="Lead Sentiment & Intent Breakdown">
                <IntentBody intentBreakdown={data.intentBreakdown} />
              </SectionCard>
            </div>

            <SectionCard title="Agent Performance by Tenant">
              <AgentTable rows={data.agentPerformance} />
            </SectionCard>
          </>
        )}
      </QueryGate>
    </div>
  );
}

function FunnelBody({ funnel }) {
  const stages = [
    { name: 'Discovery', value: funnel.discovered, fill: '#a7f3d0' },
    { name: 'Engaged', value: funnel.engaged, fill: '#6ee7b7' },
    { name: 'Qualified', value: funnel.qualified, fill: '#34d399' },
    { name: 'Demo Booked', value: funnel.demoBooked, fill: '#10b981' },
    { name: 'Closed/Won', value: funnel.closedWon, fill: '#047857' },
  ];
  if (!funnel.discovered) return <p className="text-sm text-slate-400">No leads in this range.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <FunnelChart>
          <Tooltip formatter={(v, n) => [`${v} leads`, n]} />
          <Funnel dataKey="value" data={stages} isAnimationActive>
            <LabelList position="right" dataKey="name" fill="#475569" stroke="none" fontSize={12} />
            <LabelList position="center" dataKey="value" fill="#fff" stroke="none" fontSize={12} />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}

function IntentBody({ intentBreakdown }) {
  const total = intentBreakdown.reduce((s, i) => s + i.count, 0);
  if (!total) return <p className="text-sm text-slate-400">No leads with message history in this range.</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-4 items-center">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={intentBreakdown} dataKey="count" nameKey="label" innerRadius={40} outerRadius={75} paddingAngle={2}>
              {intentBreakdown.map((d) => (
                <Cell key={d.intent} fill={INTENT_COLORS[d.intent] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v} leads`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 text-sm">
        {intentBreakdown.map((i) => (
          <div key={i.intent} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: INTENT_COLORS[i.intent] }} />
              <span className="truncate">{i.label}</span>
            </div>
            <span className="text-slate-500">{i.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentTable({ rows }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No leads handled in this range.</p>;

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase">
            <th className="px-2 py-2 font-medium">Tenant</th>
            <th className="px-2 py-2 font-medium text-right">Leads</th>
            <th className="px-2 py-2 font-medium text-right">Qualified</th>
            <th className="px-2 py-2 font-medium text-right">Won</th>
            <th className="px-2 py-2 font-medium text-right">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.organizationId} className="border-t border-slate-100">
              <td className="px-2 py-2">
                <Link href={`/super-admin/companies/${r.organizationId}`} className="hover:underline">
                  {r.organizationName}
                </Link>
              </td>
              <td className="px-2 py-2 text-right tabular-nums">{r.leads}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.qualified}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.won}</td>
              <td className="px-2 py-2 text-right tabular-nums">{pct(r.conversionRatePct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
