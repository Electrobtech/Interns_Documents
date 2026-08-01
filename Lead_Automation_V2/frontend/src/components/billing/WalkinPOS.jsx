'use client';
import { useEffect, useRef, useState } from 'react';
import { Banknote, QrCode, CheckCircle2, Loader2, X } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';

const input = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';

export default function WalkinPOS() {
  const { call } = useApi();
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [method, setMethod] = useState('cash'); // 'cash' | 'qr'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null); // { order } after a cash sale
  const [qr, setQr] = useState(null); // { paymentId, shortUrl, qrImageUrl }
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  function reset() {
    setAmount(''); setCustomerName(''); setCustomerPhone('');
    setSuccess(null); setQr(null); setError('');
    clearInterval(pollRef.current);
  }

  async function submit() {
    const value = Number(amount);
    if (!(value > 0)) { setError('Enter a valid amount'); return; }
    setBusy(true);
    setError('');
    try {
      if (method === 'cash') {
        const res = await call('/billing/walkin/cash', {
          method: 'POST',
          body: { amount: value, description: customerName ? `Walk-in — ${customerName}` : undefined },
        });
        setSuccess(res);
      } else {
        const res = await call('/billing/walkin/qr', {
          method: 'POST',
          body: {
            amount: value,
            customerName: customerName || undefined,
            customerPhone: customerPhone || undefined,
          },
        });
        setQr(res);
        pollRef.current = setInterval(async () => {
          try {
            const status = await call(`/billing/walkin/${res.paymentId}/status`);
            if (status.status === 'paid') {
              clearInterval(pollRef.current);
              setSuccess({ order: status.payment });
              setQr(null);
            } else if (status.status === 'failed') {
              clearInterval(pollRef.current);
              setError('Payment was cancelled or failed');
              setQr(null);
            }
          } catch { /* keep polling on transient errors */ }
        }, 3000);
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  async function cancelQr() {
    if (!qr) return;
    clearInterval(pollRef.current);
    try { await call(`/billing/walkin/${qr.paymentId}/cancel`, { method: 'POST' }); } catch {}
    reset();
  }

  if (success) {
    return (
      <div className="max-w-sm mx-auto text-center py-10 space-y-3">
        <CheckCircle2 className="mx-auto text-emerald-500" size={48} />
        <p className="text-lg font-semibold">Payment received</p>
        <p className="text-slate-500 text-sm">{inr(success.order?.amount ?? amount)} collected</p>
        <button onClick={reset} className="mt-4 bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium">
          New sale
        </button>
      </div>
    );
  }

  if (qr) {
    return (
      <div className="max-w-sm mx-auto text-center py-6 space-y-4">
        <p className="text-sm text-slate-500">Ask the customer to scan to pay {inr(amount)}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr.qrImageUrl} alt="Scan to pay" className="mx-auto rounded-xl border border-slate-200" width={220} height={220} />
        <a href={qr.shortUrl} target="_blank" rel="noreferrer" className="text-xs text-brand underline block">
          Or open payment link
        </a>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Waiting for payment…
        </div>
        <button onClick={cancelQr} className="flex items-center gap-1.5 mx-auto text-xs text-slate-500 hover:text-red-600">
          <X size={13} /> Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
        <input type="number" min="1" className={input} placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Customer name (optional)</label>
        <input className={input} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
      </div>
      {method === 'qr' && (
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Customer phone (optional, for SMS receipt)</label>
          <input className={input} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setMethod('cash')}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${
            method === 'cash' ? 'border-brand bg-brand/5 text-brand' : 'border-slate-300 text-slate-600'
          }`}
        >
          <Banknote size={15} /> Cash
        </button>
        <button
          onClick={() => setMethod('qr')}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${
            method === 'qr' ? 'border-brand bg-brand/5 text-brand' : 'border-slate-300 text-slate-600'
          }`}
        >
          <QrCode size={15} /> QR / UPI / Card
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-brand text-white rounded-lg py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {method === 'cash' ? 'Record cash sale' : 'Generate QR code'}
      </button>
    </div>
  );
}
