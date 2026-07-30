'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Hooks for services/calendar-service — Google Calendar connect/status,
// booking meetings against leads, freebusy checks for date pickers, and
// listing events (used by campaigns scheduling + the automation flow
// builder's "delay" node in "specific date" mode).

// GET /calendar/auth/status — { connected, email, lastError }
export function useCalendarStatus() {
  const { call } = useApi();
  return useQuery({ queryKey: ['calendar', 'status'], queryFn: () => call('/calendar/auth/status') });
}

// GET /calendar/auth/connect-url — { url } to redirect the browser to
export function useCalendarConnectUrl() {
  const { call } = useApi();
  return useMutation({ mutationFn: () => call('/calendar/auth/connect-url') });
}

// POST /calendar/auth/disconnect
export function useDisconnectCalendar() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => call('/calendar/auth/disconnect', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'status'] }),
  });
}

// GET /calendar/events/freebusy?start=ISO&end=ISO — { busy: [{start,end}] }
// Not a useQuery hook (called on-demand as the user changes the picked
// date, not on mount) — same shape as a mutation for that reason.
export function useCheckFreeBusy() {
  const { call } = useApi();
  return useMutation({
    mutationFn: ({ start, end }) => call(`/calendar/events/freebusy?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`),
  });
}

// GET /calendar/events?start=ISO&end=ISO
export function useCalendarEvents(range = {}) {
  const { call } = useApi();
  const qs = new URLSearchParams();
  if (range.start) qs.set('start', range.start);
  if (range.end) qs.set('end', range.end);
  const query = qs.toString();
  return useQuery({
    queryKey: ['calendar', 'events', range.start || null, range.end || null],
    queryFn: () => call(`/calendar/events${query ? `?${query}` : ''}`),
  });
}

// POST /calendar/events — body: { title, description?, startISO, endISO,
//   attendeeEmails?, location?, contactId?, campaignId?, automationNodeId? }
export function useCreateCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/calendar/events', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] }),
  });
}

// PATCH /calendar/events/:id
export function useUpdateCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/calendar/events/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] }),
  });
}

// DELETE /calendar/events/:id
export function useCancelCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar', 'events'] }),
  });
}
