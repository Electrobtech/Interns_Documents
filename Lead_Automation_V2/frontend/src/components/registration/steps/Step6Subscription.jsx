'use client';
import { Check, Tag } from 'lucide-react';

// `amount` (₹, numeric) drives the Razorpay charge run right after the
// company is created — see RegistrationWizard.jsx's submit(). Must match
// PAID_PLAN_PRICES in services/auth-service/src/controllers/companyController.js
// and PLAN_PRICES in services/billing-service/src/routes/subscriptionPlan.js.
// Enterprise has no `amount` on purpose — it's sales-quoted, not charged here.
const PLANS = [
  {
    id: 'starter', name: 'Starter', price: '₹1,999', period: '/mo', amount: 1999,
    features: ['1 channel', 'Up to 3 team seats', 'Unified inbox', 'Basic analytics'],
  },
  {
    id: 'professional', name: 'Professional', price: '₹5,999', period: '/mo', amount: 5999, highlight: true,
    features: ['Up to 5 channels', 'Up to 15 team seats', 'Campaigns & automation', 'Advanced analytics', 'Priority support'],
  },
  {
    id: 'enterprise', name: 'Enterprise', price: 'Custom', period: '',
    features: ['Unlimited channels', 'Unlimited seats', 'Custom AI agents', 'Dedicated success manager', 'SLA & SSO'],
  },
];

export { PLANS };

export default function Step6Subscription({ value, errors, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold text-brand-dark">Subscription</h3>
        <p className="text-xs text-slate-400 mt-0.5">Choose a plan to get started — you can change this anytime.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map((plan) => {
          const selected = value.plan === plan.id;
          return (
            <div key={plan.id}
              className={`relative rounded-2xl border p-5 flex flex-col transition-all
                ${selected ? 'border-brand ring-2 ring-brand/20 shadow-sm' : 'border-slate-200 hover:border-slate-300'}
                ${plan.highlight ? 'bg-brand-light/40' : 'bg-white'}`}>
              {plan.highlight && (
                <span className="absolute -top-2.5 left-5 bg-brand text-white text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Most popular
                </span>
              )}
              <h4 className="text-sm font-bold text-slate-800">{plan.name}</h4>
              <p className="mt-1"><span className="text-2xl font-bold text-brand-dark">{plan.price}</span>
                <span className="text-xs text-slate-400">{plan.period}</span></p>
              <ul className="mt-3 space-y-1.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-slate-500">
                    <Check size={13} className="text-emerald-500 mt-0.5 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => set({ plan: plan.id })}
                className={`mt-4 rounded-lg py-2 text-xs font-semibold transition-colors
                  ${selected ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                {selected ? 'Selected' : 'Select'}
              </button>
            </div>
          );
        })}
      </div>
      {errors.plan && <p className="text-[11px] text-red-500">{errors.plan}</p>}

      {value.plan && value.plan !== 'enterprise' && (
        <p className="text-[11px] text-slate-400">
          You'll be asked to pay for the {PLANS.find((p) => p.id === value.plan)?.name} plan via Razorpay right after your company is created.
        </p>
      )}
      {value.plan === 'enterprise' && (
        <p className="text-[11px] text-slate-400">
          Enterprise pricing is custom — our sales team will reach out to set up billing after your company is created.
        </p>
      )}

      <div className="max-w-xs">
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Coupon Code</label>
        <div className="relative">
          <Tag size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={value.couponCode || ''} onChange={(e) => set({ couponCode: e.target.value.toUpperCase() })}
            placeholder="Optional" className="w-full border border-slate-300 rounded-lg pl-8 pr-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30" />
        </div>
      </div>
    </div>
  );
}
