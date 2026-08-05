// shared/src/validation.js
//
// Postgres throws a hard error (22P02 invalid_text_representation) the
// moment a non-UUID string is bound to a `uuid`-typed column — e.g.
// `WHERE id = $1` in companyModel.findById(). Every Super Admin route
// takes a tenant/company/payment/invoice id straight from req.params
// and passes it into a query like that, so any caller (or typo, or bot
// probing routes) can trigger it just by hitting
// GET /super-admin/companies/org_electrobtech.
//
// That error alone wouldn't be fatal — pg rejects the query promise,
// Express would normally turn a thrown/rejected error into a 500 — but
// none of these route handlers are wrapped in try/catch (see
// asyncHandler.js for why that matters), so the rejection had nowhere
// to go and Node killed the process on the unhandled rejection.
//
// This is the first line of defense: reject obviously-malformed ids
// with a clean 400 before they ever reach the database.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

// Express middleware factory. Validates one or more route params are
// well-formed UUIDs; responds 400 (not 404 — the id is malformed, not
// merely "not found") and never calls the handler if any fail.
//
//   router.get('/super-admin/companies/:id', validateUuidParams('id'), handler)
//   router.post('/super-admin/payments/:paymentId/refund', validateUuidParams('paymentId'), handler)
function validateUuidParams(...paramNames) {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value !== undefined && !isValidUuid(value)) {
        return res.status(400).json({ error: `Invalid ${name}: must be a UUID` });
      }
    }
    next();
  };
}

module.exports = { isValidUuid, validateUuidParams };