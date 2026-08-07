'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Hooks for the Marketing Hub's AI-agent-backed features — ai-agent-backend's
// /ai-agents/marketing/* routes (services/ai-marketing-service proxies straight
// through to ai-agent-backend; see ai-agent-backend/app/api/v1/marketing_seo.py,
// marketing_competitor.py, marketing_growth.py).
//
// IMPORTANT — these are NOT live data feeds. Each endpoint is an LLM call that
// reasons about a topic/subject you give it and stores the result; there's no
// real search-rank tracker or competitor-intelligence data source behind any
// of this. The competitor endpoint's response always carries a `disclaimer`
// field that must be shown alongside its output for that reason.

// ---------------------------------------------------------------------------
// SEO briefs — POST /ai-agents/marketing/seo/brief, GET /ai-agents/marketing/seo/briefs
// ---------------------------------------------------------------------------

export function useSeoBriefs() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'seo-briefs'],
    queryFn: () => call('/ai-agents/marketing/seo/briefs'),
  });
}

export function useGenerateSeoBrief() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // body: { topic }
    mutationFn: (body) => call('/ai-agents/marketing/seo/brief', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-hub', 'seo-briefs'] }),
  });
}

// ---------------------------------------------------------------------------
// Competitor intel — POST /ai-agents/marketing/competitor-intel, GET .../competitor-reports
// ---------------------------------------------------------------------------

export function useCompetitorReports() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'competitor-reports'],
    queryFn: () => call('/ai-agents/marketing/competitor-reports'),
  });
}

export function useGenerateCompetitorIntel() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // body: { subject }
    mutationFn: (body) => call('/ai-agents/marketing/competitor-intel', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-hub', 'competitor-reports'] }),
  });
}

// ---------------------------------------------------------------------------
// AEO (answer-engine optimization) — POST /ai-agents/marketing/aeo/optimize,
// GET /ai-agents/marketing/aeo/optimizations
// ---------------------------------------------------------------------------

export function useAeoOptimizations() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'aeo-optimizations'],
    queryFn: () => call('/ai-agents/marketing/aeo/optimizations'),
  });
}

export function useGenerateAeoOptimization() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // body: { copy }
    mutationFn: (body) => call('/ai-agents/marketing/aeo/optimize', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-hub', 'aeo-optimizations'] }),
  });
}

// ---------------------------------------------------------------------------
// Team — GET /users (team-service, proxied by api-gateway).
//
// NOTE: this is the org's user list, not a marketing-specific roster.
// team-service has no department/team scoping on /users (roles are org-wide:
// owner | admin | manager | agent | viewer — there's no "marketing" role or
// department column), so there's nothing to filter by. This intentionally
// mirrors the old mockData.teamMembers behavior of "everyone in the org".
// ---------------------------------------------------------------------------

export function useMarketingTeam() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'team'],
    queryFn: () => call('/users'),
  });
}

// ---------------------------------------------------------------------------
// Assets Library — GET/POST/DELETE /marketing-hub/assets
// (marketing-hub-service; multipart upload via useApi().upload)
// ---------------------------------------------------------------------------

export function useMarketingAssets(type) {
  const { call } = useApi();
  const params = type && type !== 'All' ? `?type=${encodeURIComponent(type)}` : '';
  return useQuery({
    queryKey: ['marketing-hub', 'assets', type || 'All'],
    queryFn: () => call(`/marketing-hub/assets${params}`),
  });
}

export function useUploadMarketingAsset() {
  const { upload } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // formData: FormData with field "file" and optional "type"
    mutationFn: (formData) => upload('/marketing-hub/assets', formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-hub', 'assets'] }),
  });
}

export function useDeleteMarketingAsset() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/marketing-hub/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-hub', 'assets'] }),
  });
}


// ---------------------------------------------------------------------------
// Audiences — GET/POST/PATCH/DELETE /marketing-hub/audiences
// + GET /marketing-hub/audiences/growth
// (marketing-hub-service; Postgres marketing_audiences table)
// ---------------------------------------------------------------------------

export function useMarketingAudiences(status) {
  const { call } = useApi();
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return useQuery({
    queryKey: ['marketing-hub', 'audiences', status || 'all'],
    queryFn: () => call(`/marketing-hub/audiences${params}`),
  });
}

export function useMarketingAudience(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'audiences', id],
    queryFn: () => call(`/marketing-hub/audiences/${id}`),
    enabled: !!id,
  });
}

export function useAudienceGrowth(weeks = 8) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'audiences', 'growth', weeks],
    queryFn: () => call(`/marketing-hub/audiences/growth?weeks=${weeks}`),
  });
}

export function useCreateMarketingAudience() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/marketing-hub/audiences', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'audiences'] });
    },
  });
}

export function useUpdateMarketingAudience() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      call(`/marketing-hub/audiences/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'audiences'] });
    },
  });
}

export function useDeleteMarketingAudience() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/marketing-hub/audiences/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'audiences'] });
    },
  });
}


// ---------------------------------------------------------------------------
// Campaigns — GET/POST/PATCH/DELETE /marketing-hub/campaigns
// (marketing-hub-service; Postgres marketing_campaigns table)
//
// Manual-entry CRUD for ad-platform campaign tracking. Distinct from
// campaign-service outbound broadcasts. See services/marketing-hub-service
// src/campaigns.js header for the data-source decision.
// ---------------------------------------------------------------------------

export function useMarketingCampaigns(filters = {}) {
  const { call } = useApi();
  const status = filters.status;
  const platform = filters.platform;
  const params = new URLSearchParams();
  if (status && status !== 'All') params.set('status', status);
  if (platform && platform !== 'All') params.set('platform', platform);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['marketing-hub', 'campaigns', status || 'all', platform || 'all'],
    queryFn: () => call(`/marketing-hub/campaigns${qs}`),
  });
}

export function useMarketingCampaign(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'campaigns', id],
    queryFn: () => call(`/marketing-hub/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCreateMarketingCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/marketing-hub/campaigns', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'campaigns'] });
    },
  });
}

export function useUpdateMarketingCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      call(`/marketing-hub/campaigns/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'campaigns'] });
    },
  });
}

export function useDeleteMarketingCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/marketing-hub/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'campaigns'] });
    },
  });
}


// ---------------------------------------------------------------------------
// Broadcasts — GET/POST/PATCH/DELETE /marketing-hub/broadcasts
// + POST /marketing-hub/broadcasts/:id/send
// (marketing-hub-service; Postgres marketing_broadcasts table)
//
// One-to-many sends (WhatsApp / Email / SMS). /send uses the same simulation
// convention as campaign-service bulkCampaignWorker — see broadcasts.js header.
// ---------------------------------------------------------------------------

export function useMarketingBroadcasts(filters = {}) {
  const { call } = useApi();
  const status = filters.status;
  const channel = filters.channel;
  const params = new URLSearchParams();
  if (status && status !== 'All') params.set('status', status);
  if (channel && channel !== 'All') params.set('channel', channel);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['marketing-hub', 'broadcasts', status || 'all', channel || 'all'],
    queryFn: () => call(`/marketing-hub/broadcasts${qs}`),
  });
}

export function useMarketingBroadcast(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing-hub', 'broadcasts', id],
    queryFn: () => call(`/marketing-hub/broadcasts/${id}`),
    enabled: !!id,
  });
}

export function useCreateMarketingBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/marketing-hub/broadcasts', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'broadcasts'] });
    },
  });
}

export function useUpdateMarketingBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      call(`/marketing-hub/broadcasts/${id}`, { method: 'PATCH', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'broadcasts'] });
    },
  });
}

export function useDeleteMarketingBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/marketing-hub/broadcasts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'broadcasts'] });
    },
  });
}

export function useSendMarketingBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) =>
      call(`/marketing-hub/broadcasts/${id}/send`, { method: 'POST', body: body || {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'broadcasts'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Marketing Calendar — GET/POST/DELETE /marketing-hub/calendar
// Aggregates standalone meeting/reminder rows + derived campaign/broadcast
// events from marketing_campaigns / marketing_broadcasts.
// ---------------------------------------------------------------------------

export function useMarketingCalendar(from, to) {
  const { call } = useApi();
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['marketing-hub', 'calendar', from || '', to || ''],
    queryFn: () => call(`/marketing-hub/calendar${qs}`),
  });
}

export function useCreateMarketingCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/marketing-hub/calendar', { method: 'POST', body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'calendar'] });
    },
  });
}

export function useDeleteMarketingCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/marketing-hub/calendar/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing-hub', 'calendar'] });
    },
  });
}
