const { authenticate, requireRole } = require('@lead/shared');
const { withTenantScope, withSystemAccess } = require('@lead/shared');

module.exports = { authenticate, requireRole, withTenantScope, withSystemAccess };