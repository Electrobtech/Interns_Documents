'use client';

// Controlled field set for company details — Company Legal Name, Official
// Email, Industry, Subscription Plan, Contact Person, Phone, Address, and
// (optionally) Status. Fully controlled: the parent owns `value` and gets
// notified of every keystroke via `onChange`, so both the super-admin
// Add/Edit dialogs and the public registration page can wrap this in
// whatever submit/validation flow they need without duplicating markup.
export const EMPTY_COMPANY_FORM = {
  name: '',
  email: '',
  industry: '',
  plan: 'starter',
  contactPerson: '',
  phone: '',
  address: '',
  status: 'pending',
};

// Minimal required-field check shared by every caller — name + email are
// the only two fields that matter enough to block submission on; everything
// else is optional and falls back to 'N/A' at render time if left blank.
export function validateCompanyForm(value) {
  const errors = {};
  if (!value.name?.trim()) errors.name = 'Company name is required';
  if (!value.email?.trim()) {
    errors.email = 'Email is required';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim())) {
    errors.email = 'Enter a valid email address';
  }
  return errors;
}

const inputClass =
  'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
const errorInputClass =
  'w-full rounded-md border border-red-400 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400';
const labelClass = 'text-sm font-medium text-slate-700';

export default function CompanyForm({ value, onChange, errors = {}, showStatus = false, idPrefix = 'company' }) {
  function update(field, fieldValue) {
    onChange({ ...value, [field]: fieldValue });
  }

  const id = (field) => `${idPrefix}-${field}`;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={id('name')}>Company legal name</label>
        <input
          id={id('name')}
          className={errors.name ? errorInputClass : inputClass}
          value={value.name || ''}
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Vantage Retail Co."
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={id('email')}>Official email address</label>
        <input
          id={id('email')}
          type="email"
          className={errors.email ? errorInputClass : inputClass}
          value={value.email || ''}
          onChange={(e) => update('email', e.target.value)}
          placeholder="contact@company.com"
        />
        {errors.email && <p className="text-xs text-red-600">{errors.email}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor={id('industry')}>Industry type</label>
          <input
            id={id('industry')}
            className={inputClass}
            value={value.industry || ''}
            onChange={(e) => update('industry', e.target.value)}
            placeholder="Technology"
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor={id('plan')}>Subscription plan</label>
          <select
            id={id('plan')}
            className={inputClass}
            value={value.plan || 'starter'}
            onChange={(e) => update('plan', e.target.value)}
          >
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor={id('contactPerson')}>Contact person name</label>
          <input
            id={id('contactPerson')}
            className={inputClass}
            value={value.contactPerson || ''}
            onChange={(e) => update('contactPerson', e.target.value)}
            placeholder="Jane Doe"
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor={id('phone')}>Phone number</label>
          <input
            id={id('phone')}
            type="tel"
            className={inputClass}
            value={value.phone || ''}
            onChange={(e) => update('phone', e.target.value)}
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label className={labelClass} htmlFor={id('address')}>Business address / location</label>
        <input
          id={id('address')}
          className={inputClass}
          value={value.address || ''}
          onChange={(e) => update('address', e.target.value)}
          placeholder="123 Business Park, Bengaluru, Karnataka"
        />
      </div>

      {showStatus && (
        <div className="space-y-1.5">
          <label className={labelClass} htmlFor={id('status')}>Status</label>
          <select
            id={id('status')}
            className={inputClass}
            value={value.status || 'pending'}
            onChange={(e) => update('status', e.target.value)}
          >
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      )}
    </div>
  );
}