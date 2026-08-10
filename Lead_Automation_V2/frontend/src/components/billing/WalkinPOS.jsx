'use client';
import { useEffect, useRef, useState } from 'react';
import { Banknote, QrCode, CheckCircle2, Loader2, X, IndianRupee, User, Phone, Mail } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';

const input =
  'w-full border border-slate-300 rounded-lg pl-9 pr-3 py-2.5 text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand';
const inputError = 'border-rose-400 focus:ring-rose-100 focus:border-rose-400';

// A 10-digit Indian mobile number, optionally prefixed with +91 / 91 / 0.
const PHONE_RE = /^(?:\+?91[\-\s]?|0)?[6-9]\d{9}$/;
// Standard, pragmatic email shape check (not exhaustive RFC 5322, but
// catches the mistakes people actually make while typing).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhone(v) {
  return v.replace(/[^\d+]/g, '');
}

export default function WalkinPOS() {
  const { call } = useApi();
  const [amount, setAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [method, setMethod] = useState('cash'); // 'cash' | 'qr'
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(null); // { order } after a cash sale
  const [qr, setQr] = useState(null); // { paymentId, shortUrl, qrImageUrl }
  const pollRef = useRef(null);

  useEffect(() => () => clearInterval(pollRef.current), []);

  function reset() {
    setAmount(''); setCustomerName(''); setCustomerPhone(''); setCustomerEmail('');
    setSuccess(null); setQr(null); setError(''); setFieldErrors({});
    clearInterval(pollRef.current);
  }

  function validate() {
    const value = Number(amount);
    const errors = {};
    if (!(value > 0)) errors.amount = 'Enter a valid amount';
    if (!customerName.trim()) errors.customerName = 'Enter the customer name';

    const phone = normalizePhone(customerPhone);
    if (!phone) errors.customerPhone = 'Enter the customer mobile number';
    else if (!PHONE_RE.test(phone)) errors.customerPhone = 'Enter a valid 10-digit mobile number';

    const email = customerEmail.trim();
    if (!email) errors.customerEmail = 'Enter the customer email';
    else if (!EMAIL_RE.test(email)) errors.customerEmail = 'Enter a valid email address';

    setFieldErrors(errors);
    return errors;
  }

  async function submit() {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setError(Object.values(errors)[0]);
      return;
    }
    const value = Number(amount);
    const phone = normalizePhone(customerPhone);
    const email = customerEmail.trim();
    setError('');
    setBusy(true);
    try {
      if (method === 'cash') {
        const res = await call('/billing/walkin/cash', {
          method: 'POST',
          body: {
            amount: value,
            description: `Walk-in — ${customerName}`,
            customerName,
            customerPhone: phone,
            customerEmail: email,
          },
        });
        setSuccess(res);
      } else {
        const res = await call('/billing/walkin/qr', {
          method: 'POST',
          body: {
            amount: value,
            customerName,
            customerPhone: phone,
            customerEmail: email,
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
      <div className="max-w-sm mx-auto text-center py-10 space-y-3 bg-white rounded-2xl border border-slate-200/80 shadow-card px-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
          <CheckCircle2 className="text-emerald-500" size={32} />
        </div>
        <p className="text-lg font-bold text-slate-800">Payment received</p>
        <p className="text-slate-500 text-sm">{inr(success.order?.amount ?? amount)} collected</p>
        <button
          onClick={reset}
          className="mt-4 bg-gradient-brand text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-brand hover:shadow-brand-lg transition-shadow"
        >
          New sale
        </button>
      </div>
    );
  }

  if (qr) {
    return (
      <div className="max-w-sm mx-auto text-center py-6 space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-card px-6">
        <p className="text-sm text-slate-500">Ask the customer to scan to pay <span className="font-semibold text-slate-700">{inr(amount)}</span></p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr.qrImageUrl} alt="Scan to pay" className="mx-auto rounded-xl border border-slate-200 p-2" width={220} height={220} />
        <a href={qr.shortUrl} target="_blank" rel="noreferrer" className="text-xs text-brand font-medium underline block">
          Or open payment link
        </a>
        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <Loader2 size={12} className="animate-spin" /> Waiting for payment…
        </div>
        <button onClick={cancelQr} className="flex items-center gap-1.5 mx-auto text-xs text-slate-500 hover:text-rose-600 transition-colors">
          <X size={13} /> Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-4 bg-white rounded-2xl border border-slate-200/80 shadow-card p-6">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Amount (₹)</label>
        <div className="relative">
          <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="number"
            min="1"
            step="0.01"
            className={`${input} ${fieldErrors.amount ? inputError : ''}`}
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        {fieldErrors.amount && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.amount}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Customer name</label>
        <div className="relative">
          <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className={`${input} ${fieldErrors.customerName ? inputError : ''}`}
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Full name"
          />
        </div>
        {fieldErrors.customerName && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.customerName}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Customer mobile number</label>
        <div className="relative">
          <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="tel"
            inputMode="tel"
            className={`${input} ${fieldErrors.customerPhone ? inputError : ''}`}
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            placeholder="10-digit mobile number"
            maxLength={16}
          />
        </div>
        {fieldErrors.customerPhone && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.customerPhone}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Customer email</label>
        <div className="relative">
          <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="email"
            inputMode="email"
            className={`${input} ${fieldErrors.customerEmail ? inputError : ''}`}
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="name@example.com"
          />
        </div>
        {fieldErrors.customerEmail && <p className="text-[11px] text-rose-600 mt-1">{fieldErrors.customerEmail}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          onClick={() => setMethod('cash')}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            method === 'cash' ? 'border-brand bg-brand/5 text-brand' : 'border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <Banknote size={15} /> Cash
        </button>
        <button
          onClick={() => setMethod('qr')}
          className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
            method === 'qr' ? 'border-brand bg-brand/5 text-brand' : 'border-slate-200 text-slate-600 hover:border-slate-300'
          }`}
        >
          <QrCode size={15} /> QR / UPI / Card
        </button>
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full flex items-center justify-center gap-2 bg-gradient-brand text-white rounded-xl py-2.5 text-sm font-semibold shadow-brand hover:shadow-brand-lg transition-shadow disabled:opacity-60 disabled:shadow-none"
      >
        {busy && <Loader2 size={14} className="animate-spin" />}
        {method === 'cash' ? 'Record cash sale' : 'Generate QR code'}
      </button>
    </div>
  );
}
    