'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Real platform CRM data, reused by the agent dashboards — one source of
// truth, no mocked metrics.

// GET /leads — { id, contact_id, name, stage, priority, score, created_at }
// GET /leads?created_after=ISO&created_before=ISO — day/week-scoped, used
// by the Support Agent's Daily Report tab. Omitting `range` keeps the
// original unfiltered call (and its query key) exactly as before.
export function useLeads(range) {
  const { call } = useApi();
  const qs = new URLSearchParams();
  if (range?.created_after) qs.set('created_after', range.created_after);
  if (range?.created_before) qs.set('created_before', range.created_before);
  const query = qs.toString();
  return useQuery({
    queryKey: ['leads', 'list', range?.created_after || null, range?.created_before || null],
    queryFn: () => call(`/leads${query ? `?${query}` : ''}`),
  });
}

// GET /leads/fields — real numeric leads.* columns a dashboard could
// aggregate into a dollar figure, e.g. [{ key: 'deal_value', label: 'Deal
// Value', type: 'numeric' }, ...]. Backs the Sales Agent's "Configure Deal
// Field" modal so it only ever offers fields that actually exist.
export function useLeadFields() {
  const { call } = useApi();
  return useQuery({ queryKey: ['leads', 'fields'], queryFn: () => call('/leads/fields'), staleTime: 5 * 60_000 });
}

// PUT /leads/:id — partial update (score / stage / deal_value). COALESCE
// server-side, so sending just { deal_value } leaves score/stage untouched.
export function useUpdateLead() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/leads/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'list'] }),
  });
}

// GET /contacts — { id, name, email, phone, source, tags, ... }
export function useContacts() {
  const { call } = useApi();
  return useQuery({ queryKey: ['contacts', 'list'], queryFn: () => call('/contacts') });
}

// GET /campaigns — { id, name, type, channel_type, status, scheduled_at, ... }
export function useCampaigns() {
  const { call } = useApi();
  return useQuery({ queryKey: ['campaigns', 'list'], queryFn: () => call('/campaigns') });
}

// GET /conversations — { id, channel_type, status, contact_name,
//   last_message_preview, inbound_count, last_message_at, ... }
// Capped at 100 rows server-side (most-recent-first), so a busy channel
// (e.g. a flood of promotional email) can crowd quieter channels out of
// the page entirely. Pass `channel` to filter server-side instead of
// fetching the capped "all channels" page and filtering it client-side —
// the latter can silently show zero results for a channel that has real
// conversations, just none in the last 100.
export function useConversations(channel) {
  const { call } = useApi();
  const qs = channel ? `?channel=${encodeURIComponent(channel)}` : '';
  return useQuery({
    queryKey: ['conversations', 'list', channel || 'all'],
    queryFn: () => call(`/conversations${qs}`),
    refetchInterval: 20_000,
  });
}

// GET /conversations/channel-counts — { byChannel: { whatsapp: 12, ... },
// total }. Uncapped true totals per channel — use this for filter-chip
// badges, not `.length` on a possibly-capped /conversations page.
export function useConversationChannelCounts() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['conversations', 'channel-counts'],
    queryFn: () => call('/conversations/channel-counts'),
    refetchInterval: 20_000,
  });
}

// POST /campaigns — create a new campaign
export function useCreateCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/campaigns', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', 'list'] }),
  });
}

// DELETE /campaigns/:id
export function useDeleteCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/campaigns/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', 'list'] }),
  });
}

// PUT /campaigns/:id — partial update (e.g. status: 'needs_approval' to
// submit a draft for review).
export function useUpdateCampaign() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/campaigns/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', 'list'] }),
  });
}

// POST /campaigns/:id/decision — { decision: 'approved'|'rejected', note? }
export function useCampaignDecision() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/campaigns/${id}/decision`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns', 'list'] }),
  });
}

// GET /campaigns/:id/recipients — per-recipient send status, powers the
// Campaigns page's DetailsModal (frontend/src/app/app/campaigns/page.jsx).
export function useCampaignRecipients(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['campaigns', id, 'recipients'],
    queryFn: () => call(`/campaigns/${id}/recipients`),
    enabled: !!id,
  });
}

// POST /leads — { name, company?, email?, phone?, score?, priority?, stage?, source? }
export function useCreateLead() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/leads', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'list'] }),
  });
}

// PUT /conversations/:id/handled-by — { handled_by: 'bot'|'human' }. One-click
// human takeover: flips who owns replying on a thread (see the Recent
// Conversations table on the main dashboard and inbox-service's route).
export function useSetHandledBy() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, handled_by }) => call(`/conversations/${id}/handled-by`, { method: 'PUT', body: { handled_by } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', 'list'] }),
  });
}

// GET /conversations/:id — conversation + messages + the contact/lead columns
// the Unified Inbox context rail needs (see services/inbox-service).
export function useConversation(conversationId) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['conversations', 'detail', conversationId],
    queryFn: () => call(`/conversations/${conversationId}`),
    enabled: !!conversationId,
    refetchInterval: 15_000,
  });
}

// POST /conversations/:id/reply — { content } — used by "Send via Unified
// Inbox" actions on AI-drafted follow-ups/replies.
export function useSendReply() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    // inbox-service reads req.body.body — sending { content } inserted a NULL
    // message body. Accepts either name from callers and normalises here.
    mutationFn: ({ conversationId, body, content }) =>
      call(`/conversations/${conversationId}/reply`, { method: 'POST', body: { body: body ?? content } }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['conversations', 'list'] });
      qc.invalidateQueries({ queryKey: ['conversations', 'detail', vars.conversationId] });
    },
  });
}

// GET /conversations?q=name — best-effort lookup so agent workspaces without
// a directly-selected ticket can still find a matching conversation to reply on.
export function useFindConversationByName() {
  const { call } = useApi();
  return useMutation({
    mutationFn: async (name) => {
      const rows = await call(`/conversations?q=${encodeURIComponent(name)}&limit=1`);
      return Array.isArray(rows) && rows.length ? rows[0] : null;
    },
  });
}

// POST /contacts/bulk-tag — { source, tag } — tags every contact with a
// given real `source` value. Used by the Marketing Agent's "Apply Segment
// Tags" action.
export function useBulkTagContacts() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/contacts/bulk-tag', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['contacts', 'list'] }),
  });
}

// GET /reviews — { id, source, author, rating, body, reply, created_at }
export function useReviews() {
  const { call } = useApi();
  return useQuery({ queryKey: ['reviews', 'list'], queryFn: () => call('/reviews') });
}

// PUT /reviews/:id — { reply } — used by the Marketing Agent's "Post Reply" action.
export function usePostReviewReply() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reply }) => call(`/reviews/${id}`, { method: 'PUT', body: { reply } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reviews', 'list'] }),
  });
}

// ─── Contact import (CSV / XLSX) ─────────────────────────────────────────
// Two-step so the user confirms a column mapping before anything is written:
// preview writes nothing, import commits. Both post multipart to
// contact-service via apiUpload (fetch, not JSON) — see services/
// contact-service/src/importRoutes.js.

function importFormData(file, opts = {}) {
  const fd = new FormData();
  fd.append('file', file);
  if (opts.sheetName) fd.append('sheetName', opts.sheetName);
  if (opts.mapping) fd.append('mapping', JSON.stringify(opts.mapping));
  if (opts.defaultSource) fd.append('defaultSource', opts.defaultSource);
  if (opts.onDuplicate) fd.append('onDuplicate', opts.onDuplicate);
  if (opts.unmappedToNotes === false) fd.append('unmappedToNotes', 'false');
  if (opts.tagWithSheetName === false) fd.append('tagWithSheetName', 'false');
  return fd;
}

// POST /contacts/import/preview — dry run: sheets, detected mapping, stats
export function usePreviewContactImport() {
  const { upload } = useApi();
  return useMutation({
    mutationFn: ({ file, ...opts }) => upload('/contacts/import/preview', importFormData(file, opts)),
  });
}

// POST /contacts/import — commits the rows
export function useRunContactImport() {
  const { upload } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, ...opts }) => upload('/contacts/import', importFormData(file, opts)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}