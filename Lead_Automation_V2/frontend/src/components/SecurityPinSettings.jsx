'use client';
import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, CheckCircle2, AlertTriangle, CalendarClock, CalendarX2 } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import PinInput from '@/components/PinInput';

const PIN_LENGTH = 6; // must match src/app/login/page.jsx's PIN_LENGTH

// Settings › Security tab: lets an already-logged-in user create or
// replace their PIN (POST /auth/setup-pin). This is the "change PIN"
// path — a user who forgot their PIN entirely uses the password fallback
// on the login screen to get a session, then lands back here.
const DATE_FMT = { day: 'numeric', month: 'short', year: 'numeric' };

export default function SecurityPinSettings() {
  const { call } = useApi();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { isPinEnabled, createdAt, expiresAt, daysRemaining, isExpired }

  const loadStatus = useCallback(async () => {
    try {
      const data = await call('/auth/pin-status');
      setStatus(data);
    } catch {
      // Status card is a nice-to-have; a failed fetch just leaves it hidden.
    }
  }, [call]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setSuccess(false);

    if (pin.length !== PIN_LENGTH) {
      setErr(`PIN must be exactly ${PIN_LENGTH} digits`);
      return;
    }
    if (pin !== confirmPin) {
      setErr('PINs do not match');
      return;
    }

    setBusy(true);
    try {
      await call('/auth/setup-pin', { method: 'POST', body: { pin } });
      setSuccess(true);
      setPin('');
      setConfirmPin('');
      loadStatus();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 rounded-xl bg-gradient-to-br from-violet-50 to-purple-100 text-violet-600 shadow-sm">
          <ShieldCheck size={18} />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-800">PIN Login</h3>
          <p className="text-xs text-slate-500">Sign in faster with a {PIN_LENGTH}-digit PIN instead of your password.</p>
        </div>
      </div>

      {status?.isPinEnabled && <div className="mb-5"><PinStatusCard status={status} /></div>}

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 text-center">
            New PIN
          </label>
          <PinInput length={PIN_LENGTH} value={pin} onChange={setPin} disabled={busy} invalid={!!err} />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-2 text-center">
            Confirm PIN
          </label>
          <PinInput length={PIN_LENGTH} value={confirmPin} onChange={setConfirmPin} disabled={busy} invalid={!!err} />
        </div>

        {err && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
            <AlertTriangle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{err}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
            <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
            <p className="text-xs text-emerald-700">PIN saved. You can now sign in with it.</p>
          </div>
        )}

        <button
          disabled={busy || pin.length !== PIN_LENGTH || confirmPin.length !== PIN_LENGTH}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-rose-500/20 transition-all duration-150 hover:shadow-rose-500/35 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? 'Saving…' : 'Save PIN'}
        </button>
        <p className="text-xs text-slate-400">
          Avoid repeated digits (1111), sequential runs (1234), or other common PINs — these are rejected automatically.
        </p>
      </form>
    </div>
  );
}

// Created / expires summary for the PIN currently on file. PINs expire 30
// days after they're set (services/auth-service/src/controllers/pinController.js),
// so this is purely informational — the backend is what actually enforces it.
function PinStatusCard({ status }) {
  const { createdAt, expiresAt, daysRemaining, isExpired } = status;

  let tone = 'ok'; // ok | warning | expired
  if (isExpired) tone = 'expired';
  else if (daysRemaining <= 7) tone = 'warning';

  const styles = {
    ok: { wrap: 'bg-slate-50 border-slate-200', icon: 'text-slate-400', text: 'text-slate-600', accent: 'text-slate-700' },
    warning: { wrap: 'bg-amber-50 border-amber-200', icon: 'text-amber-500', text: 'text-amber-700', accent: 'text-amber-800' },
    expired: { wrap: 'bg-red-50 border-red-200', icon: 'text-red-500', text: 'text-red-700', accent: 'text-red-800' },
  }[tone];

  const Icon = tone === 'expired' ? CalendarX2 : CalendarClock;

  const formattedCreated = createdAt ? new Date(createdAt).toLocaleDateString(undefined, DATE_FMT) : '—';
  const formattedExpires = expiresAt ? new Date(expiresAt).toLocaleDateString(undefined, DATE_FMT) : '—';

  return (
    <div className={`rounded-xl border px-4 py-3 ${styles.wrap}`}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`mt-0.5 shrink-0 ${styles.icon}`} />
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs w-full">
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold mb-0.5">Created</p>
            <p className={`font-medium ${styles.text}`}>{formattedCreated}</p>
          </div>
          <div>
            <p className="text-slate-400 uppercase tracking-wide text-[10px] font-semibold mb-0.5">Expires</p>
            <p className={`font-medium ${styles.text}`}>{formattedExpires}</p>
          </div>
          <div className="col-span-2 pt-1">
            {isExpired ? (
              <p className={`font-semibold ${styles.accent}`}>PIN expired — set a new one below to keep using PIN login.</p>
            ) : (
              <p className={`font-semibold ${styles.accent}`}>
                {daysRemaining} day{daysRemaining === 1 ? '' : 's'} left before it expires and you'll need to set a new one.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}