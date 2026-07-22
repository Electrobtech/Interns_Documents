'use client';
import { TextField } from '../FormField';

export default function Step3BusinessContact({ value, errors, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Business Contact</h3>
        <p className="text-xs text-slate-400 mt-0.5">How customers and support reach your company.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Company Email" required type="email" placeholder="hello@yourcompany.com" value={value.companyEmail || ''}
          error={errors.companyEmail} onChange={(e) => set({ companyEmail: e.target.value })} />
        <TextField label="Company Phone" required type="tel" placeholder="+91 22 1234 5678" value={value.companyPhone || ''}
          error={errors.companyPhone} onChange={(e) => set({ companyPhone: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Support Email" type="email" placeholder="support@yourcompany.com" value={value.supportEmail || ''}
          error={errors.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} />
        <TextField label="Alternate Phone" type="tel" placeholder="+91 98765 43210" value={value.alternatePhone || ''}
          error={errors.alternatePhone} onChange={(e) => set({ alternatePhone: e.target.value })} />
      </div>
    </div>
  );
}
