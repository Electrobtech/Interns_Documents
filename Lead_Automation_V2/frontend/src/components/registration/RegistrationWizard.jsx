'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { useToast, ToastStack } from '@/components/Toast';
import {
  validateStep1, validateStep2, validateStep3, validateStep4,
  validateStep5, validateStep6, validateStep7,
} from '@/lib/companyValidation';

import StepSidebar, { STEPS } from './StepSidebar';
import SecurityPanel from './SecurityPanel';
import Step1AccountOwner from './steps/Step1AccountOwner';
import Step2CompanyInfo from './steps/Step2CompanyInfo';
import Step3BusinessContact from './steps/Step3BusinessContact';
import Step4Address from './steps/Step4Address';
import Step5Verification from './steps/Step5Verification';
import Step6Subscription from './steps/Step6Subscription';
import Step7Finish from './steps/Step7Finish';

const INITIAL_FORM = {
  owner: { fullName: '', workEmail: '', mobile: '', password: '', confirmPassword: '', twoFactorEnabled: false, twoFactorMethod: null },
  company: { companyName: '', legalName: '', businessType: '', industry: '', website: '', employeeCount: '', description: '', logoUrl: null },
  contact: { companyEmail: '', companyPhone: '', supportEmail: '', alternatePhone: '' },
  address: { line1: '', line2: '', city: '', state: '', country: '', postalCode: '' },
  verification: { gstNumber: '', panNumber: '', registrationNumber: '', incorporationCertUrl: null, gstCertUrl: null, registrationCertUrl: null, emailVerified: false, mobileVerified: false },
  subscription: { plan: '', couponCode: '' },
  acceptTerms: false,
};

const VALIDATORS = {
  1: (f) => validateStep1(f.owner),
  2: (f) => validateStep2(f.company),
  3: (f) => validateStep3(f.contact),
  4: (f) => validateStep4(f.address),
  5: (f) => validateStep5(f.verification),
  6: (f) => validateStep6(f.subscription),
  7: (f) => validateStep7(f),
};

export default function RegistrationWizard() {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const percent = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  function updateSection(section, val) {
    setForm((f) => ({ ...f, [section]: val }));
  }

  function goNext() {
    const stepErrors = VALIDATORS[step](form);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) {
      toast.error('Please fix the highlighted fields before continuing.');
      return;
    }
    const next = Math.min(step + 1, STEPS.length);
    setStep(next);
    setFurthestStep((f) => Math.max(f, next));
    setErrors({});
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
    setErrors({});
  }

  function jumpTo(target) {
    if (target > furthestStep) return;
    setStep(target);
    setErrors({});
  }

  async function submit() {
    const stepErrors = validateStep7(form);
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length) return;

    setSubmitting(true);
    try {
      const payload = {
        owner: form.owner,
        company: { ...form.company, logoUrl: form.company.logoUrl },
        contact: form.contact,
        address: form.address,
        verification: form.verification,
        subscription: form.subscription,
        acceptTerms: form.acceptTerms,
      };
      const res = await api('/auth/register/company', { method: 'POST', body: payload });
      setToken(res.token);
      toast.success('Company created! Redirecting…');
      setTimeout(() => router.push('/'), 800);
    } catch (e) {
      toast.error(e.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8FC] relative overflow-hidden">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      {/* Background ambient glows */}
      <div className="pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full bg-rose-100/50 blur-[120px] z-0" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-purple-100/60 blur-[120px] z-0" />

      <header className="relative z-10 border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center">
            <img src="/logo-full.png" alt="ConnectSphere — Lead Automation Application" className="h-14 object-contain" />
          </a>
          <span className="text-xs text-slate-400">Already have an account? <a href="/login" className="text-rose-600 font-semibold hover:underline">Sign In</a></span>
        </div>
        {/* mobile progress bar */}
        <div className="lg:hidden h-1 bg-slate-100">
          <div className="h-full bg-violet-600 transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6 relative z-10">
        <StepSidebar step={step} furthestStep={furthestStep} onJump={jumpTo} />

        <main className="flex-1 min-w-0">
          <div key={step} className="bg-white rounded-3xl border border-slate-200/60 shadow-xl shadow-slate-100/50 p-6 sm:p-8 animate-[fadeIn_0.25s_ease]">
            {step === 1 && <Step1AccountOwner value={form.owner} errors={errors} onChange={(v) => updateSection('owner', v)} />}
            {step === 2 && <Step2CompanyInfo value={form.company} errors={errors} onChange={(v) => updateSection('company', v)} />}
            {step === 3 && <Step3BusinessContact value={form.contact} errors={errors} onChange={(v) => updateSection('contact', v)} />}
            {step === 4 && <Step4Address value={form.address} errors={errors} onChange={(v) => updateSection('address', v)} />}
            {step === 5 && (
              <Step5Verification value={form.verification} errors={errors} onChange={(v) => updateSection('verification', v)}
                ownerEmail={form.owner.workEmail} ownerMobile={form.owner.mobile} toast={toast} />
            )}
            {step === 6 && <Step6Subscription value={form.subscription} errors={errors} onChange={(v) => updateSection('subscription', v)} />}
            {step === 7 && <Step7Finish form={form} errors={errors} onChange={setForm} onEdit={jumpTo} />}

            <div className="flex items-center justify-between mt-7 pt-5 border-t border-slate-100">
              <button type="button" onClick={goBack} disabled={step === 1}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 disabled:opacity-0 disabled:pointer-events-none">
                <ChevronLeft size={16} /> Previous
              </button>

              {step < STEPS.length ? (
                <button type="button" onClick={goNext}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-violet-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg shadow-rose-500/10 hover:shadow-rose-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150">
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={submitting}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-rose-500 to-violet-600 text-white rounded-xl px-5 py-2.5 text-sm font-semibold shadow-lg shadow-rose-500/10 hover:shadow-rose-500/25 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />}
                  {submitting ? 'Creating…' : 'Create Company'}
                </button>
              )}
            </div>
          </div>
        </main>

        <SecurityPanel />
      </div>
    </div>
  );
}
