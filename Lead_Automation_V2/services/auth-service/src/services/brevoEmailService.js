// services/auth-service/src/services/brevoEmailService.js
//
// Thin wrapper around Brevo's transactional email API
// (POST https://api.brevo.com/v3/smtp/email). Uses the platform's native
// fetch (Node 20, see Dockerfile) instead of the @getbrevo/brevo SDK, so no
// new dependency/package-lock churn is needed for one call site.
//
// Used by controllers/verificationController.js to deliver signup OTP
// codes. Errors are thrown, not swallowed — callers decide how to surface a
// failed send (see sendCode() in that file).

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';

function otpEmailHtml(code) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1e293b;">
    <h2 style="margin: 0 0 12px; color: #0f172a;">Verify your email</h2>
    <p style="margin: 0 0 20px; font-size: 14px; color: #475569;">
      Use the code below to verify your email address. It expires in 10 minutes.
    </p>
    <div style="background: #f1f5f9; border-radius: 8px; padding: 16px 24px; text-align: center; margin-bottom: 20px;">
      <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${code}</span>
    </div>
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
      If you didn't request this code, you can safely ignore this email.
    </p>
  </div>`.trim();
}

// Sends a 6-digit OTP code to `toEmail`. Throws on missing config or a
// non-2xx response from Brevo so the caller can decide how to respond.
async function sendOtpEmail(toEmail, code) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  const senderName = process.env.SENDER_NAME || 'Lead Automation';

  if (!apiKey || !senderEmail) {
    throw new Error('Email service is not configured (BREVO_API_KEY / SENDER_EMAIL missing)');
  }

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { name: senderName, email: senderEmail },
      to: [{ email: toEmail }],
      subject: 'Your verification code',
      htmlContent: otpEmailHtml(code),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo send failed (${res.status}): ${detail || 'no detail'}`);
  }

  return true;
}

module.exports = { sendOtpEmail };