'use client';
import { Instagram } from 'lucide-react';
import PlaybookStudioApp from '@/components/automation/PlaybookStudioApp';

// Instagram > Automation — same Playbook Studio used at
// /channels/whatsapp/automation. PlaybookStudioApp itself has no
// channel-specific logic (it just edits/simulates a flow graph), so this
// page is a near-exact copy of the WhatsApp one with the channel chrome
// swapped in. If a third channel needs this later, it's worth promoting
// this into `channels/[type]/automation/page.jsx` and passing `type` down
// as a prop instead of continuing to fork the file.
//
// Conversations for this channel live at Sidebar > Channels > Instagram
// (see [type]/page.jsx) — this used to also duplicate a "Conversations"
// tab here that just linked back there.
export default function InstagramAutomationPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-6 pb-0 space-y-1">
        <div className="flex items-center gap-2">
          <Instagram size={20} className="text-brand" />
          <h2 className="text-lg font-bold">Instagram Automation</h2>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-3">
        <PlaybookStudioApp channel="instagram" playbookId="instagram-default" />
      </div>
    </div>
  );
}