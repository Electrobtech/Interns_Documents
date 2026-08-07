'use client';
/**
 * Zero-dependency export helpers for the Marketing Hub's Export/Report/
 * Download buttons. Deliberately does not add jspdf/papaparse/etc as new
 * npm dependencies — this app's package-lock isn't being regenerated as
 * part of this change, so anything used here has to already ship in the
 * browser: Blob + <a download> for CSV, window.print() (via a throwaway
 * printable window) for a real, user-savable PDF through the browser's own
 * "Save as PDF" print destination.
 */

export function downloadCsv(filename, rows, columns) {
  const header = columns.map((c) => c.label).join(',');
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((row) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(row) : row[c.value])).join(','));
  const csv = [header, ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Opens a formatted, print-ready document in a new tab and triggers the
// browser print dialog — choosing "Save as PDF" there produces a real PDF
// with zero added dependencies. `bodyHtml` is trusted, Claude/app-generated
// markup only (report content built from our own data), never raw
// user-typed text without escaping upstream.
export function printReport(title, bodyHtml) {
  const win = window.open('', '_blank', 'width=900,height=1000');
  if (!win) return false;
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #111827; padding: 32px; max-width: 860px; margin: 0 auto; }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .meta { font-size: 12px; color: #6b7280; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      th, td { text-align: left; padding: 8px 10px; font-size: 12px; border-bottom: 1px solid #e5e7eb; }
      th { background: #f9fafb; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; font-size: 10px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
      .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
      .kpi .label { font-size: 10px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
      .kpi .value { font-size: 20px; font-weight: 700; margin-top: 4px; }
      @media print { body { padding: 0; } }
    </style></head><body>${bodyHtml}</body></html>`);
  win.document.close();
  win.focus();
  // Give the new tab a tick to finish laying out before invoking print.
  setTimeout(() => win.print(), 300);
  return true;
}
