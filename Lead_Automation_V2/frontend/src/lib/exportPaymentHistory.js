'use client';

// Client-side export of the (already-filtered) Payment History table —
// no server round trip needed since PaymentHistory.jsx already has the
// full row set in memory for whatever filter is currently applied.

const PURPOSE_LABEL = {
  WALLET_RECHARGE: 'Wallet Recharge',
  ECOMMERCE_ORDER: 'Product Order',
  WALKIN_SALE: 'Charge',
};

function csvCell(value) {
  const str = value === null || value === undefined || value === '' ? '—' : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function rowsToTable(rows) {
  const header = ['Type', 'Method', 'Amount (₹)', 'Status', 'Date'];
  const body = rows.map((p) => [
    PURPOSE_LABEL[p.purpose] || p.purpose,
    p.method || '—',
    Number(p.amount ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
    p.status,
    new Date(p.created_at).toLocaleString('en-IN'),
  ]);
  return { header, body };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function filenameFor(filterLabel, ext) {
  const stamp = new Date().toISOString().slice(0, 10);
  const scope = filterLabel ? filterLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all';
  return `payment-history_${scope}_${stamp}.${ext}`;
}

export function exportPaymentHistoryCsv(rows, filterLabel) {
  if (!rows || rows.length === 0) return;
  const { header, body } = rowsToTable(rows);
  const csv = [header, ...body].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, filenameFor(filterLabel, 'csv'));
}

// jsPDF isn't an npm dependency here — like Razorpay's Checkout.js
// elsewhere in this app (see loadRazorpayCheckout in billing.js), it's
// lazily injected from a CDN once per page load so no bundle-size hit
// unless someone actually exports a PDF.
let jsPdfScriptPromise = null;
function loadJsPdf() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf);
  if (!jsPdfScriptPromise) {
    jsPdfScriptPromise = new Promise((resolve, reject) => {
      const core = document.createElement('script');
      core.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
      core.onload = () => {
        const autotable = document.createElement('script');
        autotable.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
        autotable.onload = () => resolve(window.jspdf);
        autotable.onerror = () => reject(new Error('Could not load PDF export library'));
        document.body.appendChild(autotable);
      };
      core.onerror = () => reject(new Error('Could not load PDF export library'));
      document.body.appendChild(core);
    });
  }
  return jsPdfScriptPromise;
}

export async function exportPaymentHistoryPdf(rows, filterLabel) {
  if (!rows || rows.length === 0) return;
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ orientation: 'landscape' });
  const { header, body } = rowsToTable(rows);

  doc.setFontSize(14);
  doc.text('Payment History', 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Filter: ${filterLabel || 'All'}  ·  Exported ${new Date().toLocaleString('en-IN')}`, 14, 22);

  doc.autoTable({
    head: [header],
    body,
    startY: 28,
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [15, 23, 42] },
  });

  doc.save(filenameFor(filterLabel, 'pdf'));
}
