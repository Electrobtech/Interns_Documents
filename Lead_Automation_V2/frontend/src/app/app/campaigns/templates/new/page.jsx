'use client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, LayoutTemplate } from 'lucide-react';
import TemplateEditor from '@/components/campaigns/templates/TemplateEditor';
import { useCreateTemplate } from '@/lib/queries/templates';

export default function NewTemplatePage() {
  const router = useRouter();
  const createTemplate = useCreateTemplate();

  const handleSubmit = async (body) => {
    const created = await createTemplate.mutateAsync(body);
    router.push(`/app/campaigns/templates/${created.id}`);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/app/campaigns/templates"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <LayoutTemplate size={20} className="text-brand" />
        <h2 className="text-lg font-bold">New Template</h2>
      </div>

      <TemplateEditor
        onSubmit={handleSubmit}
        submitting={createTemplate.isPending}
        submitLabel="Create Template"
      />
    </div>
  );
}
