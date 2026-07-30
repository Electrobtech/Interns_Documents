'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Real platform CRM data, reused by the agent dashboards — one source of
// truth, no mocked metrics.

// GET /leads — { id, contact_id, name, stage, priority, score, created_at }
export function useLeads() {
  const { call } = useApi();
  return useQuery({ queryKey: ['leads', 'list'], queryFn: () => call('/leads') });
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
export function useConversations() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['conversations', 'list'],
    queryFn: () => call('/conversations'),
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

// POST /leads — { name, company?, email?, phone?, score?, priority?, stage?, source? }
export function useCreateLead() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/leads', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads', 'list'] }),
  });
}

// POST /conversations/:id/reply — { content } — used by "Send via Unified
// Inbox" actions on AI-drafted follow-ups/replies.
export function useSendReply() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ conversationId, content }) =>
      call(`/conversations/${conversationId}/reply`, { method: 'POST', body: { content } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', 'list'] }),
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
