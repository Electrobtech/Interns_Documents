'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSuperAdminApi } from '@/lib/useSuperAdminApi';
import {
  getCompanies as storeGetCompanies,
  registerCompany as storeRegisterCompany,
  updateCompany as storeUpdateCompany,
  updateCompanyStatus as storeUpdateCompanyStatus,
  getAuditLogs as storeGetAuditLogs,
} from '@/lib/companyStore';

// Super Admin API hooks — mirrors the shape of lib/queries/crm.js, just
// against /super-admin/* and using useSuperAdminApi() instead of useApi().

// TEMP: demo/mock dashboard data so the dashboard shows realistic numbers
// instead of empty zero-states while the platform is still onboarding
// tenants. Swap `queryFn` back to `() => call('/super-admin/dashboard')`
// to resume reading live data from the backend.
const MOCK_DASHBOARD_DATA = {
  financials: {
    total_revenue_collected: 245000,
    total_active_balance: 85000,
    low_balance_org_count: 3,
  },
  tenantsByStatus: [
    { status: 'active', count: 12 },
    { status: 'pending', count: 3 },
    { status: 'suspended', count: 2 },
  ],
  lowBalanceAlerts: [
    { id: 'org_electrobtech', name: 'Electrobtech Innovations', balance: 420, low_balance_threshold: 1000 },
    { id: 'org_nimbus_retail', name: 'Nimbus Retail Pvt Ltd', balance: 610, low_balance_threshold: 1500 },
    { id: 'org_bluepeak', name: 'BluePeak Logistics', balance: 250, low_balance_threshold: 1000 },
  ],
};

export function useSuperAdminDashboard() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: () => Promise.resolve(MOCK_DASHBOARD_DATA),
    // queryFn: () => call('/super-admin/dashboard'), // live data — restore when ready
    refetchInterval: 30_000,
  });
}

export function useCompanies(filters = {}) {
  const { call } = useSuperAdminApi();
  const { search = '', status = '', page = 1, pageSize = 20 } = filters;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return useQuery({
    queryKey: ['super-admin', 'companies', filters],
    // TEMP: reads from the localStorage-backed companyStore (seeded with
    // dummy tenants, plus anything registered/edited since). Swap back to
    // `call(...)` below once the backend endpoint is wired up.
    queryFn: () => {
      const all = storeGetCompanies();
      const rows = all.filter((c) => {
        const matchesSearch =
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.email || '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !status || c.status === status;
        return matchesSearch && matchesStatus;
      });
      const start = (page - 1) * pageSize;
      return Promise.resolve({
        rows: rows.slice(start, start + pageSize),
        page,
        pageSize,
        total: rows.length,
      });
    },
    // queryFn: () => call(`/super-admin/companies${params ? `?${params}` : ''}`), // live data — restore when ready
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    // TEMP: writes into the localStorage-backed companyStore (also logs
    // the `company.registered` audit entry). Swap for a real
    // `call('/super-admin/companies', { method: 'POST', body: payload })`
    // once the backend endpoint is wired up.
    mutationFn: (payload) => Promise.resolve(storeRegisterCompany(payload)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'audit-logs'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
    },
  });
}

// Full-record edit (Company Name, Email, Industry, Plan, Phone, Address,
// Status) — distinct from useUpdateCompanyStatus, which only ever
// changes the one `status` field and logs a from→to audit line.
export function useUpdateCompany(companyId) {
  const qc = useQueryClient();
  return useMutation({
    // TEMP: patches the localStorage-backed companyStore + logs a
    // `company.updated` audit entry. Swap for a real
    // `call(`/super-admin/companies/${companyId}`, { method: 'PATCH', body: patch })`
    // once the backend endpoint is wired up.
    mutationFn: (patch) => Promise.resolve(storeUpdateCompany(companyId, patch)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'audit-logs'] });
    },
  });
}

export function useCompanyDetail(companyId) {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'companies', companyId],
    queryFn: () => call(`/super-admin/companies/${companyId}`),
    enabled: !!companyId,
  });
}

export function useUpdateCompanyStatus(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    // TEMP: writes into the localStorage-backed companyStore + audit log.
    // Swap for `call(`/super-admin/companies/${companyId}/status`, { method: 'PATCH', body: { status } })`
    // once the backend endpoint is wired up.
    mutationFn: (status) => Promise.resolve(storeUpdateCompanyStatus(companyId, status)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'audit-logs'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
    },
  });
}

export function useUpdateCompanyPlan(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscriptionPlan) =>
      call(`/super-admin/companies/${companyId}/plan`, { method: 'PATCH', body: { subscriptionPlan } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies'] });
    },
  });
}

export function useWalletLedger(companyId, { page = 1, pageSize = 50 } = {}) {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'companies', companyId, 'wallet-ledger', page],
    queryFn: () => call(`/super-admin/companies/${companyId}/wallet/ledger?page=${page}&pageSize=${pageSize}`),
    enabled: !!companyId,
  });
}

export function useRechargeWallet(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ amount, description, referenceId }) =>
      call(`/super-admin/companies/${companyId}/wallet/recharge`, {
        method: 'POST',
        body: { amount, description, referenceId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'wallet-ledger'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'dashboard'] });
    },
  });
}

export function useFeatureFlags(companyId) {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'companies', companyId, 'feature-flags'],
    queryFn: () => call(`/super-admin/companies/${companyId}/feature-flags`),
    enabled: !!companyId,
  });
}

export function useUpdateFeatureFlag(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ flagKey, enabled }) =>
      call(`/super-admin/companies/${companyId}/feature-flags/${flagKey}`, { method: 'PUT', body: { enabled } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'feature-flags'] });
    },
  });
}

export function useAuditLogs(filters = {}) {
  const { call } = useSuperAdminApi();
  const { action = '' } = filters;
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return useQuery({
    queryKey: ['super-admin', 'audit-logs', filters],
    // TEMP: reads the localStorage-backed audit trail (seeded with a
    // couple of demo entries, plus every registration/edit/status-change
    // logged since). Swap back to `call(...)` below once the backend
    // endpoint is wired up.
    queryFn: () => {
      const rows = storeGetAuditLogs().filter(
        (log) => !action || log.action.toLowerCase().includes(action.toLowerCase())
      );
      return Promise.resolve(rows);
    },
    // queryFn: () => call(`/super-admin/audit-logs${params ? `?${params}` : ''}`), // live data — restore when ready
  });
}