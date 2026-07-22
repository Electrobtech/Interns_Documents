'use client';
import { Pencil } from 'lucide-react';

function SummaryRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-xs py-1.5">
      <span className="text-slate-400">{label}</span>
      <span className="text-slate-700 font-medium text-right">{value}</span>
    </div>
  );
}

function SummaryCard({ title, stepId, onEdit, children }) {
  return (
    <div className="border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">{title}</h4>
        <button type="button" onClick={() => onEdit(stepId)} className="flex items-center gap-1 text-[11px] text-brand font-medium">
          <Pencil size={11} /> Edit
        </button>
      </div>
      {children}
    </div>
  );
}

export default function Step7Finish({ form, errors, onChange, onEdit }) {
  const { gst, owner, company, contact, address, verification, subscription } = form;
  const set = (patch) => onChange({ ...form, ...patch });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Review & Finish</h3>
        <p className="text-xs text-slate-400 mt-0.5">Check everything looks right, then create your company.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard title="GST" stepId={1} onEdit={onEdit}>
          <SummaryRow label="GSTIN" value={gst.hasGst === 'yes' ? gst.gstNumber : 'Not provided'} />
          <SummaryRow label="Verified" value={gst.hasGst === 'yes' ? (gst.gstVerified ? 'Yes' : 'No') : null} />
        </SummaryCard>

        <SummaryCard title="Account Owner" stepId={2} onEdit={onEdit}>
          <SummaryRow label="Name" value={owner.fullName} />
          <SummaryRow label="Email" value={owner.workEmail} />
          <SummaryRow label="Mobile" value={owner.mobile} />
          <SummaryRow label="2FA" value={owner.twoFactorEnabled ? owner.twoFactorMethod : 'Disabled'} />
        </SummaryCard>

        <SummaryCard title="Company" stepId={3} onEdit={onEdit}>
          <SummaryRow label="Name" value={company.companyName} />
          <SummaryRow label="Type" value={company.businessType} />
          <SummaryRow label="Industry" value={company.industry} />
          <SummaryRow label="Website" value={company.website} />
        </SummaryCard>

        <SummaryCard title="Business Contact" stepId={4} onEdit={onEdit}>
          <SummaryRow label="Email" value={contact.companyEmail} />
          <SummaryRow label="Phone" value={contact.companyPhone} />
        </SummaryCard>

        <SummaryCard title="Address" stepId={5} onEdit={onEdit}>
          <SummaryRow label="Address" value={[address.line1, address.line2].filter(Boolean).join(', ')} />
          <SummaryRow label="City / State" value={[address.city, address.state].filter(Boolean).join(', ')} />
          <SummaryRow label="Country" value={[address.country, address.postalCode].filter(Boolean).join(' ')} />
        </SummaryCard>

        <SummaryCard title="Verification" stepId={6} onEdit={onEdit}>
          <SummaryRow label="PAN" value={verification.panNumber} />
          <SummaryRow label="Email verified" value={verification.emailVerified ? 'Yes' : 'No'} />
        </SummaryCard>

        <SummaryCard title="Subscription" stepId={7} onEdit={onEdit}>
          <SummaryRow label="Plan" value={subscription.plan} />
          <SummaryRow label="Coupon" value={subscription.couponCode} />
        </SummaryCard>
      </div>

      <label className="flex items-start gap-2.5 border border-slate-200 rounded-xl p-4 cursor-pointer">
        <input type="checkbox" checked={!!form.acceptTerms}
          onChange={(e) => set({ acceptTerms: e.target.checked })}
          className="w-4 h-4 mt-0.5 rounded accent-brand" />
        <span className="text-xs text-slate-600">
          I have reviewed the details above and accept the <a className="text-brand font-medium">Terms of Service</a> and <a className="text-brand font-medium">Privacy Policy</a>.
        </span>
      </label>
      {errors.acceptTerms && <p className="text-[11px] text-red-500">{errors.acceptTerms}</p>}
    </div>
  );
}
