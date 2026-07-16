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
