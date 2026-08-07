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

/* ─── Content Studio (AI Generation) ─────────────────────────────────────── */

export function useGenerateContent() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/content/generate`, { method: 'POST', body }),
  });
}

/* ─── AI Dashboard Suggestions ───────────────────────────────────────────── */

export function useAISuggestions() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (context) => call('/ai-agents/marketing/dashboard-suggestions', { method: 'POST', body: context }),
  });
}

/* ─── Channels ─────────────────────────────────────────────────────────── */

// { whatsapp: {campaigns, broadcasts}, email: {...}, ... } — real aggregate
// counts grouped off mh_campaigns, replacing the client-side .filter() over
// mock arrays MHChannels.jsx used before this backend existed.
export function useChannelStats() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketingHub', 'channels', 'stats'],
    queryFn: () => call(`${BASE}/channels/stats`),
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
