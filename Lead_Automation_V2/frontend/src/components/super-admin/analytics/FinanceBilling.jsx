'use client';
import { IndianRupee, Users, HeartCrack, Cpu } from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { useAnalyticsFinance } from '@/lib/queries/superAdmin';
import { KpiCard, SectionCard, QueryGate, money, pct } from './shared';
import Badge from '@/components/ui/Badge';

const TIER_LABELS = { starter: 'Starter', professional: 'Pro', enterprise: 'Enterprise', custom: 'Custom' };
const TIER_COLORS = { starter: '#94a3b8', professional: '#22c55e', enterprise: '#6366f1', custom: '#f59e0b' };

const INVOICE_STATUS_TONE = { draft: 'slate', issued: 'amber', paid: 'emerald', void: 'red' };

export default function FinanceBilling({ rangeParams }) {
  const query = useAnalyticsFinance(rangeParams || { range: '7d' });

  return (
    <div className="space-y-6">
      <QueryGate rangeParams={rangeParams} query={query}>
        {(data) => (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard tone="emerald" icon={IndianRupee} label="MRR / ARR" value={`${money(data.kpis.mrr)} / ${money(data.kpis.arr)}`} />
              <KpiCard tone="emerald" icon={Users} label="ARPU" value={money(data.kpis.arpu)} />
              <KpiCard
                tone="emerald"
                icon={HeartCrack}
                label="LTV / Churn"
                value={`${data.kpis.ltvEstimated == null ? '—' : money(data.kpis.ltvEstimated)} / ${pct(data.kpis.churnRatePct)}`}
                hint="LTV is ARPU ÷ churn rate (standard shorthand)"
              />
              <KpiCard
                tone="emerald"
                icon={Cpu}
                label="Usage Cost vs. Margin"
                value={`${money(data.kpis.usageCost)} · ${pct(data.kpis.revenueMarginPct)}`}
              />
            </div>

            <SectionCard title="Revenue Growth Trend">
              <RevenueTrend revenueTrend={data.revenueTrend} />
            </SectionCard>

            <div className="grid gap-4 lg:grid-cols-2">
              <SectionCard title="Tenant Subscription Tier Breakdown">
                <TierBreakdown tierBreakdown={data.tierBreakdown} />
              </SectionCard>
              <SectionCard title="Overdue Payments & Invoice Status">
                <OverdueInvoices data={data} />
              </SectionCard>
            </div>
          </>
        )}
      </QueryGate>
    </div>
  );
}

function RevenueTrend({ revenueTrend }) {
  if (!revenueTrend.length) return <p className="text-sm text-slate-400">No data in this range.</p>;

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={revenueTrend}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v) => money(v)} />
          <Legend />
          <Line type="monotone" dataKey="revenue" name="Gross Revenue" stroke="#10b981" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="cost" name="Platform API Expenses" stroke="#ef4444" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="net" name="Net Margin" stroke="#0ea5e9" strokeWidth={2} strokeDasharray="4 3" dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function TierBreakdown({ tierBreakdown }) {
  const total = tierBreakdown.reduce((s, t) => s + t.tenants, 0);
  if (!total) return <p className="text-sm text-slate-400">No tenants yet.</p>;

  return (
    <div className="grid sm:grid-cols-2 gap-4 items-center">
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={tierBreakdown} dataKey="tenants" nameKey="tier" innerRadius={40} outerRadius={75} paddingAngle={2}>
              {tierBreakdown.map((t) => (
                <Cell key={t.tier} fill={TIER_COLORS[t.tier] || '#94a3b8'} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `${v} tenants`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2 text-sm">
        {tierBreakdown.map((t) => (
          <div key={t.tier} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="size-2.5 rounded-full shrink-0" style={{ background: TIER_COLORS[t.tier] }} />
              <span className="truncate">{TIER_LABELS[t.tier] || t.tier}</span>
            </div>
            <span className="text-slate-500">{t.tenants}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverdueInvoices({ data }) {
  const { overdueInvoices, invoiceStatusCounts } = data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {invoiceStatusCounts.map((s) => (
          <Badge key={s.status} tone={INVOICE_STATUS_TONE[s.status] || 'slate'}>
            {s.status} ({s.count})
          </Badge>
        ))}
      </div>
      {!overdueInvoices.length ? (
        <p className="text-sm text-slate-400">No overdue invoices.</p>
      ) : (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 text-xs uppercase">
                <th className="px-2 py-2 font-medium">Tenant</th>
                <th className="px-2 py-2 font-medium text-right">Amount</th>
                <th className="px-2 py-2 font-medium text-right">Due</th>
              </tr>
            </thead>
            <tbody>
              {overdueInvoices.map((inv) => (
                <tr key={inv.invoiceId} className="border-t border-slate-100">
                  <td className="px-2 py-2 truncate max-w-[140px]">{inv.organizationName}</td>
                  <td className="px-2 py-2 text-right tabular-nums">{money(inv.amount)}</td>
                  <td className="px-2 py-2 text-right text-rose-500">{new Date(inv.dueDate).toLocaleDateString('en-IN')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
