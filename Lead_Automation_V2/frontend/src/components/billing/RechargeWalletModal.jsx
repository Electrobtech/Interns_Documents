'use client';
import { useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import Modal from '@/components/Modal';
import { useApi } from '@/lib/useApi';
import { openCheckout, inr } from '@/lib/billing';

// Self-serve top-up for the campaigns/broadcasts wallet. Two-step flow
// matching billing-service: create a Razorpay order, open Checkout, then
// verify the signature server-side before crediting — see
// services/billing-service/src/routes/wallet.js.
export default function RechargeWalletModal({ open, onClose, onRecharged }) {
  const { call } = useApi();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const quickAmounts = [500, 1000, 2500, 5000, 10000];

  async function pay() {
    const value = Number(amount);
    if (!(value > 0)) {
      setError('Enter a valid amount');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const order = await call('/billing/wallet/recharge-order', { method: 'POST', body: { amount: value } });
      const result = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amount: order.amount,
        currency: order.currency,
        description: 'Wallet recharge',
      });
      const verified = await call('/billing/wallet/verify', {
        method: 'POST',
        body: { orderId: result.orderId, paymentId: result.paymentId, signature: result.signature },
      });
      onRecharged?.(verified.wallet);
      setAmount('');
      onClose();
    } catch (e) {
      setError(e.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} title="Recharge Wallet" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Wallet size={16} />
          Funds your prepaid balance used for WhatsApp sends and workflow runs.
        </div>

        <div className="grid grid-cols-3 gap-2">
          {quickAmounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(String(a))}
              className={`text-sm rounded-lg border px-3 py-2 ${
                String(a) === amount ? 'border-brand bg-brand/5 text-brand font-medium' : 'border-slate-300 text-slate-600'
              }`}
            >
              {inr(a)}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
          <input
            type="number"
            min="1"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={pay}
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 bg-brand text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? 'Processing…' : `Pay ${amount ? inr(amount) : ''}`}
        </button>
      </div>
    </Modal>
  );
}
