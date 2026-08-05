'use client';
import { Headphones, Timer, Smile, UserRound, AlertTriangle } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { useAnalyticsSupport } from '@/lib/queries/superAdmin';
import { KpiCard, SectionCard, QueryGate, seconds, pct } from './shared';

export default function SupportAI({ rangeParams }) {
  const query = useAnalyticsSupport(rangeParams || { range: '7d' });

  return (
    <div className="space-y-6">
      <QueryGate rangeParams={rangeParams} query={query}>
        {(data) => (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard tone="blue" icon={Headphones} label="Conversations Handled" value={data.kpis.totalConversations} />
              <KpiCard
                tone="amber"
                icon={Timer}
                label="First Response / Resolution"
                value={`${seconds(data.kpis.firstResponseSeconds)} / ${seconds(data.kpis.resolutionSeconds)}`}
              />
              <KpiCard
                tone="amber"
                icon={Smile}
                label="CSAT"
                value="—"
                hint="No CSAT field in schema — not fabricated"
              />
              <KpiCard tone="blue" icon={UserRound} label="Human Handoff Rate" value={pct(data.kpis.humanHandoffRatePct)} />
            </div>

            <SectionCard title="Deflection vs. Handoff Trend">
              <DeflectionTrend deflectionTrend={data.deflectionTrend} />
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Top Query Categories">
                <CategoriesTable rows={data.queryCategories} />
              </SectionCard>
              <SectionCard title="Frustration & Escalation Alerts" icon={AlertTriangle}>
                <EscalationsList rows={data.escalations} />
              </SectionCard>
            </div>
          </>
        )}
      </QueryGate>
    </div>
  );
}

function DeflectionTrend({ deflectionTrend }) {
  if (!deflectionTrend.length) return <p className="text-sm text-slate-400">No conversations in this range.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={deflectionTrend}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="d" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Area type="monotone" dataKey="bot" stackId="1" stroke="#3b82f6" fill="#93c5fd" name="Bot-handled" />
          <Area type="monotone" dataKey="human" stackId="1" stroke="#f59e0b" fill="#fcd34d" name="Human-handled" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function CategoriesTable({ rows }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No playbook-driven sessions in this range.</p>;

  return (
    <div className="overflow-x-auto -mx-2">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-400 text-xs uppercase">
            <th className="px-2 py-2 font-medium">Category (Playbook)</th>
            <th className="px-2 py-2 font-medium text-right">Conversations</th>
            <th className="px-2 py-2 font-medium text-right">AI Resolution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category} className="border-t border-slate-100">
              <td className="px-2 py-2 truncate max-w-[160px]">{r.category}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.conversations}</td>
              <td className="px-2 py-2 text-right tabular-nums">{pct(r.aiResolutionRatePct)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EscalationsList({ rows }) {
  if (!rows.length) return <p className="text-sm text-slate-400">No flagged interactions in this range.</p>;

  return (
    <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
      {rows.map((r) => (
        <li key={r.conversationId} className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{r.organizationName}</p>
            <p className="text-xs text-slate-400 capitalize">{r.channel}</p>
          </div>
          <span className="text-xs text-rose-500 shrink-0 ml-2">flagged</span>
        </li>
      ))}
    </ul>
  );
}
