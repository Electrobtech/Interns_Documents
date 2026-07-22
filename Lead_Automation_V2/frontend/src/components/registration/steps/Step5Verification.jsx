'use client';
import { useState } from 'react';
import { MailCheck, PhoneCall, CheckCircle2, Loader2 } from 'lucide-react';
import { TextField } from '../FormField';
import FileDropzone from '../FileDropzone';
import { api } from '@/lib/api';

function OtpVerifier({ channel, target, verified, onVerified, toast }) {
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const Icon = channel === 'email' ? MailCheck : PhoneCall;

  async function send() {
    if (!target) return;
    setBusy(true);
    try {
      const res = await api(`/auth/verify/${channel}`, { method: 'POST', body: { [channel]: target } });
      setSent(true);
      toast?.success(res.devCode ? `Code sent. Dev code: ${res.devCode}` : 'Verification code sent.');
    } catch (e) {
      toast?.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!code) return;
    setBusy(true);
    try {
      await api(`/auth/verify/${channel}`, { method: 'POST', body: { [channel]: target, code } });
      onVerified(true);
      toast?.success(`${channel === 'email' ? 'Email' : 'Mobile'} verified.`);
    } catch (e) {
      toast?.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <div className="flex items-center gap-2 text-emerald-600 text-xs font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
        <CheckCircle2 size={15} /> {channel === 'email' ? 'Email' : 'Mobile'} verified — {target}
      </div>
    );
  }

  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <Icon size={15} className="text-brand" /> {target || `No ${channel} on file`}
        </span>
        <button type="button" disabled={!target || busy} onClick={send}
          className="text-xs font-medium text-brand disabled:text-slate-300 shrink-0">
          {busy && !sent ? <Loader2 size={14} className="animate-spin" /> : sent ? 'Resend code' : 'Send code'}
        </button>
      </div>
      {sent && (
        <div className="flex gap-2 mt-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" maxLength={6}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none focus:ring-2 focus:ring-brand/30" />
          <button type="button" onClick={confirm} disabled={busy}
            className="bg-brand text-white rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50">
            Verify
          </button>
        </div>
      )}
    </div>
  );
}

export default function Step5Verification({ value, errors, onChange, ownerEmail, ownerMobile, toast }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Verification</h3>
        <p className="text-xs text-slate-400 mt-0.5">Confirm your contact details and (optionally) your business registration documents.</p>
      </div>

      <div className="space-y-2.5">
        <OtpVerifier channel="email" target={ownerEmail} verified={!!value.emailVerified}
          onVerified={(v) => set({ emailVerified: v })} toast={toast} />
        <OtpVerifier channel="mobile" target={ownerMobile} verified={!!value.mobileVerified}
          onVerified={(v) => set({ mobileVerified: v })} toast={toast} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="PAN Number" placeholder="AAAAA0000A" value={value.panNumber || ''}
          error={errors.panNumber} onChange={(e) => set({ panNumber: e.target.value.toUpperCase() })} />
        <TextField label="Company Registration Number" value={value.registrationNumber || ''}
          onChange={(e) => set({ registrationNumber: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FileDropzone label="Incorporation Certificate" kind="incorporation" value={value.incorporationCert || null}
          onChange={(f) => set({ incorporationCert: f, incorporationCertUrl: f?.url || null })} />
        <FileDropzone label="GST Certificate" kind="gst" value={value.gstCert || null}
          onChange={(f) => set({ gstCert: f, gstCertUrl: f?.url || null })} />
        <FileDropzone label="Registration Certificate" kind="registration" value={value.registrationCert || null}
          onChange={(f) => set({ registrationCert: f, registrationCertUrl: f?.url || null })} />
      </div>
    </div>
  );
}
