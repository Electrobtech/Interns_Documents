'use client';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { IndianRupee, Wallet, AlertTriangle, Building2 } from 'lucide-react';
import { useSuperAdminDashboard } from '@/lib/queries/superAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const STATUS_COLORS = { active: '#16a34a', suspended: '#dc2626', pending: '#f59e0b' };

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// SuperAdminDashboard — executive KPI cards + tenant status chart +
// low-balance alerts, per the spec's section A/C requirements. Wallet
// totals come straight from walletModel.globalFinancials() on the backend
// (SUM across every organization's wallet), not computed client-side.
export default function SuperAdminDashboardPage() {
  const { data, isLoading, error } = useSuperAdminDashboard();

  if (isLoading) return <p className="text-sm text-slate-400">Loading dashboard…</p>;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;

  const { financials, tenantsByStatus, lowBalanceAlerts } = data;
  const activeTenants = tenantsByStatus.find((t) => t.status === 'active')?.count || 0;

  const kpis = [
    { label: 'Total Revenue Collected', value: money(financials.total_revenue_collected), icon: IndianRupee },
    { label: 'Total Active Balance', value: money(financials.total_active_balance), icon: Wallet },
    { label: 'Active Tenants', value: activeTenants, icon: Building2 },
    { label: 'Low-Balance Alerts', value: financials.low_balance_org_count, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Super Admin Dashboard</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-xl font-semibold mt-1">{value}</p>
              </div>
              <Icon className="size-8 text-slate-300" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Tenants by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={tenantsByStatus} dataKey="count" nameKey="status" innerRadius={50} outerRadius={80}>
                  {tenantsByStatus.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 justify-center text-xs mt-2">
              {tenantsByStatus.map((t) => (
                <span key={t.status} className="flex items-center gap-1">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: STATUS_COLORS[t.status] || '#94a3b8' }}
                  />
                  {t.status} ({t.count})
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Low-Balance Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {lowBalanceAlerts.length === 0 ? (
              <p className="text-sm text-slate-400">No tenants below their low-balance threshold.</p>
            ) : (
              <ul className="divide-y">
                {lowBalanceAlerts.map((org) => (
                  <li key={org.id} className="flex items-center justify-between py-2 text-sm">
                    <Link href={`/super-admin/companies/${org.id}`} className="font-medium hover:underline">
                      {org.name}
                    </Link>
                    <span className="text-red-600">
                      {money(org.balance)} / {money(org.low_balance_threshold)} threshold
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
