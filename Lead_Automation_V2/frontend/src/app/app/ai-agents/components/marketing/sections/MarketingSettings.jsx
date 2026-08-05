'use client';
/** Settings \u2014 read-only for now. Per-org agent configuration is not yet
 *  persisted, so this shows the live server defaults rather than pretending
 *  to offer editable fields that would not save. */
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { Card, SectionTitle, Badge, EmptyState } from '../MarketingUI';

const GATED = [
  { action: 'campaign.publish', role: 'admin \u00b7 manager', reversible: false },
  { action: 'content.publish', role: 'admin \u00b7 manager', reversible: true },
];

export default function MarketingSettings() {
  return (
    <div className="space-y-5">
      <Card className="p-5">
        <SectionTitle
          title="Approval rules"
          subtitle="Which marketing actions need a human before they reach a customer"
        />
        <div className="space-y-2">
          {GATED.map((g) => (
            <div key={g.action} className="flex items-center gap-3 p-3 rounded-xl border border-[#EEF1F6]">
              <ShieldCheck size={15} className="text-violet-500 flex-shrink-0" />
              <code className="text-[12px] font-mono text-slate-700">{g.action}</code>
              <span className="text-[11px] text-slate-400 ml-auto">{g.role}</span>
              {!g.reversible && <Badge tone="red">irreversible</Badge>}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 mt-3">
          These can never be auto-approved by a confidence rule, whatever the configuration says.
        </p>
      </Card>

      <Card className="p-5">
        <SectionTitle title="Agent configuration" subtitle="Thresholds, tone, retrieval tuning" />
        <EmptyState
          icon={SettingsIcon}
          title="Not editable yet"
          body="Per-organisation agent settings are not persisted. Values currently come from server configuration."
        />
      </Card>
    </div>
  );
}
