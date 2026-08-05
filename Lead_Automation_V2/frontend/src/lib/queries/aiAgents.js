'use client';
/**
 * Orbq AI agent hooks — the ONLY module that talks to the AI backend.
 *
 * Contract: three agent endpoints plus reads for state the UI needs
 * (dashboard, sessions, explainability, knowledge). Capability selection is the
 * orchestrator's job — the frontend describes what it wants, never which
 * capability to run. That is why there is no useGenerateSEOBrief() here any
 * more: SEO is one of ~30 capabilities the orchestrator may pick.
 *
 * Live data: dashboard and analytics poll on an interval and refetch on window
 * focus, so the AI Operations Center reflects reality without a manual refresh.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

const AI = '/ai-agents';

/* ─── Live dashboard ─────────────────────────────────────────────────────── */

/**
 * GET /ai-agents/status — per-agent cards + org KPI strip.
 *
 * Every figure is computed from agent_executions. Metrics the AI layer cannot
 * compute (revenueInfluenced, leadsProcessed) come back as null by design;
 * render them with `fmt()` below so they show an em-dash rather than a
 * plausible-looking fake number.
 */
export function useAgentStatus({ live = true } = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'status'],
    queryFn: () => call(`${AI}/status`),
    refetchInterval: live ? 15_000 : false,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
  });
}

/** GET /ai-agents/analytics?range=24h|7d|30d|90d — time series + capability leaderboard. */
export function useAgentAnalytics(range = '7d', { live = true } = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'analytics', range],
    queryFn: () => call(`${AI}/analytics?range=${encodeURIComponent(range)}`),
    refetchInterval: live ? 30_000 : false,
    refetchOnWindowFocus: true,
  });
}

/* ─── The three agents ───────────────────────────────────────────────────── */

/**
 * POST /agents/{workspace} — the whole public agent surface.
 *
 * @param workspace 'marketing' | 'sales' | 'support'
 * Body: { message, context?, session_id?, mode?, max_capabilities? }
 * Returns the envelope: { session_id, execution_id, status, output,
 *                         explanation, approvals, usage }
 */
function useRunAgent(workspace) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      call(`/agents/${workspace}`, {
        method: 'POST',
        body: typeof body === 'string' ? { message: body } : body,
      }),
    onSuccess: () => {
      // A run changes the dashboard counters, so refresh them immediately
      // rather than waiting out the poll interval.
      qc.invalidateQueries({ queryKey: ['ai-agents', 'status'] });
      qc.invalidateQueries({ queryKey: ['ai-agents', 'sessions'] });
    },
  });
}

export const useRunMarketingAgent = () => useRunAgent('marketing');
export const useRunSalesAgent = () => useRunAgent('sales');
export const useRunSupportAgent = () => useRunAgent('support');

/**
 * Inbox reply suggestions. Same endpoint as useRunSupportAgent, but
 * deliberately does NOT invalidate anything: this fires per inbound message,
 * and churning the dashboard on every suggestion would make it unreadable.
 */
export function useSuggestSupportReply() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) =>
      call('/agents/support', {
        method: 'POST',
        body: typeof body === 'string' ? { message: body } : body,
      }),
  });
}

/* ─── Sessions & explainability ──────────────────────────────────────────── */

export function useAgentSessions(workspace) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'sessions', workspace || 'all'],
    queryFn: () =>
      call(`/sessions${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''}`),
    refetchInterval: 20_000,
  });
}

/**
 * GET /ai-agents/runs?workspace=X — recent execution history for one agent.
 *
 * Distinct from useAgentSessions: a session is a conversation, a run is a
 * single execution within it. The dashboard cards and the per-page "recent
 * activity" lists want runs.
 */
export function useAgentRuns(workspace, { limit = 10 } = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'runs', workspace, limit],
    queryFn: () =>
      call(`${AI}/runs?workspace=${encodeURIComponent(workspace)}&limit=${limit}`),
    enabled: !!workspace,
    refetchInterval: 20_000,
  });
}

export const useMarketingRuns = (opts) => useAgentRuns('marketing', opts);
export const useSalesRuns = (opts) => useAgentRuns('sales', opts);
export const useSupportRuns = (opts) => useAgentRuns('support', opts);

/**
 * GET /sessions/{id}/executions — the decision trace (§15).
 * Backs the Transparency Log / Agent Brain Log: reasoning, confidence,
 * knowledge cited, alternatives considered, and which inputs were degraded.
 */
export function useSessionExecutions(sessionId) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'sessions', sessionId, 'executions'],
    queryFn: () => call(`/sessions/${sessionId}/executions`),
    enabled: !!sessionId,
  });
}

/* ─── Knowledge base ─────────────────────────────────────────────────────── */

export function useKnowledgeSources(workspace) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'knowledge', workspace],
    queryFn: () => call(`${AI}/knowledge?workspace=${encodeURIComponent(workspace)}`),
    enabled: !!workspace,
    // Ingestion is async (202 Accepted + background worker). Poll while
    // anything is still processing, then stop.
    refetchInterval: (query) => {
      const rows = Array.isArray(query.state.data) ? query.state.data : [];
      return rows.some((r) => r.status === 'processing' || r.status === 'pending') ? 3000 : false;
    },
  });
}

export function useUploadKnowledge(workspace) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append('workspace', workspace);
      formData.append('file', file);
      return call(`${AI}/knowledge/upload`, { method: 'POST', body: formData });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'knowledge', workspace] }),
  });
}

export function useReindexKnowledge(workspace) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }) => {
      const formData = new FormData();
      if (file) formData.append('file', file);
      return call(`${AI}/knowledge/${id}/reindex`, { method: 'POST', body: formData });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'knowledge', workspace] }),
  });
}

export function useDeleteKnowledge(workspace) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${AI}/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'knowledge', workspace] }),
  });
}

/* ─── Approvals (Phase 19) ───────────────────────────────────────────────── */

export function usePendingApprovals(workspace) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'approvals', workspace || 'all'],
    queryFn: () =>
      call(`${AI}/approvals${workspace ? `?workspace=${encodeURIComponent(workspace)}` : ''}`),
    refetchInterval: 20_000,
  });
}

export function useDecideApproval() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision, comment }) =>
      call(`${AI}/approvals/${id}/decide`, {
        method: 'POST',
        body: { decision, comment },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-agents', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['ai-agents', 'status'] });
    },
  });
}

/* ─── Handoffs (Phase 20) ────────────────────────────────────────────────── */

export function useHandoffs(status) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'handoff', status || 'all'],
    queryFn: () => call(`${AI}/handoff${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    refetchInterval: 20_000,
  });
}

export function useUpdateHandoff() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${AI}/handoff/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'handoff'] }),
  });
}

/* ─── Display helpers ────────────────────────────────────────────────────── */

/**
 * Render a metric that the backend may legitimately not know yet.
 *
 * The backend returns null for figures the AI layer cannot compute (they live
 * in the Node CRM). Showing an em-dash is honest; showing 0 or a placeholder
 * number would misrepresent it as measured.
 */
export function fmt(value, { suffix = '', prefix = '', fallback = '—' } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return `${prefix}${typeof value === 'number' ? value.toLocaleString() : value}${suffix}`;
}
