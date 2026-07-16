'use client';
import { useState } from 'react';
import { Eye, EyeOff, Smartphone, KeyRound } from 'lucide-react';
import { TextField } from '../FormField';
import PasswordStrengthMeter from '../PasswordStrengthMeter';

export default function Step1AccountOwner({ value, errors, onChange }) {
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Account Owner</h3>
        <p className="text-xs text-slate-400 mt-0.5">This person will be the primary owner of your company account.</p>
      </div>

      <TextField label="Full Name" required placeholder="Jane Doe" value={value.fullName || ''}
        error={errors.fullName} onChange={(e) => set({ fullName: e.target.value })} />

      <TextField label="Work Email" required type="email" placeholder="jane@yourcompany.com" value={value.workEmail || ''}
        error={errors.workEmail} onChange={(e) => set({ workEmail: e.target.value })} />

      <TextField label="Mobile Number" required type="tel" placeholder="+91 98765 43210" value={value.mobile || ''}
        error={errors.mobile} onChange={(e) => set({ mobile: e.target.value })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Password <span className="text-red-400">*</span></label>
          <div className="relative">
            <input type={showPw ? 'text' : 'password'} value={value.password || ''}
              onChange={(e) => set({ password: e.target.value })}
              className={`w-full border rounded-lg px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-brand/30 ${errors.password ? 'border-red-300' : 'border-slate-300 focus:border-brand'}`} />
            <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <PasswordStrengthMeter password={value.password} />
          {errors.password && <p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1.5">Confirm Password <span className="text-red-400">*</span></label>
          <div className="relative">
            <input type={showConfirm ? 'text' : 'password'} value={value.confirmPassword || ''}
              onChange={(e) => set({ confirmPassword: e.target.value })}
              className={`w-full border rounded-lg px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-brand/30 ${errors.confirmPassword ? 'border-red-300' : 'border-slate-300 focus:border-brand'}`} />
            <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400">
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-[11px] text-red-500 mt-1">{errors.confirmPassword}</p>}
        </div>
      </div>

      <div className="border border-slate-200 rounded-xl p-4">
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" checked={!!value.twoFactorEnabled}
            onChange={(e) => set({ twoFactorEnabled: e.target.checked, twoFactorMethod: e.target.checked ? value.twoFactorMethod : null })}
            className="w-4 h-4 rounded accent-brand" />
          <span className="text-sm font-medium text-slate-700">Enable Two-Factor Authentication</span>
        </label>

        {value.twoFactorEnabled && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <button type="button" onClick={() => set({ twoFactorMethod: 'authenticator' })}
              className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-xs font-medium transition-colors
                ${value.twoFactorMethod === 'authenticator' ? 'border-brand bg-brand-light text-brand-dark' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              <KeyRound size={15} /> Authenticator App
            </button>
            <button type="button" onClick={() => set({ twoFactorMethod: 'sms' })}
              className={`flex items-center gap-2 border rounded-lg px-3 py-2.5 text-xs font-medium transition-colors
                ${value.twoFactorMethod === 'sms' ? 'border-brand bg-brand-light text-brand-dark' : 'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              <Smartphone size={15} /> SMS Authentication
            </button>
          </div>
        )}
        {errors.twoFactorMethod && <p className="text-[11px] text-red-500 mt-1.5">{errors.twoFactorMethod}</p>}
      </div>
    </div>
  );
}
