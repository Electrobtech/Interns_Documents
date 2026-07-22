'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Loader2, Rocket } from 'lucide-react';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';
import { useToast, ToastStack } from '@/components/Toast';
import {
  validateGst, validateStep1, validateStep2, validateStep3, validateStep4,
  validateStep5, validateStep6, validateStep7, mapGstConstitution,
} from '@/lib/companyValidation';

import StepSidebar, { STEPS } from './StepSidebar';
import SecurityPanel from './SecurityPanel';
import Step1Gst from './steps/Step1Gst';
import Step1AccountOwner from './steps/Step1AccountOwner';
import Step2CompanyInfo from './steps/Step2CompanyInfo';
import Step3BusinessContact from './steps/Step3BusinessContact';
import Step4Address from './steps/Step4Address';
import Step5Verification from './steps/Step5Verification';
import Step6Subscription from './steps/Step6Subscription';
import Step7Finish from './steps/Step7Finish';

const INITIAL_FORM = {
  // GST now lives in its own section (Step 1), separate from `verification`
  // (OTP + PAN + docs, now Step 6). Kept separate from `verification` in
  // state, but merged back into a single `verification` object on submit
  // so the backend payload shape (POST /auth/register/company) is unchanged.
  gst: { hasGst: 'yes', gstNumber: '', gstVerified: false, gstStatus: null, gstRegistrationDate: null },
  owner: { fullName: '', workEmail: '', mobile: '', password: '', confirmPassword: '', twoFactorEnabled: false, twoFactorMethod: null },
  company: { companyName: '', tradeName: '', legalName: '', businessType: '', industry: '', website: '', employeeCount: '', description: '', logoUrl: null },
  contact: { companyEmail: '', companyPhone: '', supportEmail: '', alternatePhone: '' },
  address: { line1: '', line2: '', city: '', district: '', state: '', country: '', postalCode: '' },
  verification: {
    panNumber: '', registrationNumber: '', incorporationCertUrl: null, gstCertUrl: null, registrationCertUrl: null,
    emailVerified: false, mobileVerified: false,
  },
  subscription: { plan: '', couponCode: '' },
  acceptTerms: false,
};

const VALIDATORS = {
  1: (f) => validateGst(f.gst),
  2: (f) => validateStep1(f.owner),
  3: (f) => validateStep2(f.company),
  4: (f) => validateStep3(f.contact),
  5: (f) => validateStep4(f.address),
  6: (f) => validateStep5(f.verification),
  7: (f) => validateStep6(f.subscription),
  8: (f) => validateStep7(f),
};

export default function RegistrationWizard() {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [step, setStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  // Which company/address fields GST actually returned a value for on the
  // last successful verify — NOT the same as "which fields are lockable".
  // A field only gets locked if it's both lockable AND GST actually filled
  // it; otherwise an empty field would be locked with no way to type into
  // it (exactly what happened when this provider didn't return a state).
  const [gstFilledFields, setGstFilledFields] = useState({ company: [], address: [] });

  const percent = useMemo(() => Math.round((step / STEPS.length) * 100), [step]);

  function updateSection(section, val) {
    setForm((f) => ({ ...f, [section]: val }));
  }

  // Called by Step 1 (Step1Gst) after POST /company/verify-gst succeeds.
  // Pushes the (already-minimal, non-sensitive) verified fields into
  // Company Information's section and Company Address's section so the
  // person doesn't have to retype what GST already confirmed.
  function handleGstVerified(data) {
    toast.success('GST verified — company details auto-filled below.');
    setForm((f) => ({
      ...f,
      company: {
        ...f.company,
        companyName: data.legalName || f.company.companyName,
        tradeName: data.tradeName || f.company.tradeName,
        businessType: mapGstConstitution(data.constitutionOfBusiness) || f.company.businessType,
      },
      address: {
        ...f.address,
        line1: data.principalAddress || f.address.line1,
        district: data.district || f.address.district,
        state: data.state || f.address.state,
        postalCode: data.pincode || f.address.postalCode,
        country: f.address.country || 'India',
      },
    }));

    setGstFilledFields({
      company: [
        data.legalName && 'companyName',
        data.tradeName && 'tradeName',
        mapGstConstitution(data.constitutionOfBusiness) && 'businessType',
      ].filter(Boolean),
      address: [
        data.principalAddress && 'line1',
        data.district && 'district',
        data.state && 'state',
        data.pincode && 'postalCode',
      ].filter(Boolean),
    });
  }

  // Only lock a field while GST verification is active for this session AND
  // GST actually returned a value for it — switching to "I don't have a GST
  // Number", or a field GST left blank, unlocks it.
  const gstLocked = form.gst.hasGst === 'yes' && form.gst.gstVerified;
  const lockedCompanyFields = gstLocked ? gstFilledFields.company : [];
  const lockedAddressFields = gstLocked ? gstFilledFields.address : [];

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
        // Backend still expects GST fields under `verification` — merge the
        // two sections back together here so /auth/register/company is untouched.
        verification: { ...form.gst, ...form.verification },
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
    <div className="min-h-screen bg-slate-50">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand text-white grid place-items-center"><Rocket size={16} /></div>
            <span className="text-sm font-bold text-brand-dark">Lead Automation</span>
          </div>
          <span className="text-xs text-slate-400">Already have an account? <a href="/login" className="text-brand font-medium">Sign in</a></span>
        </div>
        {/* mobile progress bar */}
        <div className="lg:hidden h-1 bg-slate-100">
          <div className="h-full bg-brand transition-all duration-500" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col lg:flex-row gap-6">
        <StepSidebar step={step} furthestStep={furthestStep} onJump={jumpTo} />

        <main className="flex-1 min-w-0">
          <div key={step} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 animate-[fadeIn_0.25s_ease]">
            {step === 1 && (
              <Step1Gst value={form.gst} errors={errors} onChange={(v) => updateSection('gst', v)}
                onVerified={handleGstVerified} />
            )}
            {step === 2 && <Step1AccountOwner value={form.owner} errors={errors} onChange={(v) => updateSection('owner', v)} />}
            {step === 3 && (
              <Step2CompanyInfo value={form.company} errors={errors} onChange={(v) => updateSection('company', v)}
                lockedFields={lockedCompanyFields} />
            )}
            {step === 4 && <Step3BusinessContact value={form.contact} errors={errors} onChange={(v) => updateSection('contact', v)} />}
            {step === 5 && (
              <Step4Address value={form.address} errors={errors} onChange={(v) => updateSection('address', v)}
                lockedFields={lockedAddressFields} />
            )}
            {step === 6 && (
              <Step5Verification value={form.verification} errors={errors} onChange={(v) => updateSection('verification', v)}
                ownerEmail={form.owner.workEmail} ownerMobile={form.owner.mobile} toast={toast} />
            )}
            {step === 7 && <Step6Subscription value={form.subscription} errors={errors} onChange={(v) => updateSection('subscription', v)} />}
            {step === 8 && <Step7Finish form={form} errors={errors} onChange={setForm} onEdit={jumpTo} />}

            <div className="flex items-center justify-between mt-7 pt-5 border-t border-slate-100">
              <button type="button" onClick={goBack} disabled={step === 1}
                className="flex items-center gap-1 text-sm font-medium text-slate-500 disabled:opacity-0 disabled:pointer-events-none">
                <ChevronLeft size={16} /> Previous
              </button>

              {step < STEPS.length ? (
                <button type="button" onClick={goNext}
                  className="flex items-center gap-1.5 bg-brand text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-brand-dark transition-colors">
                  Next <ChevronRight size={16} />
                </button>
              ) : (
                <button type="button" onClick={submit} disabled={submitting}
                  className="flex items-center gap-1.5 bg-brand text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-brand-dark transition-colors disabled:opacity-60">
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