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
