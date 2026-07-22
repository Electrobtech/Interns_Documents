'use client';
import { TextField } from '../FormField';

export default function Step4Address({ value, errors, onChange, lockedFields = [] }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const isLocked = (f) => lockedFields.includes(f);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Company Address</h3>
        <p className="text-xs text-slate-400 mt-0.5">Your registered business address.</p>
      </div>

      {lockedFields.length > 0 && (
        <p className="text-[11px] text-brand bg-brand/5 border border-brand/20 rounded-lg px-3 py-2">
          This address was auto-filled from your verified GST number (principal place of business). You can still edit it if needed.
        </p>
      )}

      <TextField label="Address Line 1" required placeholder="Street, building, suite" value={value.line1 || ''}
        disabled={isLocked('line1')} error={errors.line1} onChange={(e) => set({ line1: e.target.value })} />
      <TextField label="Address Line 2" placeholder="Apartment, floor (optional)" value={value.line2 || ''}
        onChange={(e) => set({ line2: e.target.value })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="City" required value={value.city || ''} error={errors.city}
          onChange={(e) => set({ city: e.target.value })} />
        <TextField label="District" value={value.district || ''} disabled={isLocked('district')}
          onChange={(e) => set({ district: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="State" required value={value.state || ''} disabled={isLocked('state')}
          error={errors.state} onChange={(e) => set({ state: e.target.value })} />
        <TextField label="Country" required value={value.country || ''} error={errors.country}
          onChange={(e) => set({ country: e.target.value })} />
      </div>

      <TextField label="Postal Code" required value={value.postalCode || ''} disabled={isLocked('postalCode')}
        error={errors.postalCode} onChange={(e) => set({ postalCode: e.target.value })} className="sm:w-1/2" />
    </div>
  );
}