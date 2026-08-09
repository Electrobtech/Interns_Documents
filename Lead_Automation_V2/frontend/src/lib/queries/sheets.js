'use client';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Support Agent "Import" tab — paste a Google Sheets link (public, or
// private + shared with the configured service account), preview a
// suggested contacts/leads mapping, then commit the import.
// See services/contact-service/src/sheetsRoutes.js.

// POST /sheets/preview -> { sheetTitle, headers, mapping, rowCount,
//   truncated, rawPreviewRows, stats, issues, previewRecords,
//   serviceAccountEmail }. Writes nothing.
export function usePreviewSheet() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call('/sheets/preview', { method: 'POST', body }),
  });
}

// POST /sheets/import -> { sheetId, sheet, inserted, updated, skipped,
//   failed, issues }. Writes to contacts, same path the CSV/XLSX importer
// uses to feed the CRM.
export function useImportSheet() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (body) => call('/sheets/import', { method: 'POST', body }),
  });
}
