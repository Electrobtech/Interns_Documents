// services/auth-service/src/services/twoFactorSmsService.js
//
// Thin wrapper around 2Factor.in's "Send OTP (custom code)" API:
//   GET https://2factor.in/API/V1/{api_key}/SMS/{phone}/{otp}/{template}
// This variant sends an OTP *we* generate (matches the code already hashed
// into verification_codes by controllers/verificationController.js), as
// opposed to 2Factor's AUTOGEN endpoints which generate + track the code
// on their side. We keep our own generate/hash/verify flow — 2Factor is
// only used as the delivery channel — so no session_id bookkeeping or a
// separate VERIFY3 call is needed; confirmCode() in verificationController.js
// already validates against our own stored hash.
//
// `template` must be a DLT-registered template name in your 2Factor.in
// account (TRAI requirement for sending OTP SMS to Indian numbers) whose
// approved text contains a single numeric variable, e.g.
// "Your OTP is {#var#}. Valid for 10 minutes. - Electrobtech".

const TWOFACTOR_BASE = 'https://2factor.in/API/V1';

// Normalizes to the 10-digit local number 2Factor.in expects — strips a
// leading "+91" or "91" country-code prefix if present, since validators.js
// accepts both forms (E.164-ish, 7-15 digits).
function toLocalIndianNumber(mobile) {
  const digits = String(mobile).replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

// Sends a 6-digit OTP code to `mobile` via 2Factor.in SMS. Throws on
// missing config or a non-success response so the caller can decide how to
// respond (same pattern as brevoEmailService.sendOtpEmail).
async function sendOtpSms(mobile, code) {
  const apiKey = process.env.TWOFACTOR_API_KEY;
  const template = process.env.TWOFACTOR_TEMPLATE;

  if (!apiKey || !template) {
    throw new Error('SMS service is not configured (TWOFACTOR_API_KEY / TWOFACTOR_TEMPLATE missing)');
  }

  const phone = toLocalIndianNumber(mobile);
  const url = `${TWOFACTOR_BASE}/${apiKey}/SMS/${phone}/${code}/${encodeURIComponent(template)}`;

  const res = await fetch(url, { method: 'GET' });
  const body = await res.json().catch(() => null);

  // 2Factor returns HTTP 200 with Status: "Error" in the body for most
  // failure cases (bad template, insufficient balance, invalid number),
  // so the JSON Status field has to be checked, not just res.ok.
  if (!res.ok || !body || body.Status !== 'Success') {
    const detail = body?.Details || `HTTP ${res.status}`;
    throw new Error(`2Factor.in send failed: ${detail}`);
  }

  return true;
}

// Whether SMS-based OTP delivery should run at all. False means
// /auth/verify/mobile keeps its old dev-only behavior (see
// verificationController.js) rather than attempting a send.
function isSmsOtpEnabled() {
  return process.env.OTP_ENABLED === 'true' && process.env.SMS_PROVIDER === '2factor';
}

module.exports = { sendOtpSms, isSmsOtpEnabled };