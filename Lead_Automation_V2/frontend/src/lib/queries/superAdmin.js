'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSuperAdminApi } from '@/lib/useSuperAdminApi';
import {
  getCompanies as storeGetCompanies,
  registerCompany as storeRegisterCompany,
  updateCompany as storeUpdateCompany,
  updateCompanyStatus as storeUpdateCompanyStatus,
} from '@/lib/companyStore';

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
    queryFn: async () => {
      const result = await call(`/super-admin/companies${params ? `?${params}` : ''}`);
      // companyModel.list() (shared/src/models/companyModel.js) returns raw
      // DB column names (company_email, subscription_plan, created_at).
      // CompanyRow below reads email/plan/registeredAt — map here rather
      // than touching the presentational component, since the company
      // detail page already reads the raw column names directly off the
      // same backend and shouldn't be made inconsistent with this one.
      return {
        ...result,
        rows: result.rows.map((c) => ({
          ...c,
          email: c.company_email,
          plan: c.subscription_plan,
          registeredAt: c.created_at,
        })),
      };
    },
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    // Still mock, and NOT just "not wired up yet": there is no backend
    // route for this at all (no companyModel.create(), no POST
    // /super-admin/companies). Tenants create themselves via the 8-step
    // wizard at POST /auth/register/company (companyController.js), which
    // collects GST/legal-name/password data no Super Admin should be
    // fabricating on a tenant's behalf. If the product genuinely wants
    // Super Admin to be able to hand-create a tenant (e.g. for a sales-led
    // onboarding), that needs a real decision about what subset of the
    // registration wizard's fields this skips, then a real
    // companyModel.create() + route — not just pointing this at the
    // existing endpoint, which expects the full registration payload.
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
    // Still mock — same gap as useCreateCompany above. Only two narrow,
    // real routes exist for mutating a company: PATCH .../status and
    // PATCH .../plan (both live, see useUpdateCompanyStatus/
    // useUpdateCompanyPlan below). A generic "edit name/email/industry"
    // route (companyModel has no update() beyond updateStatus/
    // updateSubscriptionPlan) doesn't exist yet — it's a real backend gap,
    // not a wiring gap.
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
    mutationFn: (status) => call(`/super-admin/companies/${companyId}/status`, { method: 'PATCH', body: { status } }),
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

// ---------- Channel quotas (Module 1) ----------
export function useChannelQuotas(companyId) {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'companies', companyId, 'channels'],
    queryFn: () => call(`/super-admin/companies/${companyId}/channels`),
    enabled: !!companyId,
  });
}

export function useUpdateChannelQuota(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    // patch: { enabled?, monthlyQuota?, lowQuotaThresholdPct?, disabledReason? }
    mutationFn: ({ channel, ...patch }) =>
      call(`/super-admin/companies/${companyId}/channels/${channel}`, { method: 'PUT', body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'channels'] });
    },
  });
}

export function useResetChannelUsage(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (channel) =>
      call(`/super-admin/companies/${companyId}/channels/${channel}/reset`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'channels'] });
    },
  });
}

// ---------- Subscriptions, Invoicing & GST Billing (Module 2) ----------
export function useSubscription(companyId) {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'companies', companyId, 'subscription'],
    queryFn: () => call(`/super-admin/companies/${companyId}/subscription`),
    enabled: !!companyId,
    retry: false, // 404 (no subscription row yet) is a valid, non-transient state — don't retry it
  });
}

export function useUpdateSubscription(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    // patch: { plan?, billingCycle?, amount?, autoBilling? }
    mutationFn: (patch) => call(`/super-admin/companies/${companyId}/subscription`, { method: 'PUT', body: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'subscription'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId] });
    },
  });
}

export function useUpdateSubscriptionStatus(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (status) =>
      call(`/super-admin/companies/${companyId}/subscription/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'subscription'] }),
  });
}

export function useRenewSubscription(companyId) {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call(`/super-admin/companies/${companyId}/subscription/renew`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'subscription'] });
      qc.invalidateQueries({ queryKey: ['super-admin', 'companies', companyId, 'invoices'] });
    },
  });
}

export function useCompanyInvoices(companyId) {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'companies', companyId, 'invoices'],
    queryFn: () => call(`/super-admin/companies/${companyId}/invoices`),
    enabled: !!companyId,
  });
}

export function usePlatformInvoices(filters = {}) {
  const { call } = useSuperAdminApi();
  const params = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['super-admin', 'invoices', filters],
    queryFn: () => call(`/super-admin/invoices${params ? `?${params}` : ''}`),
  });
}

export function useIssueInvoice() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId) => call(`/super-admin/invoices/${invoiceId}/issue`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'invoices'] }),
  });
}

export function useVoidInvoice() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (invoiceId) => call(`/super-admin/invoices/${invoiceId}/void`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'invoices'] }),
  });
}

export function useBillingSummary() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'billing', 'summary'],
    queryFn: () => call('/super-admin/billing/summary'),
  });
}

export function usePlatformPayments(filters = {}) {
  const { call } = useSuperAdminApi();
  const params = new URLSearchParams(filters).toString();
  return useQuery({
    queryKey: ['super-admin', 'payments', filters],
    queryFn: () => call(`/super-admin/payments${params ? `?${params}` : ''}`),
  });
}

export function useRefundPayment() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ paymentId, reason }) =>
      call(`/super-admin/payments/${paymentId}/refund`, { method: 'POST', body: { reason } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'payments'] }),
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

// ---------- Analytics (Module 3) ----------
// rangeParams: { range: 'today'|'7d'|'30d'|'this_month'|'custom', from?, to? }
export function useAnalyticsOverview(rangeParams) {
  const { call } = useSuperAdminApi();
  const params = new URLSearchParams(rangeParams).toString();
  return useQuery({
    queryKey: ['super-admin', 'analytics', 'overview', rangeParams],
    queryFn: () => call(`/super-admin/analytics/overview?${params}`),
  });
}

export function useAnalyticsChannels(rangeParams) {
  const { call } = useSuperAdminApi();
  const params = new URLSearchParams(rangeParams).toString();
  return useQuery({
    queryKey: ['super-admin', 'analytics', 'channels', rangeParams],
    queryFn: () => call(`/super-admin/analytics/channels?${params}`),
  });
}

export function useAnalyticsAutomation(rangeParams) {
  const { call } = useSuperAdminApi();
  const params = new URLSearchParams(rangeParams).toString();
  return useQuery({
    queryKey: ['super-admin', 'analytics', 'automation', rangeParams],
    queryFn: () => call(`/super-admin/analytics/automation?${params}`),
  });
}

// ---------- Governance & System Health (Module 4) ----------
export function useCurrentAdmin() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'me'],
    queryFn: () => call('/super-admin/me'),
    staleTime: 5 * 60 * 1000, // role rarely changes mid-session; no need to refetch aggressively
  });
}

export function useAdmins() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'admins'],
    queryFn: () => call('/super-admin/admins'),
  });
}

export function useCreateAdmin() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => call('/super-admin/admins', { method: 'POST', body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'admins'] }),
  });
}

export function useUpdateAdminRole() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }) => call(`/super-admin/admins/${id}/role`, { method: 'PATCH', body: { role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'admins'] }),
  });
}

export function useUpdateAdminStatus() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }) => call(`/super-admin/admins/${id}/status`, { method: 'PATCH', body: { status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'admins'] }),
  });
}

export function useAnnouncements() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'announcements'],
    queryFn: () => call('/super-admin/announcements'),
  });
}

export function useCreateAnnouncement() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => call('/super-admin/announcements', { method: 'POST', body: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'announcements'] }),
  });
}

export function useUpdateAnnouncement() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }) => call(`/super-admin/announcements/${id}`, { method: 'PUT', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'announcements'] }),
  });
}

export function useDeleteAnnouncement() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/super-admin/announcements/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'announcements'] }),
  });
}

export function useProviderStatus() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'system-health', 'providers'],
    queryFn: () => call('/super-admin/system-health/providers'),
  });
}

export function useUpdateProviderStatus() {
  const { call } = useSuperAdminApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceKey, ...patch }) =>
      call(`/super-admin/system-health/providers/${serviceKey}`, { method: 'PATCH', body: patch }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['super-admin', 'system-health', 'providers'] }),
  });
}

// Live internal service pings — short staleTime + manual refetch button in
// the UI rather than aggressive polling, since each call fans out to every
// microservice (see platformHealthModel.js).
export function useInternalHealth() {
  const { call } = useSuperAdminApi();
  return useQuery({
    queryKey: ['super-admin', 'system-health', 'internal'],
    queryFn: () => call('/super-admin/system-health/internal'),
    staleTime: 30 * 1000,
  });
}