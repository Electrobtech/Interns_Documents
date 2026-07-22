// services/auth-service/src/controllers/gstController.js
//
// POST /company/verify-gst — Step 1 "Verify GST" button of the registration
// wizard. The frontend NEVER calls RapidAPI directly; this is the only
// server route that does, via services/gstService.js. Public (no
// `authenticate`) for the same reason as /company/upload: it's used
// mid-wizard, before the tenant/owner account exists and a JWT can be
// issued.

const express = require('express');
const rateLimit = require('express-rate-limit');
const { isGst } = require('../validators');
const { verifyGst } = require('../services/gstService');

const router = express.Router();

// Generous enough for a real person retrying a mistyped GSTIN a few times,
// tight enough to blunt scraping/abuse of the metered RapidAPI credits.
const gstRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many GST verification attempts. Please try again in a few minutes.' },
});

router.post('/company/verify-gst', gstRateLimiter, async (req, res) => {
  const gstNumber = String(req.body?.gstNumber || '').trim().toUpperCase();

  // Format-check before ever touching the external API.
  if (!isGst(gstNumber)) {
    return res.status(400).json({ error: 'Enter a valid 15-character GST number (e.g. 22AAAAA0000A1Z5).' });
  }

  try {
    const result = await verifyGst(gstNumber);
    // Minimal response only — see spec. `cached` is informational and safe
    // to expose; nothing from the raw provider payload leaks past this point.
    res.json(result);
  } catch (e) {
    // Never log the API key or the raw provider response — only a short,
    // stable error code for debugging.
    console.error('[gst.verify] failed', { code: e.code || 'UNKNOWN' });

    if (e.code === 'GST_NOT_FOUND') {
      return res.status(404).json({ error: 'GST number not found. Please double-check and try again.' });
    }
    if (e.code === 'GST_TIMEOUT') {
      return res.status(504).json({ error: 'GST verification timed out. Please try again.' });
    }
    if (e.code === 'GST_NOT_CONFIGURED') {
      return res.status(503).json({ error: 'GST verification is temporarily unavailable. You can continue by entering your company details manually.' });
    }
    return res.status(502).json({ error: 'Could not verify this GST number right now. Please try again shortly.' });
  }
});

module.exports = router;
