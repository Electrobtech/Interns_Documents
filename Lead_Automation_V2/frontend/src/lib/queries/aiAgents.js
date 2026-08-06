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
 * GET /ai-agents/{workspace}/runs — recent execution history for one agent.
 *
 * NOTE: this used to call `/ai-agents/runs?workspace=X`, which 404s — no
 * such route exists on this backend (see api/v1/router.py: only
 * `/marketing/runs`, `/sales/runs`, `/support/runs` are registered, each
 * under its own file). That 404 is the exact bug in the error report: three
 * workspaces all failing the same way because they share this one hook.
 * `limit` isn't accepted server-side (each endpoint returns its own default
 * page), so it's applied client-side after the fact — harmless, just means
 * asking for more than you'll use.
 *
 * Distinct from useAgentSessions: a session is a conversation, a run is a
 * single execution within it. The dashboard cards and the per-page "recent
 * activity" lists want runs.
 */
export function useAgentRuns(workspace, { limit = 10 } = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'runs', workspace, limit],
    queryFn: async () => {
      const rows = await call(`${AI}/${encodeURIComponent(workspace)}/runs`);
      return Array.isArray(rows) ? rows.slice(0, limit) : rows;
    },
    enabled: !!workspace,
    refetchInterval: 20_000,
  });
}

export const useMarketingRuns = (opts) => useAgentRuns('marketing', opts);
export const useSalesRuns = (opts) => useAgentRuns('sales', opts);
export const useSupportRuns = (opts) => useAgentRuns('support', opts);

/**
 * GET /ai-agents/sales/runs — recent Sales Agent executions with full output
 * (lead_score, lead_qualification_reason, buying_intent_summary, ...).
 *
 * Distinct from useSalesRuns() above: that one calls the generic
 * `/ai-agents/runs?workspace=sales` endpoint, which isn't implemented on
 * this backend (see api/v1/router.py — no such route is registered) and
 * will 404. This hook calls the sales-specific endpoint that actually
 * exists (api/v1/sales.py `list_sales_runs`), so the Sales Agent Brain Log
 * can show real completed runs instead of mock entries.
 */
export function useSalesAgentRuns() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'sales', 'runs'],
    queryFn: () => call(`${AI}/sales/runs`),
    refetchInterval: 20_000,
  });
}

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

/* ─── Lead fit scoring (random forest) ───────────────────────────────────── */

/**
 * POST /ai-agents/sales/fit-score — { org_size, budget, channel } ->
 * { score, tier, tier_reason, factors[], recommended_action }.
 *
 * Backed by a random forest model (ai-agent-backend/app/ml/lead_scoring_model.py),
 * not an LLM call — this is why it's safe to fire on every pill change in
 * FitScorerPanel/LeadDetailDrawer without debouncing: inference is
 * sub-millisecond and deterministic for the same three inputs.
 */
export function useScoreLeadFit() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call(`${AI}/sales/fit-score`, { method: 'POST', body }),
  });
}

/**
 * Applies a Fit Scorer result to a real lead: writes the score/stage to the
 * CRM record and, if the caller drafted a follow-up and asked to send it,
 * dispatches it on the lead's channel. Two plain REST calls chained
 * client-side (update lead, then best-effort find-conversation + reply)
 * rather than a bespoke backend endpoint — both calls already exist and are
 * used elsewhere (contact-service /leads/:id, inbox-service conversations).
 *
 * @param leadId, lead_score, opportunity_stage, follow_up_message?,
 *        channel_type?, send_follow_up?
 */
export function useApplyRecommendation() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ leadId, lead_score, opportunity_stage, follow_up_message, channel_type, send_follow_up }) => {
      const updated = await call(`/leads/${leadId}`, {
        method: 'PUT',
        body: { score: lead_score, stage: opportunity_stage },
      });

      let follow_up_queued = false;
      if (send_follow_up && follow_up_message) {
        try {
          const matches = await call(`/conversations?q=${encodeURIComponent(updated?.name || '')}&limit=1`);
          const conversation = Array.isArray(matches) && matches.length ? matches[0] : null;
          if (conversation) {
            await call(`/conversations/${conversation.id}/reply`, {
              method: 'POST',
              body: { body: follow_up_message },
            });
            follow_up_queued = true;
          }
        } catch {
          // Best-effort: the CRM update above already succeeded and is the
          // part the "Applied to CRM" confirmation is about. A missing
          // conversation to reply on shouldn't fail the whole action.
        }
      }

      return { ...updated, follow_up_queued };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads', 'list'] });
      qc.invalidateQueries({ queryKey: ['conversations', 'list'] });
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

/* ─── Sales Agent config (Pipeline Value + AI Confidence CTAs) ───────────── */

/**
 * GET /ai-agents/sales/config — the deal-value field mapping and confidence
 * signal weights, plus backend-computed `computed.pipeline_value` /
 * `computed.ai_confidence`. Powers the Overview tab's Pipeline Value and AI
 * Confidence metric cards: while unconfigured these come back null and the
 * card shows its CTA; once configured they show a real number.
 */
export function useSalesAgentConfig() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'sales', 'config'],
    queryFn: () => call(`${AI}/sales/config`),
    staleTime: 10_000,
  });
}

/** PATCH /ai-agents/sales/config — { deal_value_field?, confidence_signals? } */
export function useUpdateSalesAgentConfig() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${AI}/sales/config`, { method: 'PATCH', body }),
    onSuccess: (data) => {
      qc.setQueryData(['ai-agents', 'sales', 'config'], data);
      qc.invalidateQueries({ queryKey: ['ai-agents', 'sales', 'config'] });
    },
  });
}

/**
 * GET /ai-agents/sales/queue — real queued work (overdue/today follow-ups +
 * pending handoffs). Backs the header's "Running · N tasks queued" badge and
 * its click-to-expand drawer, replacing the hardcoded "12 tasks queued".
 */
export function useSalesAgentQueue() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'sales', 'queue'],
    queryFn: () => call(`${AI}/sales/queue`),
    refetchInterval: 20_000,
  });
}

/**
 * GET /ai-agents/sales/export — export payload for the header's Export
 * button. Fetched on demand (button click), not on mount, so it's a
 * mutation-shaped query rather than a useQuery.
 */
export function useExportSalesData() {
  const { call } = useApi();
  return useMutation({
    mutationFn: () => call(`${AI}/sales/export`),
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
