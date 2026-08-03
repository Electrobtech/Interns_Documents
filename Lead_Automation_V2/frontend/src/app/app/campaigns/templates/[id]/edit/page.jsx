'use client';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LayoutTemplate, Loader2, AlertTriangle } from 'lucide-react';
import TemplateEditor from '@/components/campaigns/templates/TemplateEditor';
import { useTemplate, useUpdateTemplate } from '@/lib/queries/templates';

export default function EditTemplatePage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: template, isLoading, isError } = useTemplate(id);
  const updateTemplate = useUpdateTemplate();

  const handleSubmit = async (body) => {
    await updateTemplate.mutateAsync({ id, ...body });
    router.push(`/app/campaigns/templates/${id}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href={`/app/campaigns/templates/${id}`}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <LayoutTemplate size={20} className="text-brand" />
        <h2 className="text-lg font-bold">Edit Template</h2>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-10 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading template…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">Failed to load this template.</p>
        </div>
      )}

      {template && (
        <TemplateEditor
          initial={template}
          onSubmit={handleSubmit}
          submitting={updateTemplate.isPending}
          submitLabel="Save Changes"
        />
      )}
    </div>
  );
}
