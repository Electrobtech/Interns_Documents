'use client';
import { LayoutTemplate } from 'lucide-react';

// AUTOMATION > Templates — new nav destination introduced by the sidebar
// restructure. There's no template-library concept in automation-service
// yet (playbooks are per-channel flows, not reusable starting points — see
// playbookRepository.js), so this is a placeholder page rather than a stub
// wired to a real endpoint. Once a "save playbook as template" /
// "start from template" flow exists on the backend, this is where its list
// view belongs.
export default function TemplatesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <LayoutTemplate size={20} className="text-brand" />
        <h2 className="text-lg font-bold">Templates</h2>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <LayoutTemplate size={28} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-600">Templates are coming soon</p>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Reusable, prebuilt automation flows you can drop into any channel&apos;s
          Playbook Studio will show up here.
        </p>
      </div>
    </div>
  );
}
