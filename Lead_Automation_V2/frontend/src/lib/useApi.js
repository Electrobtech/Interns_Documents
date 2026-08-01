'use client';
import { useCallback } from 'react';
import { api, apiUpload } from './api';
import { getToken, logout } from './auth';

// Token-aware wrapper around `api()`. Components call `call(path, opts)` and never
// touch localStorage or pass the token by hand. A 401 / invalid token logs out.
//
// Checks e.status (attached by api()/apiUpload() in ./api.js) rather than
// pattern-matching e.message. The message-regex approach used to miss cases
// like shared/src/auth.js's "Token missing tenant context" (word order
// doesn't match "missing token"), which meant a stale pre-multi-tenant JWT
// (one issued before organizationId was added to the token payload) would
// 401 on every call, forever, with no auto-logout to clear it.
export function useApi() {
  const call = useCallback(async (path, opts = {}) => {
    try {
      return await api(path, { ...opts, token: getToken() });
    } catch (e) {
      const isAuthError =
        e.status === 401 ||
        /invalid token|missing token|token missing|unauthorized/i.test(e.message || '');
      if (isAuthError) {
        logout();
      }
      throw e;
    }
  }, []);

  // Same contract as `call`, for multipart/form-data bodies (file uploads).
  // apiUpload sets no Content-Type so the browser can add the multipart
  // boundary itself.
  const upload = useCallback(async (path, formData) => {
    try {
      return await apiUpload(path, formData, { token: getToken() });
    } catch (e) {
      const isAuthError =
        e.status === 401 ||
        /invalid token|missing token|token missing|unauthorized/i.test(e.message || '');
      if (isAuthError) {
        logout();
      }
      throw e;
    }
  }, []);

  return { call, upload };
}