'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, CheckCircle2 } from 'lucide-react';
import CompanyForm, { EMPTY_COMPANY_FORM, validateCompanyForm } from '@/components/registration/CompanyForm';
import { registerCompany } from '@/lib/companyStore';

// Lightweight company registration (feature-request section 2). This is
// intentionally separate from the full GST-verification wizard at
// /register (components/registration/RegistrationWizard.jsx), which
// creates a real tenant + login via POST /auth/register/company — this
// page just adds a record to the same shared companyStore the Super
// Admin Companies table reads from, for quickly registering a company
// without the full onboarding flow. New registrations always land as
// `status: 'pending'` and are visible in /super-admin/companies (and its
// Audit Log) immediately, including after a refresh.
export default function CompanyRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(null);

  function submit(e) {
    e.preventDefault();
    const validationErrors = validateCompanyForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSubmitting(true);
    try {
      // Status always starts at 'pending' here regardless of anything a
      // caller might try to set — a self-service registration shouldn't
      // be able to grant itself Active/Suspended.
      const company = registerCompany({ ...form, status: 'pending' });
      setRegistered(company);
    } finally {
      setSubmitting(false);
    }
  }

  if (registered) {
    return (
      <div className="min-h-screen bg-slate-50 grid place-items-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
          <CheckCircle2 className="size-10 text-emerald-500 mx-auto" />
          <h1 className="text-xl font-semibold text-slate-900">Registration submitted</h1>
          <p className="text-sm text-slate-500">
            {registered.name} has been registered with status <span className="font-medium text-amber-600">Pending</span>.
            A super admin will review and activate the account.
          </p>
          <button
            type="button"
            onClick={() => router.push('/login')}
            className="mt-2 inline-flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Continue to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white grid place-items-center"><Rocket size={16} /></div>
            <span className="text-sm font-bold text-slate-900">Lead Automation</span>
          </div>
          <span className="text-xs text-slate-400">
            Already have an account? <a href="/login" className="text-blue-600 font-medium">Sign in</a>
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">Register your company</h1>
          <p className="text-sm text-slate-500 mt-1 mb-6">
            Tell us about your business. Your account will start in Pending status until a super admin reviews it.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <CompanyForm value={form} onChange={setForm} errors={errors} idPrefix="register" />

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-1.5 bg-blue-600 text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60"
            >
              {submitting ? 'Registering…' : 'Register company'}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}