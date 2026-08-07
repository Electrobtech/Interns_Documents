'use client';
/**
 * Broadcasts, Content, Templates, SEO, AEO, Competitors, Calendar, Reports,
 * Assets — all against the real backend at /ai-agents/marketing/*.
 *
 * Same shape as campaigns.js: one hook per endpoint, mutations invalidate
 * their own key only. Enum lists mirror app/models/marketing.py so a value
 * the DB CHECK constraint would reject can't be selected in the UI.
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

/* ─── Dashboard ───────────────────────────────────────────────────────────── */

/** One request for the whole Marketing Hub dashboard.
 *
 *  Replaces the previous client-side composition (useBroadcasts + useContent +
 *  useReports), which meant three round trips before the first KPI rendered
 *  and made the dashboard's numbers depend on which other tabs had been
 *  visited and cached. */
export function useMarketingDashboard() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'dashboard'],
    queryFn: () => call(`${BASE}/dashboard`),
  });
}

/* ─── Broadcasts ──────────────────────────────────────────────────────────── */

export function useBroadcasts(filters = {}) {
  const { call } = useApi();
  const { status, channel, search } = filters;
  return useQuery({
    queryKey: ['marketing', 'broadcasts', filters],
    queryFn: () => call(`${BASE}/broadcasts${qs({ status, channel, search })}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/broadcasts`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'broadcasts'] }),
  });
}

export function useUpdateBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/broadcasts/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'broadcasts'] }),
  });
}

export function useDeleteBroadcast() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/broadcasts/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'broadcasts'] }),
  });
}

/** Persists the anti_ban verdict. The server refuses to move a broadcast to
 *  `sending` until this has been posted and is not high/critical. */
/** Per-destination send trail. Same response shape as the Campaigns
 *  equivalent, so both render with one component. */
export function useBroadcastRecipients(id, filters = {}) {
  const { call } = useApi();
  const { status, search, page = 1, limit = 50 } = filters;
  return useQuery({
    queryKey: ['marketing', 'broadcasts', id, 'recipients', filters],
    queryFn: () => call(`${BASE}/broadcasts/${id}/recipients${qs({ status, search, page, limit })}`),
    enabled: !!id,
    placeholderData: (prev) => prev,
  });
}

export function useBroadcastPolicyCheck() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, risk_level, risk_score, flags }) =>
      call(`${BASE}/broadcasts/${id}/policy-check`, {
        method: 'POST',
        body: { risk_level, risk_score, flags: flags || [] },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'broadcasts'] }),
  });
}

export function useBroadcastStatus() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to_status }) =>
      call(`${BASE}/broadcasts/${id}/status`, { method: 'POST', body: { to_status } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'broadcasts'] }),
  });
}

/* ─── Content ─────────────────────────────────────────────────────────────── */

export function useContent(filters = {}) {
  const { call } = useApi();
  const { content_type, search } = filters;
  return useQuery({
    queryKey: ['marketing', 'content', filters],
    queryFn: () => call(`${BASE}/content${qs({ content_type, search })}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateContent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/content`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'content'] }),
  });
}

export function useUpdateContent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/content/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'content'] }),
  });
}

export function useDeleteContent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/content/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'content'] }),
  });
}

/* ─── Templates ───────────────────────────────────────────────────────────── */

/** Read-only snapshots of prior versions. `version` on the document was being
 *  incremented with nowhere to look up what a prior version said. */
export function useContentVersions(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'content', id, 'versions'],
    queryFn: () => call(`${BASE}/content/${id}/versions`),
    enabled: !!id,
  });
}

/** Routes publication through the governance engine. `content.publish` is on
 *  the auto-approval denylist, so this always lands in a human's queue. */
export function useSubmitContent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, summary }) =>
      call(`${BASE}/content/${id}/submit`, { method: 'POST', body: { summary } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['marketing', 'content'] });
      qc.invalidateQueries({ queryKey: ['aiAgents', 'approvals'] });
      qc.invalidateQueries({ queryKey: ['marketing', 'dashboard'] });
    },
  });
}

export function useTemplate(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'templates', id],
    queryFn: () => call(`${BASE}/templates/${id}`),
    enabled: !!id,
  });
}

export function useUpdateTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/templates/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'templates'] }),
  });
}

export function useTemplates(filters = {}) {
  const { call } = useApi();
  const { template_type, channel, search } = filters;
  return useQuery({
    queryKey: ['marketing', 'templates', filters],
    queryFn: () => call(`${BASE}/templates${qs({ template_type, channel, search })}`),
    placeholderData: (prev) => prev,
  });
}

export function useCreateTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/templates`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'templates'] }),
  });
}

export function useDeleteTemplate() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'templates'] }),
  });
}

/* ─── SEO ─────────────────────────────────────────────────────────────────── */

export function useSeoProjects() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'seo', 'projects'],
    queryFn: () => call(`${BASE}/seo/projects`),
  });
}

export function useCreateSeoProject() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/seo/projects`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'seo'] }),
  });
}

export function useSeoKeywords(projectId) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'seo', 'keywords', projectId],
    queryFn: () => call(`${BASE}/seo/projects/${projectId}/keywords`),
    enabled: !!projectId,
  });
}

export function useAddSeoKeyword() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, ...body }) =>
      call(`${BASE}/seo/projects/${projectId}/keywords`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'seo'] }),
  });
}

/** Project plus its keywords in one request — backs the detail view. */
export function useSeoProject(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'seo', 'projects', id],
    queryFn: () => call(`${BASE}/seo/projects/${id}`),
    enabled: !!id,
  });
}

export function useUpdateSeoProject() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/seo/projects/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'seo'] }),
  });
}

export function useUpdateSeoKeyword() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, keywordId, ...body }) =>
      call(`${BASE}/seo/projects/${projectId}/keywords/${keywordId}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'seo'] }),
  });
}

export function useDeleteSeoKeyword() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, keywordId }) =>
      call(`${BASE}/seo/projects/${projectId}/keywords/${keywordId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'seo'] }),
  });
}

/** Where a number came from. `ai_inferred` is a model guess, `manual` a human
 *  reading, `search_console` a measurement — the badge has to distinguish
 *  them or the columns full of nulls become meaningless. */
export const DATA_SOURCES = {
  ai_inferred: { label: 'AI inferred', tone: 'violet' },
  manual: { label: 'Manual', tone: 'blue' },
  search_console: { label: 'Measured', tone: 'green' },
};

/* ─── AEO ─────────────────────────────────────────────────────────────────── */

export function useAeoProjects() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'aeo', 'projects'],
    queryFn: () => call(`${BASE}/aeo/projects`),
  });
}

export function useCreateAeoProject() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/aeo/projects`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'aeo'] }),
  });
}

export function useDeleteAeoProject() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/aeo/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'aeo'] }),
  });
}

/* ─── Competitors ─────────────────────────────────────────────────────────── */

export function useAeoProject(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'aeo', 'projects', id],
    queryFn: () => call(`${BASE}/aeo/projects/${id}`),
    enabled: !!id,
  });
}

export function useUpdateAeoProject() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/aeo/projects/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'aeo'] }),
  });
}

export function useCompetitors() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'competitors'],
    queryFn: () => call(`${BASE}/competitors`),
  });
}

export function useCreateCompetitor() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/competitors`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }),
  });
}

export function useCompetitorSnapshots(competitorId) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'competitors', competitorId, 'snapshots'],
    queryFn: () => call(`${BASE}/competitors/${competitorId}/snapshots`),
    enabled: !!competitorId,
  });
}

export function useAddCompetitorSnapshot() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competitorId, ...body }) =>
      call(`${BASE}/competitors/${competitorId}/snapshots`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }),
  });
}

/** Competitor plus its most recent snapshot — backs the detail view and the
 *  side-by-side comparison, which composes several of these client-side. */
export function useCompetitor(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'competitors', id],
    queryFn: () => call(`${BASE}/competitors/${id}`),
    enabled: !!id,
  });
}

export function useUpdateCompetitor() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/competitors/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }),
  });
}

export function useDeleteCompetitor() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/competitors/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }),
  });
}

export function useDeleteSnapshot() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ competitorId, snapshotId }) =>
      call(`${BASE}/competitors/${competitorId}/snapshots/${snapshotId}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'competitors'] }),
  });
}

/* ─── Calendar ────────────────────────────────────────────────────────────── */

export function useCalendarEvents({ start, end } = {}) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'calendar', start || '', end || ''],
    queryFn: () => call(`${BASE}/calendar/events${qs({ start, end })}`),
  });
}

export function useCreateCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/calendar/events`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'calendar'] }),
  });
}

export function useUpdateCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`${BASE}/calendar/events/${id}`, { method: 'PUT', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'calendar'] }),
  });
}

export function useDeleteCalendarEvent() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/calendar/events/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'calendar'] }),
  });
}

/* ─── Reports ─────────────────────────────────────────────────────────────── */

export function useReports(report_type) {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'reports', report_type || ''],
    queryFn: () => call(`${BASE}/reports${qs({ report_type })}`),
  });
}

export function useGenerateReport() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/reports/generate`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'reports'] }),
  });
}

export function useDeleteReport() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/reports/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'reports'] }),
  });
}

/* ─── Assets ──────────────────────────────────────────────────────────────── */

export function useAssets(filters = {}) {
  const { call } = useApi();
  const { folder_id, asset_type, search } = filters;
  return useQuery({
    queryKey: ['marketing', 'assets', filters],
    queryFn: () => call(`${BASE}/assets${qs({ folder_id, asset_type, search })}`),
    placeholderData: (prev) => prev,
  });
}

export function useAssetFolders() {
  const { call } = useApi();
  return useQuery({
    queryKey: ['marketing', 'assets', 'folders'],
    queryFn: () => call(`${BASE}/assets/folders`),
  });
}

export function useCreateAssetFolder() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call(`${BASE}/assets/folders`, { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
  });
}

export function useUploadAsset() {
  const { upload } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, folder_id, name }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (folder_id) fd.append('folder_id', folder_id);
      if (name) fd.append('name', name);
      return upload(`${BASE}/assets`, fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
  });
}

export function useDeleteAsset() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`${BASE}/assets/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing', 'assets'] }),
  });
}

/* ─── Enums (mirror app/models/marketing.py) ──────────────────────────────── */

export const BROADCAST_CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'messenger', label: 'Messenger' },
];

export const BROADCAST_STATUSES = [
  { value: 'draft', label: 'Draft', tone: 'slate' },
  { value: 'scheduled', label: 'Scheduled', tone: 'amber' },
  { value: 'sending', label: 'Sending', tone: 'blue' },
  { value: 'sent', label: 'Sent', tone: 'green' },
  { value: 'paused', label: 'Paused', tone: 'amber' },
  { value: 'cancelled', label: 'Cancelled', tone: 'slate' },
  { value: 'failed', label: 'Failed', tone: 'red' },
];

// Mirrors BROADCAST_TRANSITIONS server-side — used only to grey out illegal
// buttons; the server re-checks every call.
export const NEXT_BROADCAST_STATUSES = {
  draft: ['scheduled', 'sending', 'cancelled'],
  scheduled: ['sending', 'cancelled', 'draft'],
  sending: ['sent', 'failed', 'paused'],
  paused: ['sending', 'cancelled'],
  sent: [],
  failed: ['draft'],
  cancelled: [],
};

export const CONTENT_TYPES = [
  { value: 'ad_copy', label: 'Ad Copy' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'sms', label: 'SMS' },
  { value: 'social_post', label: 'Social Post' },
  { value: 'blog', label: 'Blog' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'product_description', label: 'Product Description' },
  { value: 'seo_meta', label: 'SEO Meta' },
];

export const ASSET_TYPES = [
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Videos' },
  { value: 'pdf', label: 'PDFs' },
  { value: 'audio', label: 'Audio' },
  { value: 'document', label: 'Documents' },
  { value: 'icon', label: 'Icons' },
  { value: 'logo', label: 'Logos' },
];

export const EVENT_TYPES = [
  { value: 'campaign_launch', label: 'Campaign Launch', tone: 'violet' },
  { value: 'broadcast', label: 'Broadcast', tone: 'blue' },
  { value: 'meeting', label: 'Meeting', tone: 'slate' },
  { value: 'webinar', label: 'Webinar', tone: 'green' },
  { value: 'reminder', label: 'Reminder', tone: 'amber' },
  { value: 'holiday', label: 'Holiday', tone: 'red' },
  { value: 'content', label: 'Content', tone: 'violet' },
];

export const REPORT_TYPES = [
  { value: 'campaign_performance', label: 'Campaign Performance' },
  { value: 'monthly_summary', label: 'Monthly Summary' },
  { value: 'roi_analysis', label: 'ROI Analysis' },
  { value: 'lead_report', label: 'Lead Report' },
  { value: 'executive_summary', label: 'Executive Summary' },
  { value: 'seo', label: 'SEO Report' },
  { value: 'aeo', label: 'AEO Report' },
  { value: 'competitor', label: 'Competitor Report' },
];

export const KEYWORD_INTENTS = [
  { value: 'informational', label: 'Informational' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'navigational', label: 'Navigational' },
];
