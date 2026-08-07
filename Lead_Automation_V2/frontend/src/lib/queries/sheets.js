'use client';
import { useMutation } from '@tanstack/react-query';
import { useApi } from '@/lib/useApi';

// Support Agent "Import" tab — paste a public Google Sheets link, preview
// the rows. POST /sheets/preview -> { headers, rows, rowCount, truncated }
// (services/contact-service/src/sheetsRoutes.js). Display-only: nothing
// here writes to contacts/leads.
export function usePreviewSheet() {
  const { call } = useApi();
  return useMutation({
    mutationFn: (url) => call('/sheets/preview', { method: 'POST', body: { url } }),
  });
}
