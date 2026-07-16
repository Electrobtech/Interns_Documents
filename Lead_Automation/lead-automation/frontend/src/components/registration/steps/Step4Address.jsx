'use client';
import { TextField } from '../FormField';

export default function Step4Address({ value, errors, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Company Address</h3>
        <p className="text-xs text-slate-400 mt-0.5">Your registered business address.</p>
      </div>

      <TextField label="Address Line 1" required placeholder="Street, building, suite" value={value.line1 || ''}
        error={errors.line1} onChange={(e) => set({ line1: e.target.value })} />
      <TextField label="Address Line 2" placeholder="Apartment, floor (optional)" value={value.line2 || ''}
        onChange={(e) => set({ line2: e.target.value })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="City" required value={value.city || ''} error={errors.city}
          onChange={(e) => set({ city: e.target.value })} />
        <TextField label="State" required value={value.state || ''} error={errors.state}
          onChange={(e) => set({ state: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Country" required value={value.country || ''} error={errors.country}
          onChange={(e) => set({ country: e.target.value })} />
        <TextField label="Postal Code" required value={value.postalCode || ''} error={errors.postalCode}
          onChange={(e) => set({ postalCode: e.target.value })} />
      </div>
    </div>
  );
}
