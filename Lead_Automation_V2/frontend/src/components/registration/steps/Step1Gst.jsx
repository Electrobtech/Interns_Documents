'use client';
import { useState } from 'react';
import { CheckCircle2, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { TextField } from '../FormField';
import { api } from '@/lib/api';
import { isGst } from '@/lib/companyValidation';

// ---------------------------------------------------------------------
// Step 1 of the wizard. Was previously the GST portion of "Verification"
// (old Step 5) — moved to the front so a successful verify can auto-fill
// Company Information (Step 3) and Company Address (Step 5) before the
// person ever has to type them. Calls ONLY our own backend
// (POST /company/verify-gst) — never RapidAPI directly.
//
// `onVerified` bubbles the normalized result up to RegistrationWizard,
// which pushes it into the `company` and `address` sections and locks
// the auto-filled fields there until "Edit" is clicked here again.
// ---------------------------------------------------------------------
export default function Step1Gst({ value, errors, onChange, onVerified }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const gstChoice = value.hasGst || 'yes';
  const [status, setStatus] = useState(value.gstVerified ? 'success' : 'idle'); // idle | verifying | success | error
  const [error, setError] = useState('');

  function chooseGst(choice) {
    setStatus(choice === 'yes' && value.gstVerified ? 'success' : 'idle');
    setError('');
    set({ hasGst: choice });
  }

  async function verify() {
    const gst = (value.gstNumber || '').trim().toUpperCase();
    if (!isGst(gst)) {
      setStatus('error');
      setError('Enter a valid 15-character GST number (e.g. 22AAAAA0000A1Z5) before verifying.');
      return;
    }
    setStatus('verifying');
    setError('');
    try {
      const data = await api('/company/verify-gst', { method: 'POST', body: { gstNumber: gst } });
      set({
        gstNumber: data.gstNumber || gst,
        gstVerified: true,
        gstStatus: data.status || null,
        gstRegistrationDate: data.registrationDate || null,
      });
      onVerified?.(data);
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setError(e.message || 'GST verification failed. Please check the number and try again.');
    }
  }

  function editAgain() {
    setStatus('idle');
    setError('');
    set({ gstVerified: false, gstStatus: null, gstRegistrationDate: null });
  }

  const inactive = value.gstStatus && !/^active$/i.test(value.gstStatus);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-brand-dark">GST Verification</h3>
        <p className="text-xs text-slate-400 mt-0.5">
          If you have a GST number, verify it now and we'll auto-fill your company details on the next steps.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Do you have a GST Number?</label>
        <div className="flex gap-3">
          {[{ v: 'yes', label: 'I have a GST Number' }, { v: 'no', label: "I don't have a GST Number" }].map((opt) => (
            <label key={opt.v}
              className={`flex-1 cursor-pointer border rounded-lg px-3 py-2.5 text-xs font-medium flex items-center gap-2 ${
                gstChoice === opt.v ? 'border-brand bg-brand/5 text-brand-dark' : 'border-slate-200 text-slate-500'}`}>
              <input type="radio" name="hasGst" className="accent-brand" checked={gstChoice === opt.v}
                onChange={() => chooseGst(opt.v)} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      {gstChoice === 'yes' ? (
        <div className="space-y-2">
          <div className="flex items-end gap-3">
            <TextField label="GST Number" required placeholder="22AAAAA0000A1Z5" className="flex-1"
              value={value.gstNumber || ''} disabled={status === 'success'} error={errors.gstNumber}
              onChange={(e) => set({ gstNumber: e.target.value.toUpperCase() })} />
            {status === 'success' ? (
              <button type="button" onClick={editAgain}
                className="shrink-0 border border-slate-300 text-slate-600 rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-slate-50">
                Edit
              </button>
            ) : (
              <button type="button" onClick={verify} disabled={status === 'verifying'}
                className="shrink-0 bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
                {status === 'verifying' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                {status === 'verifying' ? 'Verifying…' : 'Verify GST'}
              </button>
            )}
          </div>

          {status === 'success' && (
            <div className={`flex items-start gap-2 text-xs rounded-lg px-3 py-2 border ${
              inactive ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
              {inactive ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
              <span>
                {inactive
                  ? `This GSTIN's status is "${value.gstStatus}". You can continue, but you may want to double-check the number.`
                  : 'GSTIN is active. Company name, trade name, business type, and address will be auto-filled on their steps — you can still edit them there.'}
              </span>
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-start gap-2 text-xs rounded-lg px-3 py-2 border bg-red-50 border-red-200 text-red-600">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> <span>{error}</span>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400 -mt-2">
          No problem — you'll fill in your company name, business type, and address manually on the next steps.
        </p>
      )}
    </div>
  );
}
