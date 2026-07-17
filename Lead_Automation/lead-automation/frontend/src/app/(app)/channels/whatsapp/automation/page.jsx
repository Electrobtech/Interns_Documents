'use client';
import Link from 'next/link';
import { MessageCircle, Bot } from 'lucide-react';
import PlaybookStudioApp from '@/components/automation/PlaybookStudioApp';

// WhatsApp > Automation — hosts the Lead Automation flow builder + simulator
// (ported from the standalone "Lead Automation" project) as a real route
// inside the CRM's own React routing, not an iframe. Sits alongside the
// existing /channels/whatsapp conversation view (see [type]/page.jsx),
// reusing the same Sidebar/Topbar shell, auth, and API layer.
export default function WhatsAppAutomationPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0 space-y-1">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-brand" />
          <h2 className="text-lg font-bold">WhatsApp</h2>
        </div>

        <div className="flex items-center gap-4 text-sm border-b border-slate-200 mt-3">
          <Link
            href="/channels/whatsapp"
            className="px-1 pb-2 -mb-px text-slate-500 hover:text-slate-700"
          >
            Conversations
          </Link>
          <Link
            href="/channels/whatsapp/automation"
            className="px-1 pb-2 -mb-px border-b-2 border-brand text-brand font-medium flex items-center gap-1.5"
          >
            <Bot size={14} /> Automation
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-3">
        <PlaybookStudioApp channel="whatsapp" playbookId="whatsapp-default" />
      </div>
    </div>
  );
}