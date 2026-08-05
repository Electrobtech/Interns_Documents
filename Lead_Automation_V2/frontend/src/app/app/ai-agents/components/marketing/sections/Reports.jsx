'use client';
/**
 * Reports — generated snapshots at /ai-agents/marketing/reports.
 *
 * Every figure comes from Orbq's own tables. Sections the backend returns as
 * null (revenue attribution, lead counts — those live in the CRM) render as an
 * explicit note rather than a zero, which would read as "measured and zero".
 */
import { useState } from 'react';
import { FileBarChart, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';

import { useReports, useGenerateReport, useDeleteReport, REPORT_TYPES } from '@/lib/queries/marketing';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import { Modal, Field, Input, Select, ErrorNote, fmtDate, timeAgo } from './Shared';

const TYPE_LABEL = Object.fromEntries(REPORT_TYPES.map((t) => [t.value, t.label]));

export default function Reports() {
  const [genOpen, setGenOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const [typeFilter, setTypeFilter] = useState('');
  const { data: rows = [], isLoading } = useReports(typeFilter || undefined);
  const del = useDeleteReport();

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <SectionTitle
          title="Reports"
          subtitle="Point-in-time snapshots computed from your own campaign, broadcast, and content data."
          action={<Button variant="primary" icon={Plus} onClick={() => setGenOpen(true)}>Generate report</Button>}
        />
        <div className="w-56">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={REPORT_TYPES}
            placeholder="All report types"
          />
        </div>
      </Card>

      <ErrorNote error={del.error} />

      {isLoading ? (
        <Card className="p-10 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></Card>
      ) : !rows.length ? (
        <Card className="p-5">
          <EmptyState
            icon={FileBarChart}
            title="No reports yet"
            body="Generate one to snapshot how a period actually performed."
            action={<Button variant="primary" icon={Plus} onClick={() => setGenOpen(true)}>Generate report</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const open = expanded === r.id;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F1929] truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {fmtDate(r.period_start)} – {fmtDate(r.period_end)} · generated {timeAgo(r.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <Badge tone="violet">{TYPE_LABEL[r.report_type] || r.report_type}</Badge>
                    <Button
                      icon={open ? ChevronUp : ChevronDown}
                      onClick={() => setExpanded(open ? null : r.id)}
                      className="!px-2 !py-1.5"
                    />
                    <Button variant="danger" icon={Trash2} onClick={() => del.mutate(r.id)} className="!px-2 !py-1.5" />
                  </div>
                </div>

                {open && <ReportBody data={r.data} />}
              </Card>
            );
          })}
        </div>
      )}

      <GenerateModal open={genOpen} onClose={() => setGenOpen(false)} />
    </div>
  );
}

function ReportBody({ data }) {
  const sections = Object.entries(data || {}).filter(([k]) => k !== 'period');
  if (!sections.length) {
    return <p className="mt-4 pt-4 border-t border-[#EEF1F6] text-[12px] text-slate-400">No data in this report.</p>;
  }
  return (
    <div className="mt-4 pt-4 border-t border-[#EEF1F6] space-y-4">
      {sections.map(([key, value]) => (
        <div key={key}>
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
            {key.replace(/_/g, ' ')}
          </p>
          <Section value={value} />
        </div>
      ))}
    </div>
  );
}

function Section({ value }) {
  if (value === null || value === undefined) {
    return <p className="text-[12px] text-slate-300">—</p>;
  }
  if (typeof value !== 'object') {
    return <p className="text-[13px] text-slate-700 font-mono">{String(value)}</p>;
  }

  const note = value.note;
  const entries = Object.entries(value).filter(([k]) => k !== 'note');

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {entries.map(([k, v]) => (
          <div key={k} className="rounded-xl border border-[#EEF1F6] px-3 py-2.5">
            <p className="text-[10px] text-slate-400 mb-0.5">{k.replace(/_/g, ' ')}</p>
            {v && typeof v === 'object' ? (
              Object.keys(v).length ? (
                <div className="space-y-0.5">
                  {Object.entries(v).map(([sk, sv]) => (
                    <p key={sk} className="text-[11px] text-slate-600">
                      {sk.replace(/_/g, ' ')}: <span className="font-mono text-slate-700">{String(sv)}</span>
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-[12px] text-slate-300">none</p>
              )
            ) : (
              <p className="text-base font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                {v === null ? <span className="text-slate-300 text-sm">not available</span> : String(v)}
              </p>
            )}
          </div>
        ))}
      </div>
      {note && (
        <div className="flex items-start gap-2 mt-2 rounded-lg bg-slate-50 border border-[#EEF1F6] px-3 py-2">
          <Info size={12} className="text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] text-slate-500">{note}</p>
        </div>
      )}
    </>
  );
}

function GenerateModal({ open, onClose }) {
  const gen = useGenerateReport();
  const [form, setForm] = useState({
    name: '', report_type: 'monthly_summary', period_start: '', period_end: '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await gen.mutateAsync({
      name: form.name.trim(),
      report_type: form.report_type,
      period_start: form.period_start || null,
      period_end: form.period_end || null,
    });
    setForm({ name: '', report_type: 'monthly_summary', period_start: '', period_end: '' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate report"
      subtitle="Computed live from your data — nothing is estimated."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || gen.isPending}>
            {gen.isPending ? 'Generating…' : 'Generate'}
          </Button>
        </>
      }
    >
      <ErrorNote error={gen.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} placeholder="August summary" />
      </Field>
      <Field label="Type" required>
        <Select value={form.report_type} onChange={set('report_type')} options={REPORT_TYPES} />
      </Field>
      <Field label="Period start" hint="Defaults to 30 days before the end date.">
        <Input type="date" value={form.period_start} onChange={set('period_start')} />
      </Field>
      <Field label="Period end" hint="Defaults to today.">
        <Input type="date" value={form.period_end} onChange={set('period_end')} />
      </Field>
    </Modal>
  );
}
