'use client';
import { MessageCircle } from 'lucide-react';
import PlaybookStudioApp from '@/components/automation/PlaybookStudioApp';

// WhatsApp > Automation — hosts the Lead Automation flow builder + simulator
// (ported from the standalone "Lead Automation" project) as a real route
// inside the CRM's own React routing, not an iframe. Conversations for this
// channel live at Sidebar > Channels > WhatsApp (see [type]/page.jsx) —
// this page used to also expose a "Conversations" tab that just linked
// back there, which was a redundant hop rather than a real second view.
// PlaybookStudioApp itself already has its own Builder / Simulate /
// Broadcast tabs for everything that actually belongs to Automation.
export default function WhatsAppAutomationPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0 space-y-1">
        <div className="flex items-center gap-2">
          <MessageCircle size={20} className="text-brand" />
          <h2 className="text-lg font-bold">WhatsApp Automation</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-3">
        <PlaybookStudioApp channel="whatsapp" playbookId="whatsapp-default" />
      </div>
    </div>
  );
}
