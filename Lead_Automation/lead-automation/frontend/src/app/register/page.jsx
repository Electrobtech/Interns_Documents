import RegistrationWizard from '@/components/registration/RegistrationWizard';

export const metadata = {
  title: 'Register Your Company — Lead Automation',
  description: 'Create your company workspace on Lead Automation.',
};

// Public route (outside the `(app)` authenticated layout group, same as
// /login) — this is how a brand-new tenant signs up.
export default function RegisterPage() {
  return <RegistrationWizard />;
}
