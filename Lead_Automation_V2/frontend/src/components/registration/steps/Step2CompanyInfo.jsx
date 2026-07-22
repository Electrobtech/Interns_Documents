'use client';
import { TextField, SelectField, TextAreaField } from '../FormField';
import FileDropzone from '../FileDropzone';
import { BUSINESS_TYPES, INDUSTRIES } from '@/lib/companyValidation';

export default function Step2CompanyInfo({ value, errors, onChange, lockedFields = [] }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const isLocked = (f) => lockedFields.includes(f);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Company Information</h3>
        <p className="text-xs text-slate-400 mt-0.5">Tell us about the company you're registering.</p>
      </div>

      {lockedFields.length > 0 && (
        <p className="text-[11px] text-brand bg-brand/5 border border-brand/20 rounded-lg px-3 py-2">
          Some fields below were auto-filled from your verified GST number. You can still edit them if needed.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Company Name" required placeholder="Acme Inc." value={value.companyName || ''}
          disabled={isLocked('companyName')} error={errors.companyName}
          onChange={(e) => set({ companyName: e.target.value })} />
        <TextField label="Legal Business Name" placeholder="Acme Incorporated Pvt. Ltd." value={value.legalName || ''}
          onChange={(e) => set({ legalName: e.target.value })} />
      </div>

      <TextField label="Trade Name" placeholder="Brand/trade name (if different from legal name)"
        value={value.tradeName || ''} disabled={isLocked('tradeName')}
        onChange={(e) => set({ tradeName: e.target.value })} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField label="Business Type" required options={BUSINESS_TYPES} value={value.businessType || ''}
          disabled={isLocked('businessType')} error={errors.businessType}
          onChange={(e) => set({ businessType: e.target.value })} />
        <SelectField label="Industry" required options={INDUSTRIES} value={value.industry || ''}
          error={errors.industry} onChange={(e) => set({ industry: e.target.value })} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Company Website" placeholder="https://yourcompany.com" value={value.website || ''}
          error={errors.website} onChange={(e) => set({ website: e.target.value })} />
        <TextField label="Number of Employees" placeholder="e.g. 11-50" value={value.employeeCount || ''}
          onChange={(e) => set({ employeeCount: e.target.value })} />
      </div>

      <FileDropzone label="Company Logo" kind="logo" accept=".png,.jpg,.jpeg"
        hint="PNG or JPG, up to 10 MB" value={value.logo || null}
        onChange={(file) => set({ logo: file, logoUrl: file?.url || null })} />

      <TextAreaField label="Description" placeholder="A short description of what your company does…"
        value={value.description || ''} onChange={(e) => set({ description: e.target.value })} />
    </div>
  );
}