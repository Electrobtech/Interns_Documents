'use client';
/**
 * Settings — split-pane sub-nav, matching the reference.
 *
 * Read-only by design, and it says so. Per-org agent configuration is not
 * persisted anywhere, so rather than rendering editable fields that silently
 * discard input, each unbuilt panel states plainly what is missing. Approval
 * rules stay read-only even once configuration exists: they are platform
 * safety controls, not a marketing preference.
 */
import { useState } from 'react';
import {
  Settings as SettingsIcon, ShieldCheck, Sliders, Database, Bot, Info,
} from 'lucide-react';

import { Card, SectionTitle, Badge, EmptyState, Button, ACCENT } from '../MarketingUI';
import { PageHeader, SplitPane } from '../HubUI';

const GATED = [
  { action: 'campaign.publish', role: 'admin · manager', reversible: false },
  { action: 'content.publish', role: 'admin · manager', reversible: true },
  { action: 'lead.handoff', role: 'admin · manager', reversible: true },
];

const PANELS = [
  { id: 'approvals', label: 'Approval rules', icon: ShieldCheck },
  { id: 'agent', label: 'Agent behaviour', icon: Bot },
  { id: 'retrieval', label: 'Retrieval', icon: Database },
  { id: 'thresholds', label: 'Thresholds', icon: Sliders },
];

export default function MarketingSettings() {
  const [panel, setPanel] = useState('approvals');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Approval rules are platform safety controls and are read-only. Per-org agent configuration is not yet persisted."
      />

      <SplitPane
        aside={
          <Card className="p-2">
            {PANELS.map((p) => {
              const Icon = p.icon;
              const on = p.id === panel;
              return (
                <button
                  key={p.id}
                  onClick={() => setPanel(p.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                    on ? 'text-[#0F1929]' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                  style={on ? { background: '#FFF1F2' } : undefined}
                >
                  <Icon size={14} style={{ color: on ? ACCENT : undefined }} />
                  {p.label}
                </button>
              );
            })}
          </Card>
        }
      >
        {panel === 'approvals' && <ApprovalsPanel />}
        {panel === 'agent' && (
          <NotPersisted
            title="Agent behaviour"
            subtitle="Default tone, voice, and drafting style"
            what="Tone and voice defaults"
          />
        )}
        {panel === 'retrieval' && (
          <NotPersisted
            title="Retrieval"
            subtitle="How much knowledge the agent pulls per run"
            what="Chunk count and workspace weighting"
          />
        )}
        {panel === 'thresholds' && (
          <NotPersisted
            title="Thresholds"
            subtitle="Confidence levels that gate auto-approval"
            what="Auto-approval confidence threshold"
            extra="Irreversible actions stay excluded from auto-approval at any threshold — that exclusion lives in the service layer, so a crafted API call cannot bypass it either."
          />
        )}
      </SplitPane>
    </div>
  );
}

function ApprovalsPanel() {
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle
          title="Approval rules"
          subtitle="Which marketing actions need a human before they reach a customer"
        />
        <div className="space-y-2">
          {GATED.map((g) => (
            <div key={g.action} className="flex items-center gap-3 p-3 rounded-xl border border-[#EEF1F6]">
              <ShieldCheck size={15} className="text-rose-500 flex-shrink-0" />
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

      <Card className="p-4 border-amber-200 bg-amber-50/50">
        <div className="flex items-start gap-2.5">
          <Info size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-[13px] font-semibold text-amber-900">This list is hard-coded in the UI</p>
            <p className="text-[12px] text-amber-800 mt-1">
              It mirrors <code className="font-mono text-[11px]">ACTION_ROLE_REQUIREMENTS</code> in the
              approval engine but is not fetched from it, so a change on the server would leave this
              screen silently stale. Serving it from an endpoint is the fix.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function NotPersisted({ title, subtitle, what, extra }) {
  return (
    <Card className="p-5">
      <SectionTitle title={title} subtitle={subtitle} />
      <EmptyState
        icon={SettingsIcon}
        title="Not editable yet"
        body={`${what} is not persisted per organisation. Values currently come from server configuration, so an editable field here would discard whatever you typed.`}
      />
      {extra && (
        <p className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-[#EEF1F6]">{extra}</p>
      )}
    </Card>
  );
}
