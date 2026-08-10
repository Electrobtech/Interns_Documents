'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Support Agent "Import" tab — saved, editable spreadsheets. Unlike
// sheets.js's one-shot "paste a link, map, import" flow, a spreadsheet
// created here is persisted (upload or Google Sheets link) so it can be
// opened, edited cell-by-cell, saved, and imported into contacts/leads
// whenever ready. See services/contact-service/src/spreadsheetsRoutes.js.

const LIST_KEY = ['spreadsheets'];
const detailKey = (id) => ['spreadsheets', id];

// GET /spreadsheets -> [{ id, name, source, sourceRef, columnCount,
//   rowCount, lastImportedAt, createdAt, updatedAt }]
export function useSpreadsheets() {
  const { call } = useApi();
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => call('/spreadsheets'),
  });
}

// GET /spreadsheets/:id -> full grid: { ...summary, headers, rows }
export function useSpreadsheet(id) {
  const { call } = useApi();
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => call(`/spreadsheets/${id}`),
    enabled: !!id,
  });
}

// POST /spreadsheets/upload — multipart field "file" (+ optional name) ->
// the new spreadsheet's full grid.
export function useUploadSpreadsheet() {
  const { upload } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name }) => {
      const fd = new FormData();
      fd.append('file', file);
      if (name) fd.append('name', name);
      return upload('/spreadsheets/upload', fd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

// POST /spreadsheets/from-link — { url, name? } -> the new spreadsheet's
// full grid.
export function useCreateSpreadsheetFromLink() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) => call('/spreadsheets/from-link', { method: 'POST', body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

// PUT /spreadsheets/:id — { name?, headers?, rows? } -> saved grid.
// Used both for a full-grid save (edit cells) and a rename-only save.
export function useUpdateSpreadsheet() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/spreadsheets/${id}`, { method: 'PUT', body }),
    onSuccess: (data, { id }) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.setQueryData(detailKey(id), data);
    },
  });
}

// DELETE /spreadsheets/:id
export function useDeleteSpreadsheet() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => call(`/spreadsheets/${id}`, { method: 'DELETE' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.removeQueries({ queryKey: detailKey(id) });
    },
  });
}

// POST /spreadsheets/:id/import — { mapping, defaultSource?, onDuplicate? }
// -> { spreadsheetId, inserted, updated, skipped, failed, issues }.
// Imports whatever is CURRENTLY saved — save cell edits first.
export function useImportSpreadsheet() {
  const { call } = useApi();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }) => call(`/spreadsheets/${id}/import`, { method: 'POST', body }),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: LIST_KEY });
      qc.invalidateQueries({ queryKey: detailKey(id) });
      qc.invalidateQueries({ queryKey: ['contacts'] });
      qc.invalidateQueries({ queryKey: ['leads'] });
    },
  });
}