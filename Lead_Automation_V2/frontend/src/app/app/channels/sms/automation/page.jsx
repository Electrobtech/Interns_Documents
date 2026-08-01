'use client';
import Link from 'next/link';
import { Smartphone, Bot } from 'lucide-react';
import SmsAutomationSimulator from '@/components/automation/sms-simulator/SmsAutomationSimulator';

// SMS / RCS > Automation — the SMS Automation Simulation page. Sits alongside
// the existing /channels/sms conversation view (see [type]/page.jsx), reusing
// the same Sidebar/Topbar shell as every other channel's Automation tab.
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

      <div className="px-6 mt-4 shrink-0">
        <div className="flex items-center gap-4 text-sm border-b border-slate-200">
          <Link
            href="/app/channels/sms"
            className="px-1 pb-2 -mb-px text-slate-500 hover:text-slate-700"
          >
            Conversations
          </Link>
          <Link
            href="/app/channels/sms/automation"
            className="px-1 pb-2 -mb-px border-b-2 border-violet-600 text-violet-600 font-medium flex items-center gap-1.5"
          >
            <Bot size={14} /> Automation
          </Link>
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-3">
        <SmsAutomationSimulator />
      </div>
    </div>
  );
}
