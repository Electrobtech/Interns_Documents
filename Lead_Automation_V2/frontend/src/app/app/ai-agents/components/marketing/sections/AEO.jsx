'use client';
/**
 * AEO — Answer Engine Optimization, persisted at /ai-agents/marketing/aeo/*.
 *
 * `visibility_estimate` is exactly that: an estimate the model produced, not a
 * measurement. It's labelled as such rather than presented as a score, because
 * no answer engine exposes a real one.
 */
import { useState } from 'react';
import { Zap, Trash2, Plus, Loader2, Pencil } from 'lucide-react';

import {
  useAeoProjects, useCreateAeoProject, useDeleteAeoProject, useUpdateAeoProject,
} from '@/lib/queries/marketing';
import { Card, Badge, Button, EmptyState, SectionTitle, ProgressBar } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import { AIPanel, Modal, Field, Input, Textarea, TagsInput, ErrorNote, timeAgo } from './Shared';

export default function AEO() {
  const [manualOpen, setManualOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { data: rows = [], isLoading } = useAeoProjects();
  const create = useCreateAeoProject();
  const del = useDeleteAeoProject();

  const saveFromAI = async (out, meta) => {
    await create.mutateAsync({
      name: out?.name || out?.title || 'AEO analysis',
      target_url: out?.target_url || null,
      answer_ready_summary: out?.answer_ready_summary || null,
      structured_facts: out?.structured_facts || [],
      question_variants: out?.question_variants || [],
      schema_suggestions: out?.schema_markup_suggestions || out?.schema_suggestions || [],
      weaknesses: out?.weaknesses || [],
      visibility_estimate: out?.visibility_estimate ?? null,
      ai_execution_id: meta?.execution_id || null,
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="AEO"
        subtitle="Answer Engine Optimization. Visibility is a model self-assessment, not a measurement."
        count={rows.length}
      />

      <Toolbar>
        <Button variant="primary" icon={Plus} onClick={() => setManualOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          Add analysis
        </Button>
        <ToolButton icon={Pencil} disabled title="Hover a project to edit it">Edit</ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Projects', value: rows.length, tone: 'violet' },
          { label: 'With summary', value: rows.filter((p) => p.answer_ready_summary).length, tone: 'blue' },
          { label: 'Facts captured', value: rows.reduce((s, p) => s + (p.structured_facts?.length || 0), 0), tone: 'green' },
          { label: 'Weaknesses', value: rows.reduce((s, p) => s + (p.weaknesses?.length || 0), 0), tone: 'amber' },
          { label: 'Citations', value: null, tone: 'slate', note: 'needs an answer-engine API' },
        ]}
      />

      <AIPanel
        capability="aeo"
        placeholder="e.g. Make our pricing page quotable by ChatGPT and Perplexity"
        examples={['Make our FAQ answer-engine ready', 'Extractable summary for our homepage']}
        onSave={saveFromAI}
        saving={create.isPending}
        saveLabel="Save analysis"
        renderResult={(out) => (
          <div className="space-y-3">
            {out?.answer_ready_summary && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                  Answer-ready summary
                </p>
                <p className="text-[13px] text-slate-700">{out.answer_ready_summary}</p>
              </div>
            )}
            {out?.structured_facts?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Facts</p>
                <ul className="space-y-0.5">
                  {out.structured_facts.map((f, i) => (
                    <li key={i} className="text-[12px] text-slate-600">· {f}</li>
                  ))}
                </ul>
              </div>
            )}
            {out?.weaknesses?.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wide mb-1">
                  Why it might be skipped
                </p>
                <ul className="space-y-0.5">
                  {out.weaknesses.map((w, i) => (
                    <li key={i} className="text-[12px] text-amber-700">· {w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      />

      <Card className="p-4">
        <SectionTitle
          title="Saved analyses"
          subtitle={`${rows.length} page${rows.length === 1 ? '' : 's'} optimized for answer engines`}
          action={<Button icon={Plus} onClick={() => setManualOpen(true)}>Add manually</Button>}
        />
      </Card>

      <ErrorNote error={create.error || del.error} />

      {isLoading ? (
        <Card className="p-10 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></Card>
      ) : !rows.length ? (
        <Card className="p-5">
          <EmptyState
            icon={Zap}
            title="Nothing saved yet"
            body="Run the agent above, then save the analysis so you can track which pages are answer-engine ready."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((p) => (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0F1929] truncate">{p.name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{p.target_url || 'No URL set'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.visibility_estimate != null && (
                    <div className="w-28 text-right">
                      <p className="text-sm font-bold text-[#0F1929]" style={{ fontFamily: "'Outfit', sans-serif" }}>
                        {p.visibility_estimate}%
                      </p>
                      {/* Named `_estimate` in the schema on purpose: this is
                          the model's own self-assessment, never a measurement
                          against ChatGPT or Perplexity. */}
                      <p
                        className="text-[10px] text-slate-400 mb-1 cursor-help"
                        title="Model self-assessment — not measured against any answer engine"
                      >
                        est. visibility
                      </p>
                      <ProgressBar value={p.visibility_estimate} />
                    </div>
                  )}
                  <Button icon={Pencil} onClick={() => setEditing(p)} className="!px-2 !py-1.5" title="Edit" />
                  <Button variant="danger" icon={Trash2} onClick={() => del.mutate(p.id)} className="!px-2 !py-1.5" />
                </div>
              </div>

              {p.answer_ready_summary && (
                <div className="rounded-xl bg-rose-50/60 border border-rose-100 px-3.5 py-2.5 mb-3">
                  <p className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide mb-1">
                    Answer-ready summary
                  </p>
                  <p className="text-[12px] text-slate-700">{p.answer_ready_summary}</p>
                </div>
              )}

              <div className="grid gap-3 md:grid-cols-3">
                <Detail label="Question variants" items={p.question_variants} />
                <Detail label="Structured facts" items={p.structured_facts} />
                <Detail label="Weaknesses" items={p.weaknesses} tone="amber" />
              </div>

              {p.schema_suggestions?.length > 0 && (
                <div className="mt-3 pt-3 border-t border-[#EEF1F6] flex flex-wrap gap-1.5">
                  {p.schema_suggestions.map((s, i) => <Badge key={i} tone="blue">{s}</Badge>)}
                </div>
              )}

              <p className="text-[10px] text-slate-400 mt-3">{timeAgo(p.created_at)}</p>
            </Card>
          ))}
        </div>
      )}

      <ManualAeoModal open={manualOpen} onClose={() => setManualOpen(false)} />

      {editing && <EditAeoModal project={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Editable panels over each JSONB list.
 *
 *  AEO output is a first draft meant to be refined; before the PUT existed the
 *  first generation was permanent. Each list is one line per item — matching
 *  the array shape the schema actually stores, rather than inventing structure
 *  it doesn't have. */
function EditAeoModal({ project, onClose }) {
  const update = useUpdateAeoProject();
  const [form, setForm] = useState({
    name: project.name ?? '',
    target_url: project.target_url ?? '',
    answer_ready_summary: project.answer_ready_summary ?? '',
    structured_facts: (project.structured_facts ?? []).join('\n'),
    question_variants: (project.question_variants ?? []).join('\n'),
    schema_suggestions: (project.schema_suggestions ?? []).join('\n'),
    weaknesses: (project.weaknesses ?? []).join('\n'),
    visibility_estimate: project.visibility_estimate ?? '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const lines = (v) => v.split('\n').map((s) => s.trim()).filter(Boolean);

  const summaryWords = form.answer_ready_summary.trim().split(/\s+/).filter(Boolean).length;

  const submit = async () => {
    await update.mutateAsync({
      id: project.id,
      name: form.name.trim(),
      target_url: form.target_url.trim() || null,
      answer_ready_summary: form.answer_ready_summary.trim() || null,
      structured_facts: lines(form.structured_facts),
      question_variants: lines(form.question_variants),
      schema_suggestions: lines(form.schema_suggestions),
      weaknesses: lines(form.weaknesses),
      visibility_estimate:
        form.visibility_estimate === '' ? null : Number(form.visibility_estimate),
    });
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit AEO project"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <ErrorNote error={update.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Target URL">
        <Input value={form.target_url} onChange={set('target_url')} placeholder="https://…" />
      </Field>
      <Field
        label="Answer-ready summary"
        hint={`Must stand alone if quoted with no other context. ${summaryWords} words — aim for 40–60.`}
      >
        <Textarea rows={3} value={form.answer_ready_summary} onChange={set('answer_ready_summary')} />
      </Field>
      <Field label="Structured facts" hint="One per line. Each should be atomic and verifiable.">
        <Textarea rows={4} value={form.structured_facts} onChange={set('structured_facts')} />
      </Field>
      <Field label="Question variants" hint="One per line — how users actually phrase this.">
        <Textarea rows={3} value={form.question_variants} onChange={set('question_variants')} />
      </Field>
      <Field label="Schema markup suggestions" hint="One per line.">
        <Textarea rows={3} value={form.schema_suggestions} onChange={set('schema_suggestions')} />
      </Field>
      <Field label="Weaknesses" hint="One per line — why an answer engine might skip this.">
        <Textarea rows={3} value={form.weaknesses} onChange={set('weaknesses')} />
      </Field>
      <Field
        label="Visibility estimate (0–100)"
        hint="Model self-assessment. Not a measurement against any answer engine."
      >
        <Input
          type="number" min={0} max={100}
          value={form.visibility_estimate}
          onChange={set('visibility_estimate')}
        />
      </Field>
    </Modal>
  );
}

function Detail({ label, items, tone = 'slate' }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</p>
      {!items?.length ? (
        <p className="text-[11px] text-slate-300">None</p>
      ) : (
        <ul className="space-y-0.5">
          {items.slice(0, 5).map((it, i) => (
            <li key={i} className={`text-[11px] ${tone === 'amber' ? 'text-amber-700' : 'text-slate-600'}`}>
              · {typeof it === 'string' ? it : JSON.stringify(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ManualAeoModal({ open, onClose }) {
  const create = useCreateAeoProject();
  const [form, setForm] = useState({
    name: '', target_url: '', answer_ready_summary: '', structured_facts: [], question_variants: [],
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await create.mutateAsync({
      name: form.name.trim(),
      target_url: form.target_url.trim() || null,
      answer_ready_summary: form.answer_ready_summary.trim() || null,
      structured_facts: form.structured_facts,
      question_variants: form.question_variants,
    });
    setForm({ name: '', target_url: '', answer_ready_summary: '', structured_facts: [], question_variants: [] });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add AEO analysis"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} placeholder="Pricing page" />
      </Field>
      <Field label="Target URL">
        <Input value={form.target_url} onChange={set('target_url')} placeholder="https://example.com/pricing" />
      </Field>
      <Field label="Answer-ready summary" hint="40-60 words an AI engine could quote verbatim.">
        <Textarea value={form.answer_ready_summary} onChange={set('answer_ready_summary')} />
      </Field>
      <Field label="Structured facts" hint="Comma-separated.">
        <TagsInput
          value={form.structured_facts}
          onChange={(structured_facts) => setForm((f) => ({ ...f, structured_facts }))}
        />
      </Field>
      <Field label="Question variants" hint="Comma-separated.">
        <TagsInput
          value={form.question_variants}
          onChange={(question_variants) => setForm((f) => ({ ...f, question_variants }))}
        />
      </Field>
    </Modal>
  );
}
