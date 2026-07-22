// services/auth-service/src/services/gstService.js
//
// Server-side GST (GSTIN) verification. This is the ONLY place in the
// codebase that talks to RapidAPI — the frontend calls our own
// POST /company/verify-gst (gstController.js), which calls verifyGst()
// below. The RapidAPI key lives only in process.env (.env), is never
// logged, and is never sent to the browser.
//
// Response-shape note: RapidAPI "GST verification" listings differ, but
// most proxy the public GSTN taxpayer-search response, whose fields are
// lgnm (legal name), tradeNam (trade name), ctb (constitution of business),
// rgdt (registration date), sts (status), and pradr.addr (principal
// address: bno/bnm/st/loc/dst/stcd/pncd). normalizeGstResponse() reads that
// shape first and falls back to a few common alternate field names, so
// pointing this at a different provider usually only means adjusting that
// one function.

const { pool } = require('@lead/shared');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
const RAPIDAPI_HOST = process.env.RAPIDAPI_GST_HOST;
const RAPIDAPI_URL = process.env.RAPIDAPI_GST_URL;

const REQUEST_TIMEOUT_MS = 8000;
const CACHE_TTL_DAYS = Number(process.env.GST_CACHE_TTL_DAYS || 30);

function isConfigured() {
  return Boolean(RAPIDAPI_KEY && RAPIDAPI_HOST && RAPIDAPI_URL);
}

// ---------------------------------------------------------------------
// Cache — avoids re-billing/re-calling RapidAPI for a GSTIN we've already
// verified recently. Stores only the minimal fields we return to the
// frontend (never the raw provider payload).
// ---------------------------------------------------------------------
async function getCached(gstNumber) {
  const { rows } = await pool.query(
    `SELECT * FROM gst_verifications
      WHERE gst_number = $1 AND verified_at > now() - interval '${CACHE_TTL_DAYS} days'`,
    [gstNumber]
  );
  return rows[0] || null;
}

async function saveCache(gstNumber, n) {
  await pool.query(
    `INSERT INTO gst_verifications (
       gst_number, verification_status, company_name, trade_name,
       business_type, registration_date, address, district, state, pincode, verified_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
     ON CONFLICT (gst_number) DO UPDATE SET
       verification_status = EXCLUDED.verification_status,
       company_name        = EXCLUDED.company_name,
       trade_name          = EXCLUDED.trade_name,
       business_type       = EXCLUDED.business_type,
       registration_date   = EXCLUDED.registration_date,
       address              = EXCLUDED.address,
       district             = EXCLUDED.district,
       state                = EXCLUDED.state,
       pincode              = EXCLUDED.pincode,
       verified_at          = now()`,
    [
      gstNumber, n.status, n.legalName, n.tradeName, n.constitutionOfBusiness,
      n.registrationDate, n.principalAddress, n.district, n.state, n.pincode,
    ]
  );
}

function cacheRowToResponse(row) {
  return {
    legalName: row.company_name,
    tradeName: row.trade_name,
    gstNumber: row.gst_number,
    constitutionOfBusiness: row.business_type,
    registrationDate: row.registration_date,
    status: row.verification_status,
    principalAddress: row.address,
    district: row.district,
    state: row.state,
    pincode: row.pincode,
    cached: true,
  };
}

// ---------------------------------------------------------------------
// Normalization — maps the provider's raw JSON to exactly the fields the
// frontend is allowed to see (see spec: "return only required fields").
// ---------------------------------------------------------------------
function normalizeGstResponse(raw, gstNumber) {
  // GST Insights API (gst-insights-api.p.rapidapi.com) actual shape,
  // confirmed from a live response:
  //   { success: true, data: [ { legalName, gstNumber, registrationDate,
  //     constitutionOfBusiness, cancelledDate, natureOfBusinessActivity,
  //     principalAddress: { address: { buildingName, street, location, ... } },
  //     ... } ] }
  // Two things standard GSTN-shaped providers don't have: `data` is an
  // ARRAY (take the first element), and it uses verbose field names
  // instead of the lgnm/ctb/rgdt short codes. Kept the short-code fallbacks
  // below too, so this still works if you ever swap providers.
  let d = raw?.data ?? raw?.result ?? raw?.taxpayerInfo ?? raw?.gstDetails
    ?? raw?.gstinDetails ?? raw?.details ?? raw?.response ?? raw ?? {};
  if (Array.isArray(d)) d = d[0] || {};

  const addr = d.pradr?.addr || d.principalAddress?.address || d.principalAddress
    || d.address || {};

  const legalName = d.lgnm || d.legalName || d.legal_name || null;
  const tradeName = d.tradeNam || d.tradeName || d.trade_name || null;
  const constitutionOfBusiness = d.ctb || d.constitutionOfBusiness || d.businessType || null;
  const registrationDate = d.rgdt || d.registrationDate || d.registration_date || null;
  // This provider has no explicit status field in what we've seen so far —
  // derive Active/Cancelled from cancelledDate until we confirm otherwise.
  const status = d.sts || d.status || d.gstinStatus
    || (d.cancelledDate !== undefined ? (d.cancelledDate ? 'Cancelled' : 'Active') : null);

  const addressLine = typeof addr === 'string'
    ? addr
    : [addr.bno, addr.bnm, addr.buildingName, addr.st, addr.street, addr.loc, addr.location]
        .filter(Boolean).join(', ') || null;
  const district = (typeof addr === 'object' && (addr.dst || addr.district)) || d.district || null;
  const state = (typeof addr === 'object' && (addr.stcd || addr.state)) || d.state || null;
  const pincode = (typeof addr === 'object' && (addr.pncd || addr.pincode || addr.pinCode || addr.postalCode))
    || d.pincode || null;

  if (!legalName && !status) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[gst.verify] 200 OK but no recognizable fields — raw shape was:',
        JSON.stringify(raw).slice(0, 2000));
    }
    const err = new Error('GST verification returned no usable data');
    err.code = 'GST_INVALID_RESPONSE';
    throw err;
  }

  return {
    legalName, tradeName, gstNumber,
    constitutionOfBusiness, registrationDate, status,
    principalAddress: addressLine, district, state, pincode,
  };
}

// ---------------------------------------------------------------------
// Building the outgoing request.
//
// THE BUG: this used to always send `POST` with a JSON body, no matter
// which RapidAPI listing you subscribed to. Most "GST Verification /
// GST Insights" APIs on RapidAPI are actually `GET` endpoints that take
// the GSTIN either as a query param (`?gstin=...`) or as a path segment
// (`.../gstin/{gstin}`) — RapidAPI's gateway returns a plain HTTP 404 for
// a request made with the wrong method/shape, and that 404 was exactly
// what got mapped to "GST number not found. Please double-check and try
// again." So *every* GSTIN looked "not found", valid or not, because the
// request never actually reached the verification logic on the
// provider's side — it 404'd at the routing layer before it got there.
//
// Fix: make method + param style configurable via env, default to GET
// (the more common shape), and support a `{gstin}` placeholder in
// RAPIDAPI_GST_URL for path-param-style APIs. Check your specific
// RapidAPI listing's "Code Snippets" tab to confirm which shape it wants,
// then set RAPIDAPI_GST_METHOD / RAPIDAPI_GST_URL to match.
// ---------------------------------------------------------------------
function buildRequest(gstNumber) {
  const method = (process.env.RAPIDAPI_GST_METHOD || 'GET').toUpperCase();
  const headers = {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };

  let url = RAPIDAPI_URL;
  if (url.includes('{gstin}')) {
    // Path-param style, e.g. https://host/v1/gstin/{gstin}
    url = url.replace('{gstin}', encodeURIComponent(gstNumber));
  } else if (method === 'GET') {
    // Query-param style, e.g. https://host/v1/verify?gstin=...
    const u = new URL(url);
    u.searchParams.set('gstin', gstNumber);
    u.searchParams.set('GSTIN', gstNumber);
    url = u.toString();
  }

  const init = { method, headers };
  if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    init.body = JSON.stringify({ gstin: gstNumber, GSTIN: gstNumber });
  }
  return { url, init };
}

// ---------------------------------------------------------------------
// RapidAPI call — timeout via AbortController, one retry on timeout/5xx/429.
// ---------------------------------------------------------------------
async function callRapidApi(gstNumber, attempt = 1) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const { url, init } = buildRequest(gstNumber);
    const res = await fetch(url, { ...init, signal: controller.signal });

    if (!res.ok) {
      if ((res.status >= 500 || res.status === 429) && attempt < 2) {
        clearTimeout(timer);
        return callRapidApi(gstNumber, attempt + 1);
      }
      // Debug aid (never logs the API key): shows the real provider
      // status/body so a 404 caused by a routing/shape mismatch is
      // immediately distinguishable from a genuine "GSTIN not found".
      // Truncated to avoid flooding logs; safe to leave on in dev.
      if (process.env.NODE_ENV !== 'production') {
        const rawBody = await res.text().catch(() => '');
        console.warn('[gst.verify] provider responded non-OK', {
          method: init.method, status: res.status,
          body: rawBody.slice(0, 300),
        });
      }
      const err = new Error(res.status === 404 ? 'GSTIN not found' : 'GST verification provider error');
      err.code = res.status === 404 ? 'GST_NOT_FOUND' : 'GST_PROVIDER_ERROR';
      throw err;
    }

    const json = await res.json();
    return normalizeGstResponse(json, gstNumber);
  } catch (e) {
    if (e.name === 'AbortError') {
      if (attempt < 2) return callRapidApi(gstNumber, attempt + 1);
      const err = new Error('GST verification timed out');
      err.code = 'GST_TIMEOUT';
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------
// Public entry point used by gstController.js.
// gstNumber must already be format-validated (isGst) by the caller.
// ---------------------------------------------------------------------
async function verifyGst(gstNumber) {
  const cached = await getCached(gstNumber);
  if (cached) return cacheRowToResponse(cached);

  if (!isConfigured()) {
    const err = new Error('GST verification is not configured on the server');
    err.code = 'GST_NOT_CONFIGURED';
    throw err;
  }

  const normalized = await callRapidApi(gstNumber);
  await saveCache(gstNumber, normalized);
  return { ...normalized, cached: false };
}

module.exports = { verifyGst };
