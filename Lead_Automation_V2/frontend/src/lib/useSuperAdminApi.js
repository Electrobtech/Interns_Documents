'use client';
import { useCallback } from 'react';
import { api } from './api';
import { getSuperAdminToken, superAdminLogout } from './superAdminAuth';

// Platform-admin equivalent of useApi() (see useApi.js) — same
// api()-wrapping shape, but reads the separate super-admin token and
// bounces to /super-admin/login on auth failure instead of /login.
export function useSuperAdminApi() {
  const call = useCallback(async (path, opts = {}) => {
    try {
      return await api(path, { ...opts, token: getSuperAdminToken() });
    } catch (e) {
      const isAuthError =
        e.status === 401 ||
        e.status === 403 ||
        /invalid token|missing token|token missing|unauthorized|super admin access required/i.test(e.message || '');
      if (isAuthError) {
        superAdminLogout();
      }
      throw e;
    }
  }, []);
  return { call };
}
