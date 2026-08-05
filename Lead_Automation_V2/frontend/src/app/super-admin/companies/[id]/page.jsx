'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, RotateCcw, FileText, RefreshCw } from 'lucide-react';
import {
  useCompanyDetail,
  useUpdateCompanyStatus,
  useUpdateCompanyPlan,
  useRechargeWallet,
  useChannelQuotas,
  useUpdateChannelQuota,
  useResetChannelUsage,
  useSubscription,
  useUpdateSubscription,
  useUpdateSubscriptionStatus,
  useRenewSubscription,
  useCompanyInvoices,
  useIssueInvoice,
  useVoidInvoice,
} from '@/lib/queries/superAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Badge from '@/components/ui/Badge';
import Switch from '@/components/ui/Switch';

const STATUS_TONE = { active: 'emerald', pending: 'amber', suspended: 'red' };
const PLAN_OPTIONS = ['Free', 'Pro', 'Enterprise', 'Custom'];

// Display labels for the 8 governed channel types (see
// infra/db/migrations/026_channel_quotas.sql).
const CHANNEL_LABELS = {
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  messenger: 'Messenger',
  linkedin: 'LinkedIn',
  sms_rcs: 'SMS / RCS',
  webchat: 'Web Chat',
  voice: 'Voice Call',
  email: 'Email',
};

// Company detail view — company profile + governance actions (status,
// plan), wallet summary + manual recharge, and the Module 1 Channel &
// Quota Management panel. Deeper wallet ledger / feature-flag panels can
// be added as further tabs; this keeps the first real version of this
// page (it previously didn't exist — file was empty) focused and
// reviewable.
export default function CompanyDetailPage() {
  const { id } = useParams();
  const { data, isLoading, error } = useCompanyDetail(id);

  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error.message}</p>;
  }

  const { company, wallet } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/super-admin/companies" className="text-slate-400 hover:text-slate-700">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-semibold">{company.name}</h1>
        <Badge tone={STATUS_TONE[company.status] || 'slate'}>{company.status}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ProfileCard company={company} />
        <WalletCard companyId={id} wallet={wallet} />
        <StatusPlanCard companyId={id} company={company} />
      </div>

      <ChannelQuotaPanel companyId={id} />
      <SubscriptionPanel companyId={id} />
      <InvoicesPanel companyId={id} />
    </div>
  );
}

function ProfileCard({ company }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2 text-sm">
        <p className="text-slate-400 uppercase text-xs font-medium">Profile</p>
        <Row label="Email" value={company.company_email} />
        <Row label="Phone" value={company.company_phone} />
        <Row label="Industry" value={company.industry} />
        <Row label="Registered" value={new Date(company.created_at).toLocaleDateString()} />
      </CardContent>
    </Card>
  );
}

function WalletCard({ companyId, wallet }) {
  const [amount, setAmount] = useState('');
  const recharge = useRechargeWallet(companyId);
  const lowBalance = wallet && Number(wallet.balance) < Number(wallet.low_balance_threshold);

  function submit(e) {
    e.preventDefault();
    if (!(Number(amount) > 0)) return;
    recharge.mutate(
      { amount: Number(amount), description: 'Manual top-up via Super Admin' },
      { onSuccess: () => setAmount('') }
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3 text-sm">
        <p className="text-slate-400 uppercase text-xs font-medium">Wallet</p>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold">₹{Number(wallet?.balance ?? 0).toLocaleString('en-IN')}</span>
          {lowBalance && <Badge tone="red">Low balance</Badge>}
        </div>
        <p className="text-slate-500">Threshold ₹{Number(wallet?.low_balance_threshold ?? 0).toLocaleString('en-IN')}</p>
        <form onSubmit={submit} className="flex gap-2 pt-1">
          <input
            type="number"
            min="1"
            step="1"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button type="submit" size="sm" disabled={recharge.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
            {recharge.isPending ? <Loader2 className="size-4 animate-spin" /> : 'Top up'}
          </Button>
        </form>
        {recharge.error && <p className="text-red-600 text-xs">{recharge.error.message}</p>}
      </CardContent>
    </Card>
  );
}

function StatusPlanCard({ companyId, company }) {
  const updateStatus = useUpdateCompanyStatus(companyId);
  const updatePlan = useUpdateCompanyPlan(companyId);

  return (
    <Card>
      <CardContent className="pt-6 space-y-3 text-sm">
        <p className="text-slate-400 uppercase text-xs font-medium">Lifecycle</p>

        <div>
          <p className="text-slate-500 mb-1">Status</p>
          <div className="flex gap-1.5">
            {['active', 'suspended'].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={company.status === s ? 'default' : 'outline'}
                disabled={updateStatus.isPending || company.status === s}
                onClick={() => updateStatus.mutate(s)}
                className={company.status === s ? 'bg-slate-800 text-white hover:bg-slate-800' : ''}
              >
                {s === 'active' ? 'Activate' : 'Suspend'}
              </Button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-slate-500 mb-1">Plan</p>
          <select
            value={company.subscription_plan || ''}
            disabled={updatePlan.isPending}
            onChange={(e) => updatePlan.mutate(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              Select plan…
            </option>
            {PLAN_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- Module 1: Channel & Quota Management ----------
function ChannelQuotaPanel({ companyId }) {
  const { data: channels, isLoading, error } = useChannelQuotas(companyId);
  const updateQuota = useUpdateChannelQuota(companyId);
  const resetUsage = useResetChannelUsage(companyId);

  return (
    <Card>
      <CardContent className="pt-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Channels & Quotas</h2>
          <p className="text-xs text-slate-400">Resets monthly</p>
        </div>

        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Channel</th>
                <th className="py-2 pr-4">Enabled</th>
                <th className="py-2 pr-4">Monthly quota</th>
                <th className="py-2 pr-4">Usage</th>
                <th className="py-2 pr-4">Warn at</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {channels.map((c) => (
                <ChannelRow
                  key={c.channel}
                  channelQuota={c}
                  onToggle={(enabled) => updateQuota.mutate({ channel: c.channel, enabled })}
                  onQuotaChange={(monthlyQuota) => updateQuota.mutate({ channel: c.channel, monthlyQuota })}
                  onThresholdChange={(lowQuotaThresholdPct) =>
                    updateQuota.mutate({ channel: c.channel, lowQuotaThresholdPct })
                  }
                  onReset={() => resetUsage.mutate(c.channel)}
                  resetting={resetUsage.isPending && resetUsage.variables === c.channel}
                />
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function ChannelRow({ channelQuota, onToggle, onQuotaChange, onThresholdChange, onReset, resetting }) {
  const { channel, enabled, monthly_quota, quota_used, low_quota_threshold_pct } = channelQuota;
  const [quotaInput, setQuotaInput] = useState(monthly_quota ?? '');
  const [thresholdInput, setThresholdInput] = useState(low_quota_threshold_pct);

  const pctUsed = monthly_quota ? Math.min(100, Math.round((quota_used / monthly_quota) * 100)) : null;
  const isLow = pctUsed != null && pctUsed >= low_quota_threshold_pct;

  return (
    <tr className="border-b last:border-0 align-middle">
      <td className="py-2.5 pr-4 font-medium">{CHANNEL_LABELS[channel] || channel}</td>
      <td className="py-2.5 pr-4">
        <Switch checked={enabled} onChange={onToggle} label={`Enable ${channel}`} />
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            placeholder="Unlimited"
            value={quotaInput}
            onChange={(e) => setQuotaInput(e.target.value)}
            onBlur={() => onQuotaChange(quotaInput === '' ? null : Number(quotaInput))}
            className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400 text-xs">/ mo</span>
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className="text-slate-600 whitespace-nowrap">
            {quota_used}
            {monthly_quota != null ? ` / ${monthly_quota}` : ''}
          </span>
          {isLow && <Badge tone="red">Low</Badge>}
        </div>
        {pctUsed != null && (
          <div className="h-1.5 w-24 rounded-full bg-slate-100 mt-1">
            <div
              className={`h-1.5 rounded-full ${isLow ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${pctUsed}%` }}
            />
          </div>
        )}
      </td>
      <td className="py-2.5 pr-4">
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            max="100"
            value={thresholdInput}
            onChange={(e) => setThresholdInput(e.target.value)}
            onBlur={() => onThresholdChange(Number(thresholdInput))}
            className="w-14 rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-slate-400 text-xs">%</span>
        </div>
      </td>
      <td className="py-2.5 pr-4">
        <Button variant="outline" size="sm" onClick={onReset} disabled={resetting} className="gap-1">
          {resetting ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
          Reset
        </Button>
      </td>
    </tr>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right">{value || '—'}</span>
    </div>
  );
}

// ---------- Module 2: Subscription Management ----------
const SUB_STATUS_TONE = { trialing: 'blue', active: 'emerald', past_due: 'amber', canceled: 'red' };

function SubscriptionPanel({ companyId }) {
  const { data: sub, isLoading, error } = useSubscription(companyId);
  const updateSub = useUpdateSubscription(companyId);
  const updateStatus = useUpdateSubscriptionStatus(companyId);
  const renew = useRenewSubscription(companyId);

  const [amountInput, setAmountInput] = useState('');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-slate-400">Loading subscription…</CardContent>
      </Card>
    );
  }
  if (error) {
    // A 404 here just means this company predates Module 2 (no subscriptions
    // row) — not a real error, so keep the tone informational, not red.
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-slate-400">No subscription record for this company yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Subscription</h2>
          <Badge tone={SUB_STATUS_TONE[sub.status] || 'slate'}>{sub.status.replace('_', ' ')}</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <div>
            <p className="text-slate-500 mb-1">Plan</p>
            <select
              value={sub.plan || ''}
              disabled={updateSub.isPending}
              onChange={(e) => updateSub.mutate({ plan: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PLAN_OPTIONS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <p className="text-slate-500 mb-1">Billing cycle</p>
            <select
              value={sub.billing_cycle}
              disabled={updateSub.isPending}
              onChange={(e) => updateSub.mutate({ billingCycle: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <p className="text-slate-500 mb-1">Amount / cycle</p>
            <div className="flex gap-1.5">
              <input
                type="number"
                min="0"
                placeholder={sub.amount}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                onBlur={() => {
                  if (amountInput !== '') {
                    updateSub.mutate({ amount: Number(amountInput) });
                    setAmountInput('');
                  }
                }}
                className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <p className="text-slate-500 mb-1">Auto-billing</p>
            <Switch
              checked={sub.auto_billing}
              onChange={(v) => updateSub.mutate({ autoBilling: v })}
              label="Auto-billing"
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-4 text-sm">
          <div>
            <p className="text-slate-500">
              Current period: <span className="text-slate-800">{sub.current_period_start}</span> →{' '}
              <span className="text-slate-800">{sub.current_period_end}</span>
            </p>
            {sub.cancel_at_period_end && <p className="text-amber-600 text-xs mt-0.5">Cancels at period end</p>}
          </div>
          <div className="flex gap-2">
            {sub.status !== 'canceled' ? (
              <Button variant="outline" size="sm" onClick={() => updateStatus.mutate('canceled')} disabled={updateStatus.isPending}>
                Cancel
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => updateStatus.mutate('active')} disabled={updateStatus.isPending}>
                Reactivate
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => renew.mutate()}
              disabled={renew.isPending}
              className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700"
            >
              {renew.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Renew now (generates invoice)
            </Button>
          </div>
        </div>
        {(updateSub.error || updateStatus.error || renew.error) && (
          <p className="text-red-600 text-xs">
            {(updateSub.error || updateStatus.error || renew.error).message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ---------- Module 2: GST Invoices ----------
const INVOICE_STATUS_TONE = { draft: 'slate', issued: 'blue', paid: 'emerald', void: 'red' };

function InvoicesPanel({ companyId }) {
  const { data: invoices, isLoading, error } = useCompanyInvoices(companyId);
  const issueInvoice = useIssueInvoice();
  const voidInvoice = useVoidInvoice();
  const qc = useQueryClient();
  // useIssueInvoice/useVoidInvoice only invalidate the platform-wide
  // ['super-admin','invoices'] list (see queries/superAdmin.js) — also
  // invalidate this page's company-scoped list so Issue/Void reflect
  // immediately here too, instead of only after a manual refresh.
  const invalidateHere = () => qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'invoices'] });

  return (
    <Card>
      <CardContent className="pt-6 overflow-x-auto">
        <h2 className="text-lg font-semibold mb-4">GST Invoices</h2>

        {isLoading ? (
          <p className="text-sm text-slate-400">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error.message}</p>
        ) : !invoices.length ? (
          <p className="text-sm text-slate-400">No invoices yet — use "Renew now" above to generate one.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="py-2 pr-4">Invoice #</th>
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Subtotal</th>
                <th className="py-2 pr-4">CGST</th>
                <th className="py-2 pr-4">SGST</th>
                <th className="py-2 pr-4">IGST</th>
                <th className="py-2 pr-4">Total</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4" />
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b last:border-0">
                  <td className="py-2.5 pr-4 font-mono text-xs">{inv.invoice_number || '(draft)'}</td>
                  <td className="py-2.5 pr-4">{new Date(inv.created_at).toLocaleDateString()}</td>
                  <td className="py-2.5 pr-4">₹{Number(inv.subtotal).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4">₹{Number(inv.cgst_amount).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4">₹{Number(inv.sgst_amount).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4">₹{Number(inv.igst_amount).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4 font-medium">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                  <td className="py-2.5 pr-4">
                    <Badge tone={INVOICE_STATUS_TONE[inv.status] || 'slate'}>{inv.status}</Badge>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex gap-1.5">
                      {inv.status === 'draft' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          disabled={issueInvoice.isPending}
                          onClick={() => issueInvoice.mutate(inv.id, { onSuccess: invalidateHere })}
                        >
                          <FileText className="size-3.5" />
                          Issue
                        </Button>
                      )}
                      {inv.status !== 'paid' && inv.status !== 'void' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={voidInvoice.isPending}
                          onClick={() => voidInvoice.mutate(inv.id, { onSuccess: invalidateHere })}
                        >
                          Void
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
