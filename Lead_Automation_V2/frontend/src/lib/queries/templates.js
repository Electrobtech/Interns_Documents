'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Message Templates — owned by campaign-service
// (services/campaign-service/src/templates.js), routed at /templates.
// Feeds both the Template Dashboard (frontend/src/app/app/campaigns/templates)
// and the Bulk Campaign builder's "Use a saved template" picker.

export function useTemplates({ channel, status, search } = {}) {
  const { call } = useApi();
  const params = new URLSearchParams();
  if (channel) params.set('channel', channel);
  if (status) params.set('status', status);
  if (search) params.set('search', search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['templates', 'list', channel || 'all', status || 'all', search || ''],
    queryFn: () => call(`/templates${qs ? `?${qs}` : ''}`),
  });
}

// Convenience wrapper for the Bulk Campaign builder — only ever wants
// APPROVED templates for a given channel, per the module's own
// GET /templates?channel=WHATSAPP&status=APPROVED contract.
export function useTemplatesForCampaign(channel) {
  return useTemplates({ channel, status: 'APPROVED' });
}

export function useTemplate(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['templates', 'detail', id],
    queryFn: () => call(`/templates/${id}`),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/templates', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useUpdateTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/templates/${id}`, { method: 'PATCH', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useTemplateDecision() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, decision }) => call(`/templates/${id}/decision`, { method: 'POST', body: { decision } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useCloneTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/templates/${id}/clone`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

export function useDeleteTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['templates'] }),
  });
}

// Header image dropzone in the Template Creator. Returns { url, filename,
// sizeBytes, mimeType } from POST /templates/media/upload.
export function useUploadTemplateMedia() {
  const { upload } = useApi();
  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append('file', file);
      return upload('/templates/media/upload', fd);
    },
  });
}
