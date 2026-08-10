// services/finance-service/src/lib/pdf.js
//
// Renders a `course_invoices` row as a downloadable GST invoice PDF, per
// CGST Rules 2017, Rule 46's required-fields list: seller GSTIN/name/
// address, consecutive invoice number, SAC code, taxable value, GST rate/
// amount split (CGST+SGST or IGST), total invoice value in figures and
// words, and place of supply.
//
// Uses pdfkit (no headless-browser dependency) — streams directly to the
// HTTP response in routes/invoices.js rather than buffering to disk.

const PDFDocument = require('pdfkit');
const { amountInWords } = require('./gst');

const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Streams a GST invoice PDF for `invoice` (a course_invoices row) onto
// `res` (an Express response with headers already set by the caller).
function streamInvoicePdf(invoice, res) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  doc.pipe(res);

  // ---- Header ----
  doc.fontSize(16).font('Helvetica-Bold').text(invoice.seller_legal_name, { align: 'left' });
  doc.fontSize(9).font('Helvetica').fillColor('#444');
  if (invoice.seller_address) doc.text(invoice.seller_address);
  if (invoice.seller_gstin) doc.text(`GSTIN: ${invoice.seller_gstin}`);
  doc.fillColor('#000');

  doc.moveDown(0.5);
  doc.fontSize(14).font('Helvetica-Bold').text('TAX INVOICE', { align: 'center' });
  doc.moveDown(0.5);

  // ---- Invoice meta ----
  const metaTop = doc.y;
  doc.fontSize(9).font('Helvetica-Bold').text('Invoice No:', 40, metaTop, { continued: true }).font('Helvetica').text(` ${invoice.invoice_number}`);
  doc.font('Helvetica-Bold').text('Invoice Date:', 40, doc.y, { continued: true }).font('Helvetica').text(` ${new Date(invoice.created_at).toLocaleDateString('en-IN')}`);
  doc.font('Helvetica-Bold').text('Financial Year:', 40, doc.y, { continued: true }).font('Helvetica').text(` ${invoice.financial_year}`);
  doc.font('Helvetica-Bold').text('Place of Supply:', 40, doc.y, { continued: true }).font('Helvetica').text(` ${invoice.place_of_supply}`);

  doc.moveDown(0.75);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.5);

  // ---- Bill To ----
  doc.fontSize(10).font('Helvetica-Bold').text('Bill To:');
  doc.fontSize(9).font('Helvetica').text(invoice.student_name);
  if (invoice.student_address) doc.text(invoice.student_address);
  doc.text(`State: ${invoice.student_state}`);
  if (invoice.student_gstin) doc.text(`GSTIN: ${invoice.student_gstin}`);

  doc.moveDown(1);

  // ---- Line item table ----
  const tableTop = doc.y;
  const cols = [
    { label: 'Description', x: 40, w: 190 },
    { label: 'SAC Code', x: 230, w: 60 },
    { label: 'Taxable Value', x: 290, w: 90, align: 'right' },
    { label: 'Tax', x: 380, w: 90, align: 'right' },
    { label: 'Total', x: 470, w: 85, align: 'right' },
  ];
  doc.fontSize(9).font('Helvetica-Bold');
  cols.forEach((c) => doc.text(c.label, c.x, tableTop, { width: c.w, align: c.align || 'left' }));
  doc.moveTo(40, doc.y + 3).lineTo(555, doc.y + 3).strokeColor('#000').stroke();

  const rowY = doc.y + 8;
  doc.font('Helvetica').fontSize(9);
  doc.text(invoice.course_name || 'Course enrollment fee', cols[0].x, rowY, { width: cols[0].w });
  doc.text(invoice.sac_code, cols[1].x, rowY, { width: cols[1].w });
  doc.text(inr(invoice.base_amount), cols[2].x, rowY, { width: cols[2].w, align: 'right' });

  const taxLabel = invoice.intra_state
    ? `CGST ${invoice.cgst_rate}%: ${inr(invoice.cgst_amount)}\nSGST ${invoice.sgst_rate}%: ${inr(invoice.sgst_amount)}`
    : `IGST ${invoice.igst_rate}%: ${inr(invoice.igst_amount)}`;
  doc.text(taxLabel, cols[3].x, rowY, { width: cols[3].w, align: 'right' });
  doc.text(inr(invoice.total_amount), cols[4].x, rowY, { width: cols[4].w, align: 'right' });

  doc.moveDown(2.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#ccc').stroke();
  doc.moveDown(0.5);

  // ---- Totals ----
  const totalsX = 350;
  doc.fontSize(9).font('Helvetica');
  doc.text('Taxable Value:', totalsX, doc.y, { continued: true, width: 120 }).text(inr(invoice.base_amount), { align: 'right' });
  if (invoice.intra_state) {
    doc.text(`CGST (${invoice.cgst_rate}%):`, totalsX, doc.y, { continued: true, width: 120 }).text(inr(invoice.cgst_amount), { align: 'right' });
    doc.text(`SGST (${invoice.sgst_rate}%):`, totalsX, doc.y, { continued: true, width: 120 }).text(inr(invoice.sgst_amount), { align: 'right' });
  } else {
    doc.text(`IGST (${invoice.igst_rate}%):`, totalsX, doc.y, { continued: true, width: 120 }).text(inr(invoice.igst_amount), { align: 'right' });
  }
  doc.font('Helvetica-Bold');
  doc.text('Total:', totalsX, doc.y, { continued: true, width: 120 }).text(inr(invoice.total_amount), { align: 'right' });

  doc.moveDown(1);
  doc.font('Helvetica-Bold').fontSize(9).text('Amount in Words: ', 40, doc.y, { continued: true }).font('Helvetica').text(amountInWords(invoice.total_amount));

  doc.moveDown(2);
  doc.fontSize(8).fillColor('#777').text(
    'This is a system-generated tax invoice issued under Rule 46 of the CGST Rules, 2017. ' +
    'No signature required.',
    40, doc.y, { width: 515 }
  );

  doc.end();
}

module.exports = { streamInvoicePdf };
