'use client';
/**
 * Marketing Hub — the real backend at /marketing-hub/* (services/
 * marketing-hub-service), behind a channel-simulation layer. Backs
 * frontend/src/components/marketing-hub/'s Campaigns/Broadcasts/Audience/
 * Channels pages. A separate, unrelated file from lib/queries/campaigns.js
 * (that one calls /ai-agents/marketing/*, a different, non-functional
 * backend — don't conflate the two).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

const BASE = '/marketing-hub';

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

// Mirrors mh_campaigns.channel's CHECK constraint exactly, so the UI can
// never submit a value the DB would reject.
export const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp Business', broadcastsSupported: true },
  { value: 'email', label: 'Email', broadcastsSupported: true },
  { value: 'sms', label: 'SMS', broadcastsSupported: true },
  { value: 'messenger', label: 'Facebook Messenger', broadcastsSupported: true },
  { value: 'instagram', label: 'Instagram', broadcastsSupported: 'limited' },
  { value: 'linkedin', label: 'LinkedIn', broadcastsSupported: false },
];

// Mirrors mh_recipients.status's CHECK constraint, in funnel order.
export const RECIPIENT_STATUSES = ['queued', 'sending', 'sent', 'delivered', 'read', 'replied', 'failed'];

export const OBJECTIVES = [
  'Lead Generation', 'Website Traffic', 'Sales', 'Engagement', 'Brand Awareness',
  'Event Registration', 'Webinar', 'Course Registration', 'Remarketing', 'Conversion',
];

/* ─── Shared factory — campaigns and broadcasts are both mh_campaigns rows,
   distinguished server-side by `kind`, so they share one hook shape. ─── */
function buildEntityHooks(resource, entityKey) {
  function useList(filters = {}) {
    const { call } = useApi();
    return useQuery({
      queryKey: ['marketingHub', entityKey, 'list', filters],
      queryFn: () => call(`${BASE}/${resource}${qs(filters)}`),
      placeholderData: (prev) => prev,
    });
  }

  function useOne(id) {
    const { call } = useApi();
    return useQuery({
      queryKey: ['marketingHub', entityKey, id],
      queryFn: () => call(`${BASE}/${resource}/${id}`),
      enabled: !!id,
    });
  }

  function useRecipients(id) {
    const { call } = useApi();
    return useQuery({
      queryKey: ['marketingHub', entityKey, id, 'recipients'],
      queryFn: () => call(`${BASE}/${resource}/${id}/recipients`),
      enabled: !!id,
      refetchInterval: 4000, // cheap fallback while a send is in flight; the socket handles the fast path
    });
  }

  function invalidateList(qc) {
    qc.invalidateQueries({ queryKey: ['marketingHub', entityKey, 'list'] });
  }

  function useCreate() {
    const { call } = useApi();
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (body) => call(`${BASE}/${resource}`, { method: 'POST', body }),
      onSuccess: () => invalidateList(qc),
    });
  }

  function useUpdate() {
    const { call } = useApi();
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, ...body }) => call(`${BASE}/${resource}/${id}`, { method: 'PUT', body }),
      onSuccess: (_data, vars) => {
        invalidateList(qc);
        qc.invalidateQueries({ queryKey: ['marketingHub', entityKey, vars.id] });
      },
    });
  }

  function useDelete() {
    const { call } = useApi();
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id) => call(`${BASE}/${resource}/${id}`, { method: 'DELETE' }),
      onSuccess: () => invalidateList(qc),
    });
  }

  function useSetStatus() {
    const { call } = useApi();
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, status }) => call(`${BASE}/${resource}/${id}/status`, { method: 'POST', body: { status } }),
      onSuccess: () => invalidateList(qc),
    });
  }

  // Resolves the audience against real contacts, enqueues the simulated
  // send. Same mutation the "Launch"/"Publish" button in each wizard calls.
  function usePublish() {
    const { call } = useApi();
    const qc = useQueryClient();
    return useMutation({
      mutationFn: (id) => call(`${BASE}/${resource}/${id}/publish`, { method: 'POST' }),
      onSuccess: () => invalidateList(qc),
    });
  }

  // Heuristic budget/audience/message suggestions off this campaign's own
  // real metrics — see campaignsRouter.js's POST /:id/optimize.
  function useOptimize() {
    const { call } = useApi();
    return useMutation({
      mutationFn: (id) => call(`${BASE}/${resource}/${id}/optimize`, { method: 'POST' }),
    });
  }

  return { useList, useOne, useRecipients, useCreate, useUpdate, useDelete, useSetStatus, usePublish, useOptimize };
}

const campaignHooks = buildEntityHooks('campaigns', 'campaigns');
const broadcastHooks = buildEntityHooks('broadcasts', 'broadcasts');

export const useCampaigns = campaignHooks.useList;
export const useCampaign = campaignHooks.useOne;
export const useCampaignRecipients = campaignHooks.useRecipients;
export const useCreateCampaign = campaignHooks.useCreate;
export const useUpdateCampaign = campaignHooks.useUpdate;
export const useDeleteCampaign = campaignHooks.useDelete;
export const useCampaignStatus = campaignHooks.useSetStatus;
export const usePublishCampaign = campaignHooks.usePublish;
export const useOptimizeCampaign = campaignHooks.useOptimize;

export const useBroadcasts = broadcastHooks.useList;
export const useBroadcast = broadcastHooks.useOne;
export const useBroadcastRecipients = broadcastHooks.useRecipients;
export const useCreateBroadcast = broadcastHooks.useCreate;
export const useUpdateBroadcast = broadcastHooks.useUpdate;
export const useDeleteBroadcast = broadcastHooks.useDelete;
export const usePublishBroadcast = broadcastHooks.usePublish;
export const useOptimizeBroadcast = broadcastHooks.useOptimize;

/* ─── Audiences ────────────────────────────────────────────────────────── */

export function useAudiences() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'audiences', 'list'],
    queryFn: () => call(`${BASE}/audiences`),
    placeholderData: (prev) => prev,
  });
}

export function useAudienceTagOptions() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'audiences', 'tag-options'],
    queryFn: () => call(`${BASE}/audiences/tag-options`), // [{ tag, contact_count }] straight from contact-service
  });
}

export function useCreateAudience() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/audiences`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'audiences', 'list'] }),
  });
}

export function useDeleteAudience() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/audiences/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'audiences', 'list'] }),
  });
}

// Real, derived count from contact-service — not a fabricated estimate.
export function useEstimateAudienceSize() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/audiences/${id}/estimate-size`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'audiences', 'list'] }),
  });
}

/* ─── Channels ─────────────────────────────────────────────────────────── */

// { whatsapp: {campaigns, broadcasts}, email: {...}, ... } — real aggregate
// counts grouped off mh_campaigns, replacing the client-side .filter() over
// mock arrays MHChannels.jsx used before this backend existed.
export function useChannelStats(days) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'channels', 'stats', days || 'all'],
    queryFn: () => call(`${BASE}/channels/stats${days ? `?days=${days}` : ''}`),
    placeholderData: (prev) => prev,
  });
}

/* ─── Settings: Sandbox Mode + real integration status ───────────────────
   Both hit routes/settings.js's already-existing generic category/key store
   and its /integrations/list endpoint — no backend changes needed. ─────── */

export function useSandboxSetting() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'settings', 'sandbox'],
    queryFn: () => call(`${BASE}/settings/sandbox`),
  });
}

export function useSetSandboxSetting() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value, description }) =>
      call(`${BASE}/settings/sandbox/${key}`, { method: 'PUT', body: { value, description, is_public: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'settings', 'sandbox'] }),
  });
}

// Real per-channel connection status from mh_integrations — replaces the
// hardcoded `connected: true/false` map MHSettings.jsx used to ship with.
export function useIntegrationsList() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'settings', 'integrations'],
    queryFn: () => call(`${BASE}/settings/integrations/list`),
  });
}

// Creates a real mh_integrations row (routes/settings.js POST /integrations,
// already implemented). Credentials aren't validated against the real
// provider here — there is no live API to validate against yet — so this
// marks the row 'active' in our own DB while actual sending on that channel
// still runs through the Sandbox providers until a provider file is
// swapped for a real one (see providers/*.js).
export function useConnectIntegration() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/settings/integrations`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'settings', 'integrations'] }),
  });
}

export function useDisconnectIntegration() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/settings/integrations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'settings', 'integrations'] }),
  });
}

// Generic version of the sandbox hooks above — any settings tab (General,
// Notifications, AI Config…) can read/write its own category this way
// against the same routes/settings.js generic category/key store, instead
// of each tab keeping its "Save" button as local-only useState.
export function useSettingsCategory(category) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'settings', category],
    queryFn: () => call(`${BASE}/settings/${category}`),
  });
}

export function useSaveSettingsCategory(category) {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // fields: { key: { value, description? } } — saves every key in one call.
    mutationFn: (fields) => Promise.all(
      Object.entries(fields).map(([key, { value, description }]) =>
        call(`${BASE}/settings/${category}/${key}`, { method: 'PUT', body: { value, description, is_public: true } })
      )
    ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'settings', category] }),
  });
}

/* ─── Marketing Calendar — routes/calendar.js. ─────────────────────────── */

export function useCalendarMonth(dateISO) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'calendar', 'month', dateISO],
    queryFn: () => call(`${BASE}/calendar/view/month?date=${encodeURIComponent(dateISO)}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/calendar/events`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'calendar'] }),
  });
}

export function useDeleteCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'calendar'] }),
  });
}

/* ─── Assets Library — routes/assets.js. Upload is a real multipart POST
   (see useApi().upload), not a mock file list. ────────────────────────── */

export function useAssets(filters = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'assets', 'list', filters],
    queryFn: () => call(`${BASE}/assets${qs(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useUploadAsset() {
  const { upload } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // formData must already contain 'file' plus optional name/type/tags.
    mutationFn: (formData) => upload(`${BASE}/assets`, formData),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'assets', 'list'] }),
  });
}

export function useDeleteAsset() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'assets', 'list'] }),
  });
}

export function useAssetStats() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'assets', 'stats'],
    queryFn: () => call(`${BASE}/assets/stats/overview`),
  });
}

/* ─── Knowledge Base — routes/knowledge.js. ─────────────────────────────── */

export function useKnowledgeArticles(filters = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'knowledge', 'list', filters],
    queryFn: () => call(`${BASE}/knowledge${qs(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateKnowledgeArticle() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/knowledge`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'knowledge', 'list'] }),
  });
}

export function useDeleteKnowledgeArticle() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'knowledge', 'list'] }),
  });
}

export function useMarkArticleHelpful() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/knowledge/${id}/helpful`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'knowledge', 'list'] }),
  });
}

export function useKnowledgeCategories() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'knowledge', 'categories'],
    queryFn: () => call(`${BASE}/knowledge/categories/list`),
  });
}

/* ─── Content Studio — routes/content.js. /generate is a real LLM call
   (services/llmClient.js, Groq/OpenAI-compatible), not a template. ────── */

export function useContentList(filters = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'content', 'list', filters],
    queryFn: () => call(`${BASE}/content${qs(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useGenerateContent() {
  const { call } = useApi();
  return useMutation({
    // { prompt, type, channel, tone, length } -> { content, metadata: { usedFallback, ... } }
    mutationFn: (body) => call(`${BASE}/content/generate`, { method: 'POST', body }),
  });
}

export function useCreateContent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/content`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'content', 'list'] }),
  });
}

/* ─── SEO — routes/seo.js. Keyword volume/difficulty/rank are simulated
   per-keyword (no real search-console/ahrefs-style API key exists), but
   the tracking, persistence, and audit history are real Postgres rows —
   same "DB-real, data-source-simulated" pattern as the delivery layer. ── */

export function useSeoKeywords(filters = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'seo', 'keywords', filters],
    queryFn: () => call(`${BASE}/seo/keywords${qs(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useAddSeoKeyword() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/seo/keywords`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'seo', 'keywords'] }),
  });
}

export function useDeleteSeoKeyword() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/seo/keywords/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'seo', 'keywords'] }),
  });
}

export function useSeoAudits(filters = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'seo', 'audits', filters],
    queryFn: () => call(`${BASE}/seo/audits${qs(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useRunSeoAudit() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/seo/audits`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'seo', 'audits'] }),
  });
}

export function useSeoInsights() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'seo', 'insights'],
    queryFn: () => call(`${BASE}/seo/insights`),
  });
}

/* ─── AEO (Answer Engine Optimization) — routes/aeo.js. Same simulated-
   scoring-engine, real-persistence pattern as SEO above. ───────────────── */

export function useAeoList(filters = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'aeo', 'list', filters],
    queryFn: () => call(`${BASE}/aeo${qs(filters)}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateAeoOptimization() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/aeo`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'aeo', 'list'] }),
  });
}

export function useDeleteAeoOptimization() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/aeo/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'aeo', 'list'] }),
  });
}

export function useAeoOverview() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'aeo', 'overview'],
    queryFn: () => call(`${BASE}/aeo/insights/overview`),
  });
}

/* ─── Competitor Analysis — routes/competitors.js. ─────────────────────── */

export function useCompetitors() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'competitors', 'list'],
    queryFn: () => call(`${BASE}/competitors`),
    placeholderData: (prev) => prev,
  });
}

export function useAddCompetitor() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/competitors`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'competitors', 'list'] }),
  });
}

export function useDeleteCompetitor() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/competitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketingHub', 'competitors', 'list'] }),
  });
}

export function useCompetitorAnalyses(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'competitors', id, 'analysis'],
    queryFn: () => call(`${BASE}/competitors/${id}/analysis`),
    enabled: !!id,
  });
}

export function useRunCompetitorAnalysis() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/competitors/${id}/analysis`, { method: 'POST', body }),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['marketingHub', 'competitors', vars.id, 'analysis'] }),
  });
}

export function useCompetitorsOverview() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'competitors', 'overview'],
    queryFn: () => call(`${BASE}/competitors/overview/dashboard`),
  });
}
