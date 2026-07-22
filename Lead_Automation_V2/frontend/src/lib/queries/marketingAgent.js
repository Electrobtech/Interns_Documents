'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// ---------------------------------------------------------------------------
// SEO & content briefs
// ---------------------------------------------------------------------------

// POST /ai-agents/marketing/seo/brief — body: { topic }.
export function useGenerateSEOBrief() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (topic) => call('/ai-agents/marketing/seo/brief', { method: 'POST', body: { topic } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'marketing', 'seo-briefs'] }),
  });
}

// GET /ai-agents/marketing/seo/briefs
export function useSEOBriefs() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'marketing', 'seo-briefs'],
    queryFn: () => call('/ai-agents/marketing/seo/briefs'),
  });
}

// ---------------------------------------------------------------------------
// Personas / ICP
// ---------------------------------------------------------------------------

// POST /ai-agents/marketing/personas — body: { brief, name? }.
export function useGeneratePersona() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/marketing/personas', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'marketing', 'personas'] }),
  });
}

// GET /ai-agents/marketing/personas
export function usePersonas() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'marketing', 'personas'],
    queryFn: () => call('/ai-agents/marketing/personas'),
  });
}

// DELETE /ai-agents/marketing/personas/{id}
export function useDeletePersona() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/ai-agents/marketing/personas/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'marketing', 'personas'] }),
  });
}

// ---------------------------------------------------------------------------
// Campaign planner
// ---------------------------------------------------------------------------

// POST /ai-agents/marketing/campaign-plan — body: { name, goal, timeframe, channels, persona? }.
export function useGenerateCampaignPlan() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/marketing/campaign-plan', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'marketing', 'campaign-plans'] }),
  });
}

// GET /ai-agents/marketing/campaign-plans
export function useCampaignPlans() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'marketing', 'campaign-plans'],
    queryFn: () => call('/ai-agents/marketing/campaign-plans'),
  });
}

// POST /ai-agents/marketing/campaign-plan/{planId}/items/{itemIndex}/convert
// — body: { channel_type, message_body }.
export function useConvertPlanItem() {
  const { call } = useApi();
  return useMutation({
    mutationFn: ({ planId, itemIndex, ...body }) =>
      call(`/ai-agents/marketing/campaign-plan/${planId}/items/${itemIndex}/convert`, {
        method: 'POST',
        body,
      }),
  });
}

// ---------------------------------------------------------------------------
// Competitor intelligence
// ---------------------------------------------------------------------------

// POST /ai-agents/marketing/competitor-intel — body: { subject }.
export function useGenerateCompetitorIntel() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subject) => call('/ai-agents/marketing/competitor-intel', { method: 'POST', body: { subject } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'marketing', 'competitor-reports'] }),
  });
}

// GET /ai-agents/marketing/competitor-reports
export function useCompetitorReports() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'marketing', 'competitor-reports'],
    queryFn: () => call('/ai-agents/marketing/competitor-reports'),
  });
}

// ---------------------------------------------------------------------------
// Sales handoff
// ---------------------------------------------------------------------------

// POST /ai-agents/marketing/sales-handoff — body: { campaign_id?, note? }.
export function useGenerateSalesHandoff() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/ai-agents/marketing/sales-handoff', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-agents', 'handoff'] }),
  });
}

// ---------------------------------------------------------------------------
// Performance analytics
// ---------------------------------------------------------------------------

// GET /ai-agents/marketing/performance?days=X
export function useMarketingPerformance(days = 30) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['ai-agents', 'marketing', 'performance', days],
    queryFn: () => call(`/ai-agents/marketing/performance?days=${days}`),
  });
}
