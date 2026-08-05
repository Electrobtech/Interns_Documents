'use client';
import { Megaphone, MousePointerClick, UserPlus, Percent } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useAnalyticsMarketing } from '@/lib/queries/superAdmin';
import { KpiCard, SectionCard, QueryGate, pct } from './shared';

const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', linkedin: 'LinkedIn',
  sms_rcs: 'SMS / RCS', webchat: 'Web Chat', voice: 'Voice Call', email: 'Email', unknown: 'Unknown',
};

export default function MarketingAI({ rangeParams }) {
  const query = useAnalyticsMarketing(rangeParams || { range: '7d' });

  return (
    <div className="space-y-6">
      <QueryGate rangeParams={rangeParams} query={query}>
        {(data) => (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard tone="violet" icon={Megaphone} label="Campaign Reach" value={data.kpis.reach.toLocaleString('en-IN')} />
              <KpiCard tone="violet" icon={MousePointerClick} label="Engagement Rate" value={pct(data.kpis.engagementRatePct)} />
              <KpiCard tone="violet" icon={UserPlus} label="Inbound Leads Generated" value={data.kpis.inboundLeadsGenerated} />
              <KpiCard
                tone="violet"
                icon={Percent}
                label="CPA / ROAS (est.)"
                value={data.kpis.cpaEstimated == null ? '—' : `₹${data.kpis.cpaEstimated} · ${data.kpis.roasEstimated}x`}
                hint="Estimated — no ad-spend field in schema"
              />
            </div>

            <SectionCard title="Multi-Channel Campaign Performance">
              <ChannelBarChart byChannel={data.byChannel} />
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Playbook Comparison">
                <PlaybookTable rows={data.playbookComparison} />
              </SectionCard>
              <SectionCard title="Peak Engagement (Hour of Day, UTC)">
                <Heatmap peakEngagement={data.peakEngagement} />
              </SectionCard>
            </div>
          </>
        )}
      </QueryGate>
    </div>
  );
}

function ChannelBarChart({ byChannel }) {
  const active = byChannel.filter((c) => c.sent > 0 || c.campaigns > 0);
  if (!active.length) return <p className="text-sm text-slate-400">No campaigns in this range.</p>;

  const chartData = active.map((c) => ({
    channel: CHANNEL_LABELS[c.channel] || c.channel,
    Sent: c.sent,
    Engagements: c.engagements,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="channel" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="Sent" fill="#a78bfa" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Engagements" fill="#6d28d9" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PlaybookTable({ rows }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No playbook-driven campaigns in this range.</p>;

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase">
            <th className="px-2 py-2 font-medium">Playbook</th>
            <th className="px-2 py-2 font-medium text-right">Sent</th>
            <th className="px-2 py-2 font-medium text-right">Open Rate</th>
            <th className="px-2 py-2 font-medium text-right">Conversion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.playbookId} className="border-t border-slate-100">
              <td className="px-2 py-2 truncate max-w-[160px]">{r.name}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.sent}</td>
              <td className="px-2 py-2 text-right tabular-nums">{pct(r.openRatePct)}</td>
              <td className="px-2 py-2 text-right tabular-nums">{pct(r.conversionRatePct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Heatmap({ peakEngagement }) {
  const max = Math.max(1, ...peakEngagement.map((h) => h.engagements));
  return (
    <div className="grid grid-cols-12 gap-1">
      {peakEngagement.map((h) => {
        const intensity = h.engagements / max;
        return (
          <div
            key={h.hour}
            title={`${h.hour}:00 — ${h.engagements} engagements`}
            className="aspect-square rounded flex items-center justify-center text-[9px] text-white"
            style={{ background: `rgba(109, 40, 217, ${0.12 + intensity * 0.78})` }}
          >
            {h.hour}
          </div>
        );
      })}
    </div>
  );
}
