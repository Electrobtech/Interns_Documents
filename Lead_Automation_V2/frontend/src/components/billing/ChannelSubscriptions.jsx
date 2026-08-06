'use client';
import { useCallback, useEffect, useState } from 'react';
import { MessageSquare, Instagram, Linkedin, Mail, Smartphone, Send, AlertTriangle, Loader2, Layers, Wallet, Sparkles, ShieldAlert } from 'lucide-react';
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

// A channel card has four visual states, driven off the subscription
// record for that channel:
//   - 'connected' — billing status is active and the integration is
//     healthy (green card, "Active" badge)
//   - 'failed'    — billing status is active but the integration itself
//     is broken (expired token, webhook failure, OAuth error — carried
//     on subscription.connection_error / connection_status from the
//     integration health check). Red card, "Failed" badge, toggle stays
//     on since the person did try to enable it.
//   - 'pending'   — subscription charged but payment not yet confirmed.
//     Neutral/white with its own amber "Pending payment" badge.
//   - 'none'      — never subscribed, or switched off. Plain white, no
//     badge at all.
function cardState(status, hasConnectionError) {
  if (status === 'pending_payment') return 'pending';
  if (status === 'active') return hasConnectionError ? 'failed' : 'connected';
  return 'none';
}

const CARD_STYLES = {
  connected: {
    card: 'border-[#22C55E] bg-[#E8F8EC] hover:shadow-card-hover',
    iconBadge: 'bg-emerald-100 text-emerald-600',
    toggleOn: 'bg-emerald-500',
  },
  failed: {
    card: 'border-[#EF4444] bg-[#FDECEC] hover:shadow-card-hover',
    iconBadge: 'bg-rose-100 text-rose-600',
    toggleOn: 'bg-rose-500',
  },
  pending: {
    card: 'border-[#EF4444] bg-[#FDECEC] hover:shadow-card-hover',
    iconBadge: 'bg-rose-100 text-rose-600',
    toggleOn: 'bg-rose-500',
  },
  none: {
    card: 'border-[#E5E7EB] bg-white hover:shadow-card-hover hover:border-slate-300',
    iconBadge: 'bg-slate-100 text-slate-500',
    toggleOn: 'bg-slate-300',
  },
};

function StatusBadge({ state, errorMessage }) {
  if (state === 'connected') {
    return (
      <span className="text-[10px] font-semibold rounded-full border px-2 py-0.5 whitespace-nowrap text-emerald-700 bg-emerald-50 border-emerald-200">
        Active
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <span
        title={errorMessage || 'Authentication failed'}
        className="flex items-center gap-1 text-[10px] font-semibold rounded-full border px-2 py-0.5 whitespace-nowrap text-rose-700 bg-rose-50 border-rose-200"
      >
        <ShieldAlert size={11} /> Failed
      </span>
    );
  }
  if (state === 'pending') {
    return (
      <span className="text-[10px] font-semibold rounded-full border px-2 py-0.5 whitespace-nowrap text-amber-700 bg-amber-50 border-amber-200">
        Pending payment
      </span>
    );
  }
  return null; // not connected / disabled — no badge
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

  const recordFor = (channelType) => subscription?.subscriptions.find((s) => s.channel_type === channelType);
  const statusFor = (channelType) => recordFor(channelType)?.status;
  // Optional connection-health signal from the backend — not every
  // integration reports this yet, so it defaults to "no error" (i.e. the
  // card just reflects billing status) until that data is wired up.
  const connectionErrorFor = (channelType) => {
    const rec = recordFor(channelType);
    if (!rec) return null;
    if (rec.connection_status === 'failed' || rec.connection_error) {
      return rec.error_message || rec.connection_error || 'Authentication failed';
    }
    return null;
  };

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
      // the pending_payment rows just sit there until retried. For real
      // failures, surface the backend's `detail` (e.g. Razorpay's own error
      // text) alongside the generic message — "Could not create Razorpay
      // order" alone doesn't say *why*, and that's almost always a
      // config/account issue (bad or unverified keys) rather than something
      // wrong with this request.
      if (e.message !== 'Payment cancelled') {
        setError(e.data?.detail ? `${e.message}: ${e.data.detail}` : e.message);
      }
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
  const activeCount = subscription?.subscriptions.filter((s) => s.status === 'active').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-card p-5">
          <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full bg-gradient-to-br from-violet-100 to-rose-100 opacity-70" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Active Channels</p>
              <p className="text-3xl font-bold mt-1.5 bg-gradient-to-r from-violet-600 to-rose-500 bg-clip-text text-transparent">
                {subscription ? activeCount : '—'}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-rose-100 text-violet-600">
              <Layers size={18} />
            </div>
          </div>
        </div>
        <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-card p-5 sm:col-span-2">
          <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-gradient-to-br from-violet-100 to-rose-100 opacity-60" />
          <div className="relative flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Monthly Platform Fee (SaaS fee only)</p>
              <p className="text-3xl font-bold mt-1.5 text-slate-800">
                {subscription ? inr(subscription.monthly_saas_total) : '—'}
              </p>
              <p className="text-xs text-slate-400 mt-2 max-w-md">
                Usage rates shown per channel below already include your markup + GST — that&apos;s what actually lands on your invoice.
              </p>
            </div>
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-rose-100 text-violet-600 shrink-0">
              <Wallet size={18} />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
      )}

      {anyPending && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Sparkles size={15} className="shrink-0" />
            You have a channel change awaiting payment.
          </span>
          <button
            onClick={payForPending}
            disabled={payingFor === 'checkout'}
            className="text-xs font-semibold underline shrink-0 flex items-center gap-1 hover:text-amber-900"
          >
            {payingFor === 'checkout' && <Loader2 size={12} className="animate-spin" />}
            Complete Payment
          </button>
        </div>
      )}

      {conflict && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p>
              {conflict.activelyConnected.join(', ')} still {conflict.activelyConnected.length > 1 ? 'have' : 'has'} an
              active connected integration. Disabling the subscription won&apos;t disconnect it automatically.
            </p>
            <button
              onClick={() => save(true)}
              className="mt-2 text-xs font-semibold underline hover:text-amber-900"
              disabled={saving}
            >
              Disable anyway
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {plans.map((plan) => {
          const meta = CHANNEL_META[plan.channel_type] || { label: plan.channel_type, icon: MessageSquare };
          const Icon = meta.icon;
          const isOn = selected.has(plan.channel_type);
          const status = statusFor(plan.channel_type);
          const errorMessage = connectionErrorFor(plan.channel_type);
          const state = cardState(status, Boolean(errorMessage));
          const styles = CARD_STYLES[state];
          return (
            <button
              key={plan.id}
              onClick={() => toggle(plan.channel_type)}
              className={`group text-left rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 ${styles.card}`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2.5 font-semibold text-sm text-slate-800">
                  <span className={`p-1.5 rounded-lg transition-colors ${styles.iconBadge}`}>
                    <Icon size={15} />
                  </span>
                  {meta.label}
                </span>
                <span className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`w-9 h-5 rounded-full relative transition-colors duration-200 ${
                      isOn ? styles.toggleOn : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                        isOn ? 'translate-x-4' : ''
                      }`}
                    />
                  </span>
                  <StatusBadge state={state} errorMessage={errorMessage} />
                </span>
              </div>
              {state === 'failed' && (
                <p className="text-[11px] text-rose-600 mt-2 flex items-center gap-1">
                  <AlertTriangle size={11} className="shrink-0" /> {errorMessage}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-3">Platform fee</p>
              <p className="text-lg font-bold text-slate-800">{inr(plan.our_fee_amount)}/mo</p>
              <UsageRates channelType={plan.channel_type} rates={usageRates} />
            </button>
          );
        })}
      </div>

      <button
        onClick={() => save(false)}
        disabled={saving || payingFor}
        className="flex items-center gap-2 bg-gradient-brand text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-brand hover:shadow-brand-lg transition-shadow disabled:opacity-50 disabled:shadow-none"
      >
        {(saving || payingFor) && <Loader2 size={14} className="animate-spin" />}
        {payingFor ? 'Processing payment…' : saving ? 'Saving…' : 'Save Channel Subscriptions'}
      </button>
    </div>
  );
}