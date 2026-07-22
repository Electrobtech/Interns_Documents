'use client';
import { useCallback, useEffect, useState } from 'react';
import { useApi } from '@/lib/useApi';

const qs = (params = {}) => {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') usp.set(k, v); });
  const s = usp.toString();
  return s ? `?${s}` : '';
};

export function useGoogleReviews() {
  const { call } = useApi();

  const [status, setStatus] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [config, setConfig] = useState(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState({ rows: [], total: 0, page: 1, limit: 10 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const s = await call('/google/status');
      setStatus(s);
      return s;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setStatusLoading(false);
    }
  }, [call]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const c = await call('/google/config');
      setConfig(c);
      return c;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setConfigLoading(false);
    }
  }, [call]);

  const saveConfig = useCallback(async (clientId, clientSecret) => {
    setSavingConfig(true);
    setError('');
    try {
      const c = await call('/google/config', { method: 'POST', body: { clientId, clientSecret } });
      setConfig(c);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setSavingConfig(false);
    }
  }, [call]);

  const loadLocations = useCallback(async (accountId) => {
    try {
      const rows = await call(`/google/locations${qs({ accountId })}`);
      setLocations(rows);
      return rows;
    } catch (e) { setError(e.message); return []; }
  }, [call]);

  const loadAccounts = useCallback(async () => {
    try {
      const rows = await call('/google/accounts');
      setAccounts(rows);
      if (rows[0]) await loadLocations(rows[0].accountId);
      return rows;
    } catch (e) { setError(e.message); return []; }
  }, [call, loadLocations]);

  const loadStats = useCallback(async (locationId) => {
    try {
      setStats(await call(`/google/statistics${qs({ locationId })}`));
    } catch (e) { setError(e.message); }
  }, [call]);

  const loadReviews = useCallback(async (filters = {}) => {
    setReviewsLoading(true);
    try {
      const result = await call(`/google/reviews${qs(filters)}`);
      setReviews(result);
    } catch (e) { setError(e.message); }
    finally { setReviewsLoading(false); }
  }, [call]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const { url } = await call('/google/login');
      window.location.href = url;
      return true;
    } catch (e) {
      setError(e.message);
      setBusy(false);
      return false;
    }
  }, [call]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await call('/google/disconnect', { method: 'POST' });
      setStatus(null);
      setAccounts([]);
      setLocations([]);
      setStats(null);
      setReviews({ rows: [], total: 0, page: 1, limit: 10 });
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [call]);

  const selectLocation = useCallback(async (locationId) => {
    setBusy(true);
    try {
      await call(`/google/locations/${encodeURIComponent(locationId)}/select`, { method: 'PUT' });
      await loadStatus();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }, [call, loadStatus]);

  const sync = useCallback(async (locationId) => {
    setBusy(true);
    setError('');
    try {
      const summary = await call('/google/sync', { method: 'POST', body: locationId ? { locationId } : {} });
      await loadStatus();
      return summary;
    } catch (e) { setError(e.message); return null; }
    finally { setBusy(false); }
  }, [call, loadStatus]);

  const reply = useCallback(async (reviewId, comment) => {
    setBusy(true);
    try {
      return await call('/google/reply', { method: 'POST', body: { reviewId, comment } });
    } catch (e) { setError(e.message); throw e; }
    finally { setBusy(false); }
  }, [call]);

  const deleteReply = useCallback(async (reviewId) => {
    setBusy(true);
    try {
      return await call(`/google/reply/${reviewId}`, { method: 'DELETE' });
    } catch (e) { setError(e.message); throw e; }
    finally { setBusy(false); }
  }, [call]);

  useEffect(() => { loadStatus(); loadConfig(); }, [loadStatus, loadConfig]);

  return {
    status, statusLoading, config, configLoading, savingConfig,
    accounts, locations, stats, reviews, reviewsLoading, busy, error, setError,
    loadStatus, loadConfig, saveConfig, loadAccounts, loadLocations, loadStats, loadReviews,
    connect, disconnect, selectLocation, sync, reply, deleteReply,
  };
}