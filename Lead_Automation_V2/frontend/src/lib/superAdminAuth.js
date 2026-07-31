// Separate token store from src/lib/auth.js. A platform-admin JWT has a
// different payload shape (adminId + isSuperAdmin, no organizationId —
// see shared/src/superAdmin.js) and must never be sent to a tenant-scoped
// endpoint (or vice versa), so it gets its own localStorage key and its
// own logout redirect target rather than sharing 'token' / '/login'.
const KEY = 'super_admin_token';

export function getSuperAdminToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(KEY);
}

export function setSuperAdminToken(token) {
  if (typeof window !== 'undefined') localStorage.setItem(KEY, token);
}

export function clearSuperAdminToken() {
  if (typeof window !== 'undefined') localStorage.removeItem(KEY);
}

export function superAdminLogout() {
  clearSuperAdminToken();
  if (typeof window !== 'undefined') window.location.href = '/super-admin/login';
}
