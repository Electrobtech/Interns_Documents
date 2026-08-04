'use client';
import { useState } from 'react';
import Link from 'next/link';
import { IndianRupee, FileText, RotateCcw, Receipt } from 'lucide-react';
import {
  useBillingSummary,
  usePlatformInvoices,
  usePlatformPayments,
  useRefundPayment,
} from '@/lib/queries/superAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge';

function money(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

const INVOICE_STATUS_TONE = { draft: 'slate', issued: 'blue', paid: 'emerald', void: 'red' };
const PAYMENT_STATUS_TONE = { created: 'slate', pending: 'amber', paid: 'emerald', failed: 'red', refunded: 'blue' };

// Platform-wide billing view — Module 2's cross-tenant counterpart to the
// per-company Subscription/Invoices panels on companies/[id]/page.jsx.
// Time-series filtering (Today/Last 7 Days/etc, per the OMS/Rankzy
// reference screenshots) is Module 3's job — this page intentionally
// keeps to a single "recent" list plus platform totals so as not to
// half-build Module 3 inside Module 2's page.
export default function BillingPage() {
  const [tab, setTab] = useState('invoices'); // 'invoices' | 'payments'
  const { data: summary, isLoading: summaryLoading } = useBillingSummary();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <SummaryCards summary={summary} loading={summaryLoading} />

      <div className="flex gap-2 border-b">
        <TabButton active={tab === 'invoices'} onClick={() => setTab('invoices')} icon={FileText}>
          GST Invoices
        </TabButton>
        <TabButton active={tab === 'payments'} onClick={() => setTab('payments')} icon={Receipt}>
          Payments & Refunds
        </TabButton>
      </div>

      {tab === 'invoices' ? <InvoicesTab /> : <PaymentsTab />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px ${
        active ? 'border-slate-800 text-slate-900 font-medium' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="size-4" />
      {children}
    </button>
  );
}

function SummaryCards({ summary, loading }) {
  if (loading || !summary) {
    return <p className="text-sm text-slate-400">Loading summary…</p>;
  }
  const activeSubs = summary.subscriptions.find((s) => s.status === 'active');
  const pastDueSubs = summary.subscriptions.find((s) => s.status === 'past_due');
  const paidInvoices = summary.invoices.find((i) => i.status === 'paid');
  const issuedInvoices = summary.invoices.find((i) => i.status === 'issued');

  const cards = [
    { label: 'Active Subscriptions (MRR component)', value: `${activeSubs?.count || 0} · ${money(activeSubs?.mrr_component)}`, icon: IndianRupee },
    { label: 'Past Due', value: pastDueSubs?.count || 0, icon: RotateCcw },
    { label: 'Invoiced (issued, unpaid)', value: `${issuedInvoices?.count || 0} · ${money(issuedInvoices?.total_amount)}`, icon: FileText },
    { label: 'Collected (paid invoices)', value: `${paidInvoices?.count || 0} · ${money(paidInvoices?.total_amount)}`, icon: Receipt },
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

function InvoicesTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePlatformInvoices({ page });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">GST Invoices — all tenants</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Invoice #</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">GSTIN</th>
                  <th className="py-2 pr-4">Total tax</th>
                  <th className="py-2 pr-4">Total</th>
                  <th className="py-2 pr-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-xs">{inv.invoice_number || '(draft)'}</td>
                    <td className="py-2.5 pr-4">
                      <Link href={`/super-admin/companies/${inv.organization_id}`} className="hover:underline">
                        {inv.organization_name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{new Date(inv.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{inv.buyer_gstin || '—'}</td>
                    <td className="py-2.5 pr-4">{money(inv.total_tax)}</td>
                    <td className="py-2.5 pr-4 font-medium">{money(inv.amount)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={INVOICE_STATUS_TONE[inv.status] || 'slate'}>{inv.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} setPage={setPage} total={data.total} pageSize={data.pageSize} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PaymentsTab() {
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = usePlatformPayments({ page });
  const refund = useRefundPayment();
  const [refundingId, setRefundingId] = useState(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payments — all tenants</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Purpose</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Gateway payment ID</th>
                  <th className="py-2 pr-4">Amount</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4">
                      <Link href={`/super-admin/companies/${p.organization_id}`} className="hover:underline">
                        {p.organization_name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 text-xs">{p.purpose.replace('_', ' ')}</td>
                    <td className="py-2.5 pr-4">{new Date(p.created_at).toLocaleDateString()}</td>
                    <td className="py-2.5 pr-4 capitalize">{p.method || '—'}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{p.gateway_payment_id || '—'}</td>
                    <td className="py-2.5 pr-4 font-medium">{money(p.amount)}</td>
                    <td className="py-2.5 pr-4">
                      <Badge tone={PAYMENT_STATUS_TONE[p.status] || 'slate'}>{p.status}</Badge>
                    </td>
                    <td className="py-2.5 pr-4">
                      {p.status === 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={refund.isPending && refundingId === p.id}
                          onClick={() => {
                            const reason = window.prompt('Refund reason (shown in the audit log):');
                            if (reason === null) return; // canceled
                            setRefundingId(p.id);
                            refund.mutate({ paymentId: p.id, reason });
                          }}
                        >
                          Refund
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination page={page} setPage={setPage} total={data.total} pageSize={data.pageSize} />
            {refund.error && <p className="text-red-600 text-xs mt-2">{refund.error.message}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Pagination({ page, setPage, total, pageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-4 text-sm text-slate-500">
      <span>Page {page} of {totalPages} ({total} total)</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          Next
        </Button>
      </div>
    </div>
  );
}
