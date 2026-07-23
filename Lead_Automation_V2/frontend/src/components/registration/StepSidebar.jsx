'use client';
import { Check, User, Building2, Phone, MapPin, ShieldCheck, CreditCard, PartyPopper } from 'lucide-react';

export const STEPS = [
  { id: 1, title: 'Account Owner', icon: User },
  { id: 2, title: 'Company Information', icon: Building2 },
  { id: 3, title: 'Business Contact', icon: Phone },
  { id: 4, title: 'Company Address', icon: MapPin },
  { id: 5, title: 'Verification', icon: ShieldCheck },
  { id: 6, title: 'Subscription', icon: CreditCard },
  { id: 7, title: 'Finish', icon: PartyPopper },
];

export default function StepSidebar({ step, furthestStep, onJump }) {
  const percent = Math.round((step / STEPS.length) * 100);

  return (
    <aside className="lg:w-64 shrink-0">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 lg:sticky lg:top-6">
        <div className="mb-5 hidden lg:block">
          <h2 className="text-sm font-bold text-slate-800">Create your company</h2>
          <p className="text-xs text-slate-400 mt-0.5">Step {step} of {STEPS.length}</p>
          <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-violet-600 rounded-full transition-all duration-500" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{percent}% complete</p>
        </div>

        {/* Desktop: vertical list. Mobile: horizontal scroll strip. */}
        <ol className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible -mx-1 px-1 lg:mx-0 lg:px-0">
          {STEPS.map((s) => {
            const state = s.id < step ? 'done' : s.id === step ? 'active' : 'upcoming';
            const clickable = s.id <= furthestStep;
            const Icon = s.icon;
            return (
              <li key={s.id} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => clickable && onJump(s.id)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors
                    ${state === 'active' ? 'bg-violet-50 text-violet-700 font-bold' : clickable ? 'hover:bg-slate-50 text-slate-600' : 'text-slate-300 cursor-not-allowed'}`}
                >
                  <span className={`w-7 h-7 rounded-full grid place-items-center shrink-0 text-xs font-semibold
                    ${state === 'done' ? 'bg-emerald-500 text-white' : state === 'active' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    {state === 'done' ? <Check size={14} /> : <Icon size={14} />}
                  </span>
                  <span className="text-xs font-medium whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </aside>
  );
}
