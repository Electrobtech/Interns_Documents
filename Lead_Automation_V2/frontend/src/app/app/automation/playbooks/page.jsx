'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Workflow, MessageCircle, Instagram, Smartphone, Loader2, ArrowRight,
} from 'lucide-react';
import { useApi } from '@/lib/useApi';

// AUTOMATION > Playbooks — an org-wide index over every channel's Playbook
// Studio flow (see PlaybookStudioApp.jsx / GET /automation/playbooks on
// automation-service). Each channel still autosaves to its own fixed
// `<channel>-default` playbook id from its Automation tab (e.g.
// /app/channels/whatsapp/automation); this page is a read-only rollup of
// all of them in one place, with a link back into the right channel's
// Studio to actually edit one.
//
// Only WhatsApp, Instagram, and SMS/RCS have a real Automation page right
// now (see Sidebar.jsx) — any other channel's playbook is still listed
// below, just without an "Open in Studio" link, since there's nowhere to
// send that click yet.
const CHANNEL_META = {
  whatsapp:  { label: 'WhatsApp',  icon: MessageCircle, href: '/app/channels/whatsapp/automation'  },
  instagram: { label: 'Instagram', icon: Instagram,     href: '/app/channels/instagram/automation' },
  sms:       { label: 'SMS / RCS', icon: Smartphone,    href: '/app/channels/sms/automation'       },
};

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PlaybooksIndexPage() {
  const { call } = useApi();
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    call('/automation/playbooks')
      .then((data) => { if (!cancelled) setPlaybooks(Array.isArray(data) ? data : []); })
      .catch((e) => { if (!cancelled) setErr(e.message || 'Failed to load playbooks'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [call]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Workflow size={20} className="text-brand" />
        <h2 className="text-lg font-bold">Playbooks</h2>
      </div>
      <p className="text-sm text-slate-500 -mt-4">
        Every automation flow across your connected channels, in one place.
        Open a channel&apos;s Studio to build or edit its playbook.
      </p>

      {err && <p className="text-sm text-red-500">{err}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" /> Loading playbooks…
        </div>
      ) : playbooks.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <Workflow size={28} className="mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-medium text-slate-600">No playbooks yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Open any channel&apos;s Automation tab to build your first flow.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {playbooks.map((pb) => {
            const primaryChannel = (pb.channels || [])[0];
            const meta = CHANNEL_META[primaryChannel];
            const Icon = meta?.icon || Workflow;
            return (
              <div key={pb.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-violet-50 text-violet-600 grid place-items-center shrink-0">
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{pb.name || 'Untitled playbook'}</p>
                    <p className="text-xs text-slate-400">
                      {(pb.channels || []).map((c) => CHANNEL_META[c]?.label || c).join(', ') || 'No channel'}
                      {' · '}{pb.status || 'draft'}
                      {' · updated '}{fmtDate(pb.updatedAt)}
                    </p>
                  </div>
                </div>
                {meta ? (
                  <Link
                    href={meta.href}
                    className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
                  >
                    Open in Studio <ArrowRight size={12} />
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
