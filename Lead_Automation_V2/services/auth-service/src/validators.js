// services/auth-service/src/validators.js
//
// Server-side validation for the Company Registration wizard
// (POST /auth/register/company). Mirrors the client-side checks in
// frontend/src/lib/companyValidation.js — the client copy exists purely for
// instant UX feedback; this file is the source of truth and is what
// actually gates what gets written to the database.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accepts optional leading + and 7-15 digits (E.164-ish), which covers
// Indian mobile numbers (+91XXXXXXXXXX) as well as most international ones.
const PHONE_RE = /^\+?[0-9]{7,15}$/;
// Indian GSTIN format: 2 digit state code + 10 char PAN + 1 entity code +
// 1 'Z' + 1 checksum char.
const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const BUSINESS_TYPES = [
  'proprietorship', 'partnership', 'llp', 'private_limited',
  'public_limited', 'startup', 'ngo', 'other',
];

const PLANS = ['starter', 'professional', 'enterprise'];

function isEmail(v) { return typeof v === 'string' && EMAIL_RE.test(v.trim()); }
function isPhone(v) { return typeof v === 'string' && PHONE_RE.test(v.trim()); }
function isGst(v) { return typeof v === 'string' && GST_RE.test(v.trim().toUpperCase()); }
function isPan(v) { return typeof v === 'string' && PAN_RE.test(v.trim().toUpperCase()); }

// Mirrors the strength meter shown in Step 1: at least 8 chars, one
// uppercase, one lowercase, one digit, one symbol.
function passwordStrength(pw) {
  if (typeof pw !== 'string') return { score: 0, ok: false };
  const checks = [
    pw.length >= 8,
    /[a-z]/.test(pw),
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ];
  const score = checks.filter(Boolean).length;
  return { score, ok: score >= 4 }; // require 4 of 5 checks
}

// Validates the full multi-step payload in one pass and returns a list of
// { field, message } errors (empty array = valid). Kept as one function
// (rather than per-step) since the register endpoint receives the whole
// wizard payload in a single request.
function validateCompanyRegistration(body) {
  const errors = [];
  const add = (field, message) => errors.push({ field, message });

  const owner = body.owner || {};
  const company = body.company || {};
  const contact = body.contact || {};
  const address = body.address || {};
  const verification = body.verification || {};
  const subscription = body.subscription || {};

  // ---- Step 1: Account Owner ----
  if (!owner.fullName || !owner.fullName.trim()) add('owner.fullName', 'Full name is required');
  if (!isEmail(owner.workEmail)) add('owner.workEmail', 'A valid work email is required');
  if (!isPhone(owner.mobile)) add('owner.mobile', 'A valid mobile number is required');
  const strength = passwordStrength(owner.password);
  if (!strength.ok) add('owner.password', 'Password is too weak (min 8 chars, upper/lower/number/symbol)');
  if (owner.password !== owner.confirmPassword) add('owner.confirmPassword', 'Passwords do not match');
  if (owner.twoFactorEnabled && !['authenticator', 'sms'].includes(owner.twoFactorMethod)) {
    add('owner.twoFactorMethod', 'Choose Authenticator App or SMS Authentication');
  }

  // ---- Step 2: Company Information ----
  if (!company.companyName || !company.companyName.trim()) add('company.companyName', 'Company name is required');
  if (!BUSINESS_TYPES.includes(company.businessType)) add('company.businessType', 'Select a valid business type');
  if (!company.industry || !company.industry.trim()) add('company.industry', 'Industry is required');
  if (company.website && !/^https?:\/\/.+/i.test(company.website)) {
    add('company.website', 'Website must start with http:// or https://');
  }

  // ---- Step 3: Business Contact ----
  if (!isEmail(contact.companyEmail)) add('contact.companyEmail', 'A valid company email is required');
  if (!isPhone(contact.companyPhone)) add('contact.companyPhone', 'A valid company phone is required');
  if (contact.supportEmail && !isEmail(contact.supportEmail)) add('contact.supportEmail', 'Support email looks invalid');
  if (contact.alternatePhone && !isPhone(contact.alternatePhone)) add('contact.alternatePhone', 'Alternate phone looks invalid');

  // ---- Step 4: Company Address ----
  if (!address.line1 || !address.line1.trim()) add('address.line1', 'Address line 1 is required');
  if (!address.city || !address.city.trim()) add('address.city', 'City is required');
  if (!address.state || !address.state.trim()) add('address.state', 'State is required');
  if (!address.country || !address.country.trim()) add('address.country', 'Country is required');
  if (!address.postalCode || !address.postalCode.trim()) add('address.postalCode', 'Postal code is required');

  // ---- Step 5: Verification (all optional, but format-checked if present) ----
  if (verification.gstNumber && !isGst(verification.gstNumber)) add('verification.gstNumber', 'GST number format is invalid');
  if (verification.panNumber && !isPan(verification.panNumber)) add('verification.panNumber', 'PAN number format is invalid');

  // ---- Step 6: Subscription ----
  if (!PLANS.includes(subscription.plan)) add('subscription.plan', 'Select a subscription plan');

  // ---- Step 7: Terms ----
  if (!body.acceptTerms) add('acceptTerms', 'You must accept the Terms of Service');

  return errors;
}

const ALLOWED_UPLOAD_MIME = new Set(['image/png', 'image/jpeg', 'application/pdf']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB, per spec

// ---------------------------------------------------------------------------
// PIN login (services/auth-service/src/controllers/pinController.js)
// ---------------------------------------------------------------------------

const PIN_LENGTHS = [4, 6];

// Blocks the handful of PINs that are trivially guessable: every digit the
// same (1111, 000000), strictly ascending/descending runs (1234, 654321,
// including the wrap-around 0123), and a short list of PINs that show up
// disproportionately often in real breach datasets (birthdays/years like
// 1990, repeated pairs like 1212).
const COMMON_PINS = new Set([
  '1234', '4321', '0000', '1111', '2222', '3333', '4444', '5555',
  '6666', '7777', '8888', '9999', '1212', '1122', '0852', '0987',
  '123456', '654321', '000000', '111111', '112233', '121212',
]);

function isSequential(digits) {
  let ascending = true;
  let descending = true;
  for (let i = 1; i < digits.length; i++) {
    const prev = Number(digits[i - 1]);
    const curr = Number(digits[i]);
    if ((curr - prev + 10) % 10 !== 1) ascending = false;
    if ((prev - curr + 10) % 10 !== 1) descending = false;
  }
  return ascending || descending;
}

function isRepetitive(digits) {
  return new Set(digits.split('')).size === 1;
}

// Returns { ok, error } instead of throwing so callers can turn it directly
// into a 400 response with a field-specific message.
function validatePin(pin) {
  if (typeof pin !== 'string' || !/^\d+$/.test(pin)) {
    return { ok: false, error: 'PIN must contain only digits' };
  }
  if (!PIN_LENGTHS.includes(pin.length)) {
    return { ok: false, error: 'PIN must be 4 or 6 digits' };
  }
  if (isRepetitive(pin)) {
    return { ok: false, error: 'PIN cannot be the same digit repeated' };
  }
  if (isSequential(pin)) {
    return { ok: false, error: 'PIN cannot be a sequential run of digits' };
  }
  if (COMMON_PINS.has(pin)) {
    return { ok: false, error: 'This PIN is too common, please choose another' };
  }
  return { ok: true };
}

module.exports = {
  isEmail, isPhone, isGst, isPan, passwordStrength,
  validateCompanyRegistration,
  BUSINESS_TYPES, PLANS,
  ALLOWED_UPLOAD_MIME, MAX_UPLOAD_BYTES,
  validatePin,
};
