'use client';
import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, X } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';
import { getToken } from '@/lib/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat',
  'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh',
  'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh',
  'Uttarakhand', 'West Bengal', 'Delhi',
];

function GenerateInvoiceModal({ onClose, onCreated }) {
  const { call } = useApi();
  const [form, setForm] = useState({
    studentName: '', studentState: 'Karnataka', studentGstin: '', studentAddress: '',
    courseName: '', totalAmount: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setError('');
    setSubmitting(true);
    try {
      const result = await call('/finances/invoices', {
        method: 'POST',
        body: {
          studentName: form.studentName,
          studentState: form.studentState,
          studentGstin: form.studentGstin || undefined,
          studentAddress: form.studentAddress || undefined,
          courseName: form.courseName || undefined,
          totalAmount: Number(form.totalAmount),
        },
      });
      onCreated(result.invoice);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl border border-slate-200 w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Generate GST Invoice</h3>
          <button onClick={onClose}><X size={16} className="text-slate-400" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">Student Name</label>
            <input value={form.studentName} onChange={set('studentName')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-500">Course Name</label>
            <input value={form.courseName} onChange={set('courseName')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Total Amount (GST-incl., ₹)</label>
              <input type="number" value={form.totalAmount} onChange={set('totalAmount')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Student State</label>
              <select value={form.studentState} onChange={set('studentState')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Student GSTIN (optional — leave blank for B2C)</label>
            <input value={form.studentGstin} onChange={set('studentGstin')} className="w-full mt-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <button
          onClick={submit}
          disabled={submitting || !form.studentName || !form.totalAmount}
          className="w-full bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? 'Generating…' : 'Generate Invoice'}
        </button>
      </div>
    </div>
  );
}

export default function InvoicesRevenue() {
  const { call } = useApi();
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const load = useCallback(() => {
    call('/finances/invoices').then((r) => setInvoices(r.rows)).catch((e) => setError(e.message));
  }, [call]);

  useEffect(() => { load(); }, [load]);

  // Plain <a href> won't carry the Authorization header, so the PDF is
  // fetched with the token and turned into a blob URL — same reason
  // apiUpload/api() in lib/api.js attach Bearer manually everywhere else.
  const downloadPdf = async (invoice) => {
    const res = await fetch(`${API_BASE}/finances/invoices/${invoice.id}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) { setError('Could not download invoice PDF'); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${invoice.invoice_number.replace(/\//g, '-')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium"
      >
        <Plus size={15} /> Generate GST Invoice
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">Course Invoices</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Invoice No.</th>
              <th className="text-left px-4 py-2">Student</th>
              <th className="text-left px-4 py-2">SAC</th>
              <th className="text-right px-4 py-2">Base Amount</th>
              <th className="text-right px-4 py-2">GST</th>
              <th className="text-right px-4 py-2">Total</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {invoices.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No invoices yet</td></tr>
            )}
            {invoices.map((inv) => (
              <tr key={inv.id} className={`border-t border-slate-100 ${inv.status === 'void' ? 'opacity-50' : ''}`}>
                <td className="px-4 py-2 font-mono text-xs">{inv.invoice_number}</td>
                <td className="px-4 py-2">{inv.student_name}</td>
                <td className="px-4 py-2">{inv.sac_code}</td>
                <td className="px-4 py-2 text-right">{inr(inv.base_amount)}</td>
                <td className="px-4 py-2 text-right text-xs text-slate-500">
                  {inv.intra_state
                    ? `CGST ${inv.cgst_rate}% + SGST ${inv.sgst_rate}%`
                    : `IGST ${inv.igst_rate}%`}
                </td>
                <td className="px-4 py-2 text-right font-medium">{inr(inv.total_amount)}</td>
                <td className="px-4 py-2 text-right">
                  <button onClick={() => downloadPdf(inv)} className="text-brand hover:underline flex items-center gap-1 text-xs ml-auto">
                    <Download size={13} /> PDF
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <GenerateInvoiceModal
          onClose={() => setModalOpen(false)}
          onCreated={() => { setModalOpen(false); load(); }}
        />
      )}
    </div>
  );
}
