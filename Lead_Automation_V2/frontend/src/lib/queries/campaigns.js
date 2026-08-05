'use client';
/**
 * Campaigns + Audiences — the real backend at /ai-agents/marketing/*.
 *
 * Mounted under /ai-agents/marketing rather than the bare /campaigns the
 * gateway already routes to Node's campaign-service, so this never collides
 * with that path even though campaign-service isn't currently functional.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

const BASE = '/ai-agents/marketing';

function qs(params) {
  const p = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (Array.isArray(v)) v.forEach((item) => p.append(k, item));
    else p.append(k, v);
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

/* ─── Campaigns ───────────────────────────────────────────────────────────── */

export function useCampaigns(filters = {}) {
  const { call } = useApi();
  const { status, objective, platform, search, page = 1, limit = 50, sort = '-created_at' } = filters;
  return useQuery({
    queryKey: ['marketing', 'campaigns', filters],
    queryFn: () =>
      call(`${BASE}/campaigns${qs({ status, objective, platform, search, page, limit, sort })}`),
    placeholderData: (prev) => prev,
  });
}

export function useCampaign(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'campaigns', id],
    queryFn: () => call(`${BASE}/campaigns/${id}`),
    enabled: !!id,
  });
}

export function useCampaignHistory(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'campaigns', id, 'history'],
    queryFn: () => call(`${BASE}/campaigns/${id}/history`),
    enabled: !!id,
  });
}

function invalidateCampaigns(qc) {
  qc.invalidateQueries({ queryKey: ['marketing', 'campaigns'] });
}

export function useCreateCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/campaigns`, { method: 'POST', body }),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useUpdateCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/campaigns/${id}`, { method: 'PUT', body }),
    onSuccess: (_, vars) => {
      invalidateCampaigns(qc);
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns', vars.id] });
    },
  });
}

export function useDeleteCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

export function useDuplicateCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/campaigns/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => invalidateCampaigns(qc),
  });
}

/**
 * Backs Pause/Resume/Archive/Publish. The backend enforces
 * CAMPAIGN_TRANSITIONS server-side — an illegal move (e.g. draft -> running)
 * returns 409 with the legal next states, which the caller can surface.
 */
export function useCampaignStatus() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to_status, reason }) =>
      call(`${BASE}/campaigns/${id}/status`, { method: 'POST', body: { to_status, reason } }),
    onSuccess: (_, vars) => {
      invalidateCampaigns(qc);
      qc.invalidateQueries({ queryKey: ['marketing', 'campaigns', vars.id] });
    },
  });
}

/* ─── Audiences (for the wizard's audience step) ─────────────────────────── */

export function useAudiences(search) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'audiences', search || ''],
    queryFn: () => call(`${BASE}/audiences${qs({ search })}`),
  });
}

export function useCreateAudience() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/audiences`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'audiences'] }),
  });
}

/* ─── Enums (mirror app/models/marketing.py so the UI never drifts from the
   DB CHECK constraints — a value picked here that Postgres would reject
   cannot be selected in the first place) ─────────────────────────────────── */

export const OBJECTIVES = [
  { value: 'lead_generation', label: 'Lead Generation', icon: '👤', blurb: 'Collect leads for your business', bestFor: 'Website, Instant Forms' },
  { value: 'website_traffic', label: 'Website Traffic', icon: '🌐', blurb: 'Drive traffic to your website', bestFor: 'Blog posts, Content marketing' },
  { value: 'sales', label: 'Sales', icon: '🛒', blurb: 'Generate sales or conversions', bestFor: 'E-commerce, Product sales' },
  { value: 'engagement', label: 'Engagement', icon: '💬', blurb: 'Grow likes, comments, and shares', bestFor: 'Community building' },
  { value: 'awareness', label: 'Awareness', icon: '📣', blurb: 'Maximize reach for your brand', bestFor: 'New product launches' },
  { value: 'event_registration', label: 'Event Registration', icon: '🎟️', blurb: 'Drive signups for an event', bestFor: 'Conferences, meetups' },
  { value: 'webinar', label: 'Webinar', icon: '🎥', blurb: 'Fill seats for a webinar', bestFor: 'Product demos, education' },
  { value: 'remarketing', label: 'Remarketing', icon: '🔁', blurb: 'Re-engage people who already know you', bestFor: 'Cart abandoners, past visitors' },
  { value: 'conversion', label: 'Conversion', icon: '🎯', blurb: 'Optimize for a specific on-site action', bestFor: 'Sign-ups, purchases' },
];

export const PLATFORMS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'messenger', label: 'Messenger' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'web_push', label: 'Web Push' },
];

export const BID_STRATEGIES = [
  { value: 'highest_volume', label: 'Highest Volume', blurb: 'Get the most results for your budget' },
  { value: 'lowest_cost', label: 'Lowest Cost', blurb: 'Minimize cost per result' },
  { value: 'target_cost', label: 'Target Cost', blurb: 'Hold cost per result near a target' },
  { value: 'cost_cap', label: 'Cost Cap', blurb: 'Never exceed a maximum cost per result' },
];

export const STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'slate' },
  { value: 'pending_review', label: 'Pending Review', tone: 'amber' },
  { value: 'approved', label: 'Approved', tone: 'blue' },
  { value: 'scheduled', label: 'Scheduled', tone: 'amber' },
  { value: 'running', label: 'Running', tone: 'green' },
  { value: 'paused', label: 'Paused', tone: 'amber' },
  { value: 'completed', label: 'Completed', tone: 'blue' },
  { value: 'archived', label: 'Archived', tone: 'slate' },
];

// Legal transitions — mirrors CAMPAIGN_TRANSITIONS server-side. Kept in sync
// here only to grey out illegal buttons before the request round-trip; the
// server is still the source of truth and re-checks on every call.
export const NEXT_STATUSES = {
  draft: ['pending_review', 'archived'],
  pending_review: ['approved', 'draft', 'archived'],
  approved: ['scheduled', 'running', 'draft', 'archived'],
  scheduled: ['running', 'paused', 'draft', 'archived'],
  running: ['paused', 'completed', 'archived'],
  paused: ['running', 'completed', 'archived'],
  completed: ['archived'],
  archived: [],
};
