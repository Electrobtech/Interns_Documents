'use client';
import { useCallback } from 'react';
import { api } from './api';
import { getToken, logout } from './auth';

// Token-aware wrapper around `api()`. Components call `call(path, opts)` and never
// touch localStorage or pass the token by hand. A 401 / invalid token logs out.
export function useApi() {
  const call = useCallback(async (path, opts = {}) => {
    try {
      return await api(path, { ...opts, token: getToken() });
    } catch (e) {
      if (/invalid token|missing token|unauthorized|401/i.test(e.message || '')) {
        logout();
      }
      throw e;
    }
  }, []);
  return { call };
}
