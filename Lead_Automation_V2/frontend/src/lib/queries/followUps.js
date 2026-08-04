'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Hooks for the Follow-ups feature — services/contact-service/src/followUpRoutes.js.
// Rows are created either by hand here (or from a Contact/Lead row's "Add
// Follow-up" action) or automatically by the Automation Builder's Handoff
// node (see FlowBuilder.jsx + services/automation-service/src/repositories/followUpRepository.js).

// GET /follow-ups?bucket=overdue|today|upcoming|all
export function useFollowUps(bucket = 'all') {
  const { call } = useApi();
  return useQuery({
    queryKey: ['follow-ups', bucket],
    queryFn: () => call(`/follow-ups?bucket=${encodeURIComponent(bucket)}`),
    refetchInterval: 30_000, // due_at-relative buckets drift on their own; keep them fresh without a manual refresh
  });
}

// GET /follow-ups/counts — tab badge counts for the Follow-ups page.
export function useFollowUpCounts() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['follow-ups', 'counts'],
    queryFn: () => call('/follow-ups/counts'),
    refetchInterval: 30_000,
  });
}

// GET /follow-ups?contact_id=X — every follow-up for one contact/lead, used
// by the Contacts & Leads row action's "existing follow-ups" list.
export function useContactFollowUps(contactId) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['follow-ups', 'contact', contactId],
    queryFn: () => call(`/follow-ups?bucket=all&contact_id=${encodeURIComponent(contactId)}`),
    enabled: !!contactId,
  });
}

function invalidateAll(qc) {
  qc.invalidateQueries({ queryKey: ['follow-ups'] });
}

// POST /follow-ups — body: { contact_id, lead_id?, due_at, priority?, disposition?, assigned_to?, notes? }
export function useCreateFollowUp() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/follow-ups', { method: 'POST', body }),
    onSuccess: () => invalidateAll(qc),
  });
}

// PUT /follow-ups/:id — body: any subset of { due_at, status, priority, disposition, assigned_to, notes }
export function useUpdateFollowUp() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/follow-ups/${id}`, { method: 'PUT', body }),
    onSuccess: () => invalidateAll(qc),
  });
}

// DELETE /follow-ups/:id
export function useDeleteFollowUp() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/follow-ups/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateAll(qc),
  });
}

// GET /users — team-service's roster, used for the "Assigned Agent" select
// in the Add Follow-up form. Not follow-ups-specific, but small enough
// (and only used here so far) that it lives alongside these hooks rather
// than starting a whole new queries/team.js file.
export function useTeamMembers() {
  const { call } = useApi();
  return useQuery({ queryKey: ['users'], queryFn: () => call('/users') });
}
