'use client';
import { Smartphone } from 'lucide-react';
import SmsAutomationSimulator from '@/components/automation/sms-simulator/SmsAutomationSimulator';

// SMS / RCS > Automation — the SMS Automation Simulation page. Reuses the
// same Sidebar/Topbar shell as every other channel's Automation tab.
// Conversations for this channel live at Sidebar > Channels > SMS/RCS
// (see [type]/page.jsx) — this used to also duplicate a "Conversations"
// tab here that just linked back there.
//
// This is a self-contained, mock-driven simulator (no flow engine call under
// the hood — see the "MOCK FALLBACK" badge in EngineDiagnostics) rather than
// wired into the WhatsApp-specific Playbook Studio, since plain SMS/RCS
// sends don't need that engine's list/button/branch node types.
export default function SmsAutomationPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-0 flex items-start justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
              <Smartphone size={15} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">SMS Automation</h2>
          </div>
          <p className="text-[13px] text-slate-500 mt-1 ml-9">
            Send instant text messages to your leads and contacts.
          </p>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-3">
        <SmsAutomationSimulator />
      </div>
    </div>
  );
}
