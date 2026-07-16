// Client-side mirror of services/auth-service/src/validators.js — used for
// instant per-step feedback in the registration wizard. The server
// re-validates everything on submit, so this file only needs to be "close
// enough" for good UX, not the source of truth.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^\+?[0-9]{7,15}$/;
export const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export const isEmail = (v) => EMAIL_RE.test((v || '').trim());
export const isPhone = (v) => PHONE_RE.test((v || '').trim());
export const isGst = (v) => GST_RE.test((v || '').trim().toUpperCase());
export const isPan = (v) => PAN_RE.test((v || '').trim().toUpperCase());

export function passwordStrength(pw = '') {
  const checks = [
    pw.length >= 8,
    /[a-z]/.test(pw),
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const score = checks.filter(Boolean).length;
  return {
    score,                       // 0-5
    ok: score >= 4,
    label: ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][score],
  };
}

export const BUSINESS_TYPES = [
  { value: 'proprietorship', label: 'Proprietorship' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llp', label: 'LLP' },
  { value: 'private_limited', label: 'Private Limited' },
  { value: 'public_limited', label: 'Public Limited' },
  { value: 'startup', label: 'Startup' },
  { value: 'ngo', label: 'NGO' },
  { value: 'other', label: 'Other' },
];

export const INDUSTRIES = [
  'Retail & E-commerce', 'Healthcare', 'Education', 'Real Estate',
  'Finance & Banking', 'Travel & Hospitality', 'Manufacturing',
  'Technology / SaaS', 'Food & Beverage', 'Media & Entertainment',
  'Automotive', 'Other',
];

// Per-step validators. Each returns { fieldName: 'error message' }.
export function validateStep1(owner) {
  const e = {};
  if (!owner.fullName?.trim()) e.fullName = 'Full name is required';
  if (!isEmail(owner.workEmail)) e.workEmail = 'Enter a valid work email';
  if (!isPhone(owner.mobile)) e.mobile = 'Enter a valid mobile number';
  if (!passwordStrength(owner.password).ok) e.password = 'Password is too weak';
  if (owner.password !== owner.confirmPassword) e.confirmPassword = 'Passwords do not match';
  if (owner.twoFactorEnabled && !owner.twoFactorMethod) e.twoFactorMethod = 'Choose a 2FA method';
  return e;
}

export function validateStep2(company) {
  const e = {};
  if (!company.companyName?.trim()) e.companyName = 'Company name is required';
  if (!company.businessType) e.businessType = 'Select a business type';
  if (!company.industry) e.industry = 'Select an industry';
  if (company.website && !/^https?:\/\/.+/i.test(company.website)) e.website = 'Must start with http:// or https://';
  return e;
}

export function validateStep3(contact) {
  const e = {};
  if (!isEmail(contact.companyEmail)) e.companyEmail = 'Enter a valid company email';
  if (!isPhone(contact.companyPhone)) e.companyPhone = 'Enter a valid company phone';
  if (contact.supportEmail && !isEmail(contact.supportEmail)) e.supportEmail = 'Support email looks invalid';
  if (contact.alternatePhone && !isPhone(contact.alternatePhone)) e.alternatePhone = 'Alternate phone looks invalid';
  return e;
}

export function validateStep4(address) {
  const e = {};
  if (!address.line1?.trim()) e.line1 = 'Address line 1 is required';
  if (!address.city?.trim()) e.city = 'City is required';
  if (!address.state?.trim()) e.state = 'State is required';
  if (!address.country?.trim()) e.country = 'Country is required';
  if (!address.postalCode?.trim()) e.postalCode = 'Postal code is required';
  return e;
}

export function validateStep5(verification) {
  const e = {};
  if (verification.gstNumber && !isGst(verification.gstNumber)) e.gstNumber = 'Invalid GST format';
  if (verification.panNumber && !isPan(verification.panNumber)) e.panNumber = 'Invalid PAN format';
  return e;
}

export function validateStep6(subscription) {
  const e = {};
  if (!subscription.plan) e.plan = 'Select a plan to continue';
  return e;
}

export function validateStep7({ acceptTerms }) {
  const e = {};
  if (!acceptTerms) e.acceptTerms = 'You must accept the Terms of Service';
  return e;
}
