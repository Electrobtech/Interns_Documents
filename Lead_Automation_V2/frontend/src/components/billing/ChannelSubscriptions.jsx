'use client';
import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Instagram, Linkedin, Mail, Smartphone, Send, AlertTriangle, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr, openCheckout } from '@/lib/billing';

const CHANNEL_META = {
  whatsapp: { label: 'WhatsApp', icon: MessageSquare },
  messenger: { label: 'Messenger', icon: Send },
  instagram: { label: 'Instagram', icon: Instagram },
  linkedin: { label: 'LinkedIn', icon: Linkedin },
  email: { label: 'Email', icon: Mail },
  sms: { label: 'SMS', icon: Smartphone },
};

const CATEGORY_LABEL = { marketing: 'Marketing', utility: 'Utility', authentication: 'Auth', service: 'Service' };
const SMS_ROUTE_LABEL = { promotional: 'Promo', transactional: 'Transactional', otp: 'OTP' };

// Small status pill shown under the on/off toggle: green when the channel
// subscription is actually active on the backend, red when it's been
// cancelled/paused (was on, now isn't), and a neutral white/outline pill
// for anything in between (never subscribed, or mid-payment) — that's
// "neither" active nor inactive yet.
function statusPill(status) {
  if (status === 'active') return { text: 'Active', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
  if (status === 'cancelled' || status === 'paused') return { text: 'Inactive', className: 'text-red-700 bg-red-50 border-red-200' };
  if (status === 'pending_payment') return { text: 'Pending', className: 'text-slate-400 bg-white border-slate-200' };
  return { text: 'Not subscribed', className: 'text-slate-400 bg-white border-slate-200' };
}

function StatusPill({ status }) {
  const { text, className } = statusPill(status);
  return (
    <span className={`text-[10px] font-medium rounded-full border px-2 py-0.5 whitespace-nowrap ${className}`}>
      {text}
    </span>
  );
}

// Usage-rate line under a channel card — the per-message cost on top of
// the flat platform fee. whatsapp/messenger/instagram usage comes from
// meta_rate_cards; sms from sms_rate_cards; linkedin/email have no
// usage-based component at all (flat platform fee only).
function UsageRates({ channelType, rates }) {
  if (channelType === 'sms') {
    const entries = Object.entries(rates.sms || {});
    if (entries.length === 0) return <p className="text-xs text-slate-400 mt-2">No usage fees</p>;
    return (
      <p className="text-xs text-slate-500 mt-2">
        {entries.map(([route, r]) => `${SMS_ROUTE_LABEL[route] || route} ${inr(r.rate)}/SMS`).join(' · ')}
      </p>
    );
  }
  const meta = rates.meta?.[channelType];
  if (!meta || Object.keys(meta).length === 0) {
    return <p className="text-xs text-slate-400 mt-2">No usage fees currently</p>;
  }
  return (
    <p className="text-xs text-slate-500 mt-2">
      {Object.entries(meta)
        .filter(([, r]) => r.rate > 0)
        .map(([cat, r]) => `${CATEGORY_LABEL[cat] || cat} ${inr(r.rate)}/msg`)
        .join(' · ')}
    </p>
  );
}

// Toggle WhatsApp / Messenger / Instagram / LinkedIn / Email / SMS on or
// off. Each card shows the flat platform fee plus (where applicable) the
// per-message Meta/SMS usage rate this org would actually be charged —
// see GET /billing/usage-rates, which already bakes in this org's markup
// % and GST so the number shown here matches what lands on the invoice.
// Newly-enabled channels are charged immediately via Razorpay Checkout —
// see save() below — using the same order->Checkout.js->verify flow as
// wallet recharge (frontend/src/lib/billing.js's openCheckout()).
export default function ChannelSubscriptions() {
  const { call } = useApi();
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [usageRates, setUsageRates] = useState({ meta: {}, sms: {} });
  const [selected, setSelected] = useState(new Set());
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(null); // { activelyConnected } from a 409
  const [saving, setSaving] = useState(false);
  const [payingFor, setPayingFor] = useState(null); // channel types currently mid-checkout

  const load = useCallback(() => {
    call('/billing/plans').then(setPlans).catch((e) => setError(e.message));
    call('/billing/usage-rates').then(setUsageRates).catch((e) => setError(e.message));
    call('/billing/subscription').then((data) => {
      setSubscription(data);
      setSelected(new Set(data.subscriptions
        .filter((s) => s.status === 'active' || s.status === 'pending_payment')
        .map((s) => s.channel_type)));
    }).catch((e) => setError(e.message));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const statusFor = (channelType) => subscription?.subscriptions.find((s) => s.channel_type === channelType)?.status;

  function toggle(channelType) {
    setConflict(null);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(channelType)) next.delete(channelType); else next.add(channelType);
      return next;
    });
  }

  // Runs the Razorpay Checkout flow for whatever's pending_payment after
  // the save() below creates those rows. If the sheet is closed or the
  // payment fails, the subscription rows are simply left pending_payment —
  // "Complete Payment" reappears on the card and nothing was charged.
  async function payForPending() {
    setPayingFor('checkout');
    try {
      const order = await call('/billing/subscription/checkout', { method: 'POST' });
      const result = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        description: `Channel subscription — ${order.channels.join(', ')}`,
      });
      await call('/billing/subscription/verify', {
        method: 'POST',
        body: { orderId: result.orderId, paymentId: result.paymentId, signature: result.signature },
      });
    } catch (e) {
      // "Payment cancelled" (sheet dismissed) isn't really an error state —
      // the pending_payment rows just sit there until retried.
      if (e.message !== 'Payment cancelled') setError(e.message);
    } finally {
      setPayingFor(null);
      load();
    }
  }

  async function save(confirmDisconnect = false) {
    setSaving(true);
    setError('');
    try {
      const channels = Array.from(selected).map((channelType) => ({ channelType, billingPeriod: 'monthly' }));
      const result = await call('/billing/subscription/channels', {
        method: 'PUT',
        body: { channels, confirmDisconnect },
      });
      setConflict(null);
      const hasPending = result.subscriptions.some((s) => s.status === 'pending_payment');
      if (hasPending) {
        setSaving(false);
        await payForPending();
        return;
      }
      load();
    } catch (e) {
      if (e.status === 409 && e.data?.activelyConnected) {
        setConflict(e.data);
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  }

  const anyPending = subscription?.subscriptions.some((s) => s.status === 'pending_payment');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Active Channels</p>
          <p className="text-2xl font-bold mt-1">
            {subscription?.subscriptions.filter((s) => s.status === 'active').length ?? '—'}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:col-span-2">
          <p className="text-xs text-slate-500">Monthly Platform Fee (SaaS fee only)</p>
          <p className="text-2xl font-bold mt-1">{subscription ? inr(subscription.monthly_saas_total) : '—'}</p>
          <p className="text-xs text-slate-400 mt-1">
            Usage rates shown per channel below already include your markup + GST — that's what actually lands on your invoice.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {anyPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-center justify-between gap-3">
          <span>You have a channel change awaiting payment.</span>
          <button
            onClick={payForPending}
            disabled={payingFor === 'checkout'}
            className="text-xs font-medium underline shrink-0 flex items-center gap-1"
          >
            {payingFor === 'checkout' && <Loader2 size={12} className="animate-spin" />}
            Complete Payment
          </button>
        </div>
      )}

      {conflict && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>
              {conflict.activelyConnected.join(', ')} still {conflict.activelyConnected.length > 1 ? 'have' : 'has'} an
              active connected integration. Disabling the subscription won&apos;t disconnect it automatically.
            </p>
            <button
              onClick={() => save(true)}
              className="mt-2 text-xs font-medium underline"
              disabled={saving}
            >
              Disable anyway
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.map((plan) => {
          const meta = CHANNEL_META[plan.channel_type] || { label: plan.channel_type, icon: MessageSquare };
          const Icon = meta.icon;
          const isOn = selected.has(plan.channel_type);
          const status = statusFor(plan.channel_type);
          return (
            <button
              key={plan.id}
              onClick={() => toggle(plan.channel_type)}
              className={`text-left rounded-xl border p-4 transition ${
                isOn ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-medium text-sm">
                  <Icon size={16} /> {meta.label}
                  {status === 'pending_payment' && (
                    <span className="text-[10px] uppercase tracking-wide bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">
                      Pending payment
                    </span>
                  )}
                </span>
                <span className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`w-9 h-5 rounded-full relative transition ${isOn ? 'bg-brand' : 'bg-slate-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition ${isOn ? 'translate-x-4' : ''}`}
                    />
                  </span>
                  <StatusPill status={status} />
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Platform fee</p>
              <p className="text-lg font-semibold">{inr(plan.our_fee_amount)}/mo</p>
              <UsageRates channelType={plan.channel_type} rates={usageRates} />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => save(false)}
        disabled={saving || payingFor}
        className="flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {(saving || payingFor) && <Loader2 size={14} className="animate-spin" />}
        {payingFor ? 'Processing payment…' : saving ? 'Saving…' : 'Save Channel Subscriptions'}
      </button>
    </div>
  );
}
