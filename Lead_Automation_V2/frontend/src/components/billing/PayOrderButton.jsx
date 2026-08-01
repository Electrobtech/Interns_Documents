'use client';
import { useState } from 'react';
import { Loader2, CreditCard } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { openCheckout } from '@/lib/billing';

// Drop into any order row/detail view: <PayOrderButton order={order} onPaid={reload} />
export default function PayOrderButton({ order, onPaid, className }) {
  const { call } = useApi();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (order.status === 'paid') {
    return <span className="text-xs font-medium text-emerald-600">Paid</span>;
  }

  async function pay() {
    setBusy(true);
    setError('');
    try {
      const checkoutOrder = await call(`/billing/orders/${order.id}/checkout`, { method: 'POST' });
      const result = await openCheckout({
        keyId: checkoutOrder.keyId,
        orderId: checkoutOrder.orderId,
        amount: checkoutOrder.amount,
        currency: checkoutOrder.currency,
        description: `Order ${order.id.slice(0, 8)}`,
      });
      const verified = await call(`/billing/orders/${order.id}/verify`, {
        method: 'POST',
        body: { orderId: result.orderId, paymentId: result.paymentId, signature: result.signature },
      });
      onPaid?.(verified.order);
    } catch (e) {
      setError(e.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={pay}
        disabled={busy}
        className={className || 'flex items-center gap-1.5 bg-brand text-white rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60'}
      >
        {busy ? <Loader2 size={13} className="animate-spin" /> : <CreditCard size={13} />}
        {busy ? 'Processing…' : 'Pay Now'}
      </button>
      {error && <p className="text-[11px] text-red-600 mt-1">{error}</p>}
    </div>
  );
}
