'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// GET /ai-agents/status — Overview dashboard KPIs.
export function useAgentStatus() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'status'],
    queryFn: () => call('/ai-agents/status'),
    refetchInterval: 20_000,
  });
}

// GET /ai-agents/knowledge?agent_type=X — list uploaded knowledge sources.
export function useKnowledgeSources(agentType) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'knowledge', agentType],
    queryFn: () => call(`/ai-agents/knowledge?agent_type=${encodeURIComponent(agentType)}`),
    enabled: !!agentType,
    refetchInterval: (query) => {
      const rows = Array.isArray(query.state.data) ? query.state.data : [];
      return rows.some((r) => r.status === 'processing') ? 3000 : false;
    },
  });
}

// POST /ai-agents/knowledge/upload — multipart: agent_type, file.
export function useUploadKnowledge(agentType) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const formData = new FormData();
      formData.append('agent_type', agentType);
      formData.append('file', file);
      return call('/ai-agents/knowledge/upload', { method: 'POST', body: formData });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'knowledge', agentType] }),
  });
}

// DELETE /ai-agents/knowledge/{id}
export function useDeleteKnowledge(agentType) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/ai-agents/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'knowledge', agentType] }),
  });
}

// POST /ai-agents/knowledge/{id}/reindex — multipart: file. Re-chunks/
// re-embeds an existing source and bumps its version.
export function useReindexKnowledge(agentType) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }) => {
      const formData = new FormData();
      formData.append('file', file);
      return call(`/ai-agents/knowledge/${id}/reindex`, { method: 'POST', body: formData });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'knowledge', agentType] }),
  });
}

// POST /ai-agents/marketing/run — body: { brief }.
export function useRunMarketingAgent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (brief) => call('/ai-agents/marketing/run', { method: 'POST', body: { brief } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'marketing', 'runs'] }),
  });
}

// GET /ai-agents/marketing/runs — recent generation history.
export function useMarketingRuns() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'marketing', 'runs'],
    queryFn: () => call('/ai-agents/marketing/runs'),
  });
}

// POST /ai-agents/sales/run — body: { brief, lead_name?, company?, existing_score?, stage? }.
export function useRunSalesAgent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/sales/run', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'sales', 'runs'] }),
  });
}

// GET /ai-agents/sales/runs — recent generation history.
export function useSalesRuns() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'sales', 'runs'],
    queryFn: () => call('/ai-agents/sales/runs'),
  });
}

// POST /ai-agents/support/run — body: { brief, customer_name?, channel?, session_id? }.
export function useRunSupportAgent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/support/run', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'support', 'runs'] }),
  });
}

// POST /ai-agents/support/run, used by the inbox SuggestedReplyCard.
// Same endpoint as useRunSupportAgent but deliberately does NOT invalidate the
// runs list: this fires automatically per inbound message, and refetching the
// history on every suggestion would churn the Support workspace underneath.
export function useSuggestSupportReply() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/support/run', { method: 'POST', body }),
  });
}

// GET /ai-agents/support/runs — recent generation history.
export function useSupportRuns() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'support', 'runs'],
    queryFn: () => call('/ai-agents/support/runs'),
  });
}

// GET /ai-agents/analytics?range=X — real run counts per agent per day.
export function useAgentAnalytics(range = '7d') {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'analytics', range],
    queryFn: () => call(`/ai-agents/analytics?range=${encodeURIComponent(range)}`),
    refetchInterval: 30_000,
  });
}

// GET /ai-agents/handoff?status=X&agent_type=Y — human handoff queue.
export function useHandoffs(status) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'handoff', status || 'all'],
    queryFn: () => call(`/ai-agents/handoff${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    refetchInterval: 20_000,
  });
}

// PATCH /ai-agents/handoff/:id — { status: 'assigned'|'resolved'|'rejected', resolution_note? }
export function useUpdateHandoff() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/ai-agents/handoff/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'handoff'] }),
  });
}


/* ─── Restored panels: sales fit scoring + support coverage audit ─────────
   Both reuse the agents' existing /run endpoints rather than inventing new
   routes — the panels differ in how they frame the brief and render the
   result, not in what the backend does. */

// POST /ai-agents/sales/fit-score — { org_size, budget, channel } ->
// { score, tier, tier_reason, factors, recommended_action }.
//
// Not /sales/run: that endpoint requires a free-text `brief` (so this 422'd
// with "Unprocessable Entity") and returns lead_score, not the score/tier
// shape these panels render. Fit scoring is also rule-based rather than an
// LLM call, because the panel re-scores on every pill change and has to be
// instant and repeatable.
export function useScoreLeadFit() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/sales/fit-score', { method: 'POST', body }),
  });
}

// Checks whether the knowledge base can actually answer a given question.
// Backed by POST /ai-agents/support/run: human_handoff / low-confidence in the
// response is exactly the "not covered" signal this audit reports.
export function useSupportCoverageAudit() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/support/run', { method: 'POST', body }),
  });
}
