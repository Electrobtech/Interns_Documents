'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, LayoutTemplate, Loader2, AlertTriangle, Copy, Pencil, Trash2,
  CheckCircle2, Clock, XCircle, Check, X as XIcon,
} from 'lucide-react';
import WhatsAppPreviewCard from '@/components/campaigns/templates/WhatsAppPreviewCard';
import {
  useTemplate, useCloneTemplate, useDeleteTemplate, useTemplateDecision,
} from '@/lib/queries/templates';

// Template Detail Modal/page — matches the target screenshot: left column
// has Status / Category / Language / Last Updated / Template ID and a
// functional Clone button, right column is the WhatsApp live preview card.

const STATUS_CFG = {
  APPROVED: { label: 'Approved', Icon: CheckCircle2, bg: 'bg-emerald-50', text: 'text-emerald-700' },
  PENDING:  { label: 'Pending',  Icon: Clock,         bg: 'bg-amber-50',   text: 'text-amber-700'   },
  REJECTED: { label: 'Rejected', Icon: XCircle,       bg: 'bg-red-50',     text: 'text-red-700'     },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function DetailRow({ label, children }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-b-0">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{children}</span>
    </div>
  );
}

export default function TemplateDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: template, isLoading, isError } = useTemplate(id);
  const cloneTemplate = useCloneTemplate();
  const deleteTemplate = useDeleteTemplate();
  const decideTemplate = useTemplateDecision();
  const [deleting, setDeleting] = useState(false);

  const handleClone = async () => {
    const cloned = await cloneTemplate.mutateAsync(id);
    router.push(`/app/campaigns/templates/${cloned.id}`);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete template "${template.name}"? This can't be undone.`)) return;
    setDeleting(true);
    try {
      await deleteTemplate.mutateAsync(id);
      router.push('/app/campaigns/templates');
    } finally {
      setDeleting(false);
    }
  };

  const handleDecision = (decision) => decideTemplate.mutateAsync({ id, decision });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-slate-400 py-20 justify-center">
        <Loader2 size={16} className="animate-spin" /> Loading template…
      </div>
    );
  }

  if (isError || !template) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Couldn&apos;t load this template.</p>
        </div>
      </div>
    );
  }

  const st = STATUS_CFG[template.status] || STATUS_CFG.PENDING;
  const StatusIcon = st.Icon;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/app/campaigns/templates"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <LayoutTemplate size={20} className="text-brand" />
        <h2 className="text-lg font-bold">{template.name}</h2>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
        {/* LEFT: details */}
        <div className="xl:col-span-3 space-y-5">
          <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">Template Details</h3>
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full shrink-0 ${st.bg} ${st.text}`}>
                <StatusIcon size={11} /> {st.label}
              </span>
            </div>

            <div>
              <DetailRow label="Status">{st.label}</DetailRow>
              <DetailRow label="Category">{template.category}</DetailRow>
              <DetailRow label="Language">{template.language}</DetailRow>
              <DetailRow label="Channels">{(template.channels || []).join(', ') || '—'}</DetailRow>
              <DetailRow label="Last Updated">{fmtDate(template.updated_at)}</DetailRow>
              <DetailRow label="Template ID"><span className="font-mono text-[11px]">{template.id}</span></DetailRow>
            </div>

            <div className="flex items-center gap-2 flex-wrap mt-4">
              <button onClick={handleClone} disabled={cloneTemplate.isPending} className="btn-ghost btn-sm">
                <Copy size={13} /> {cloneTemplate.isPending ? 'Cloning…' : 'Clone'}
              </button>
              <Link href={`/app/campaigns/templates/${id}/edit`} className="btn-ghost btn-sm">
                <Pencil size={13} /> Edit
              </Link>
              {template.status === 'PENDING' && (
                <>
                  <button onClick={() => handleDecision('APPROVED')} disabled={decideTemplate.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 rounded-xl transition-colors">
                    <Check size={13} /> Approve
                  </button>
                  <button onClick={() => handleDecision('REJECTED')} disabled={decideTemplate.isPending}
                    className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-xl transition-colors">
                    <XIcon size={13} /> Reject
                  </button>
                </>
              )}
              <button onClick={handleDelete} disabled={deleting}
                className="flex items-center gap-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors ml-auto">
                <Trash2 size={13} /> {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </section>

          {template.footer && (
            <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-2">Footer</h3>
              <p className="text-xs text-slate-500">{template.footer}</p>
            </section>
          )}

          {(template.buttons || []).length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Buttons</h3>
              <div className="space-y-2">
                {template.buttons.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-400 uppercase w-24 shrink-0">{b.type.replace('_', ' ')}</span>
                    <span className="text-slate-700 font-medium">{b.text}</span>
                    {b.value && <span className="text-slate-400">— {b.value}</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* RIGHT: live preview */}
        <div className="xl:col-span-2 xl:sticky xl:top-6 space-y-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1">WhatsApp Preview</p>
          <WhatsAppPreviewCard template={template} />
        </div>
      </div>
    </div>
  );
}
