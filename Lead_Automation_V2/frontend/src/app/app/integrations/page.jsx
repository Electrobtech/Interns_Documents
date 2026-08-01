'use client';

import { Plug, Facebook } from 'lucide-react';
import ConnectionsPanel from '@/components/ConnectionsPanel';

// The CRM Integrations section that used to live here was removed: it called
// /crm/connections, /crm/sync-jobs, and /crm/sync/outbound, none of which
// exist anywhere in this codebase (no gateway route, no service implements
// them). Every request failed, so the page permanently showed "CRM
// integrations are not available yet." alongside a raw workspace UUID input
// and two empty panels. Restore it together with the crm-sync service and its
// gateway route, not before.
export default function IntegrationsPage() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Plug size={24} className="text-violet-600" />
          <h1 className="text-2xl font-bold">Integrations &amp; APIs</h1>
        </div>
        <p className="text-sm text-slate-500">
          Connect Facebook, Instagram, and WhatsApp for messaging and publishing.
        </p>
      </div>

      {/* ---------- Meta Integrations (Facebook, Instagram, WhatsApp) ---------- */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Facebook size={20} className="text-brand" />
          <h2 className="text-lg font-bold">Meta Integrations</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Facebook and Instagram share a single connection — connect via Meta login or by pasting
          in Page credentials directly. Once a connection is saved, it locks automatically so it
          can&apos;t be changed by accident; only an org admin can unlock it to reconnect.
        </p>
        <ConnectionsPanel />
      </section>
    </div>
  );
}
