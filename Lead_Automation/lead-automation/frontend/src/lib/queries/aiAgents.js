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
