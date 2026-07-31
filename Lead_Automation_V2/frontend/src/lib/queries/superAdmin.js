'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSuperAdminApi } from '@/lib/useSuperAdminApi';

// Super Admin API hooks — mirrors the shape of lib/queries/crm.js, just
// against /super-admin/* and using useSuperAdminApi() instead of useApi().

export function useSuperAdminDashboard() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'dashboard'],
    queryFn: () => call('/super-admin/dashboard'),
    refetchInterval: 30_000,
  });
}

export function useCompanies(filters = {}) {
  const { call } = useSuperAdminApi();
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return useQuery({
    queryKey: ['super-admin', 'companies', filters],
    queryFn: () => call(`/super-admin/companies${params ? `?${params}` : ''}`),
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
    mutationFn: (status) => call(`/super-admin/companies/${companyId}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies'] });
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
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== '')
  ).toString();
  return useQuery({
    queryKey: ['super-admin', 'audit-logs', filters],
    queryFn: () => call(`/super-admin/audit-logs${params ? `?${params}` : ''}`),
  });
}
