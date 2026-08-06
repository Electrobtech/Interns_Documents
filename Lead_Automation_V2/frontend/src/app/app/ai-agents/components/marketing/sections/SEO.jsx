'use client';
/**
 * SEO — projects and tracked keywords, persisted at /ai-agents/marketing/seo/*.
 *
 * `data_source` is shown on every keyword because it matters whether a term
 * came from the agent's inference or from real Search Console data. Volume,
 * difficulty, and rank stay blank until a real data source fills them — an
 * invented search volume is worse than an empty cell.
 */
import { useState } from 'react';
import { Search, Plus, Loader2, ChevronRight, Trash2, ClipboardCheck } from 'lucide-react';

import {
  useSeoProjects, useCreateSeoProject, useSeoKeywords, useAddSeoKeyword,
  useUpdateSeoProject, useUpdateSeoKeyword, useDeleteSeoKeyword, KEYWORD_INTENTS,
} from '@/lib/queries/marketing';
import { Card, Badge, Button, EmptyState, SectionTitle, fmt } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import { AIPanel, Modal, Field, Input, Select, TagsInput, ErrorNote, fmtDate } from './Shared';

const PRIORITY_TONE = { high: 'red', medium: 'amber', low: 'slate' };
const SOURCE_TONE = { ai_inferred: 'violet', manual: 'slate', search_console: 'green' };

export default function SEO() {
  const [projectOpen, setProjectOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);

  const { data: projects = [], isLoading } = useSeoProjects();
  const active = projects.find((p) => p.id === activeId) || projects[0] || null;
  const addKeyword = useAddSeoKeyword();

  // Averaged over projects that actually have a score. Averaging in the
  // unaudited ones as zero would drag it down and read as a real decline.
  const scored = projects.filter((p) => p.latest_score != null);
  const avgScore = scored.length
    ? Math.round(scored.reduce((sum, p) => sum + p.latest_score, 0) / scored.length)
    : null;

  const saveKeywordsFromAI = async (out) => {
    if (!active) return;
    const terms = out?.primary_keywords || out?.keywords || out?.target_keywords || [];
    for (const k of terms) {
      const term = typeof k === 'string' ? k : k.term || k.keyword;
      if (!term) continue;
      await addKeyword.mutateAsync({
        projectId: active.id,
        term,
        intent: typeof k === 'object' ? k.intent || null : null,
        priority: typeof k === 'object' ? k.priority || null : null,
        rationale: typeof k === 'object' ? k.rationale || null : null,
        data_source: 'ai_inferred',
      });
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="SEO"
        subtitle="Projects and tracked keywords. Volume and difficulty stay blank until a keyword tool is connected."
        count={projects.length}
      />

      <Toolbar
        right={<span className="text-[11px] text-slate-400">Volume &amp; difficulty need a keyword tool</span>}
      >
        <Button variant="primary" icon={Plus} onClick={() => setProjectOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          New project
        </Button>
        <ToolButton icon={ClipboardCheck} disabled={!active} onClick={() => active && setProjectOpen(false)}>
          Record audit
        </ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Projects', value: projects.length, tone: 'violet' },
          { label: 'Keywords', value: projects.reduce((s, p) => s + (p.keyword_count || 0), 0), tone: 'blue' },
          { label: 'Audited', value: projects.filter((p) => p.last_audit_at).length, tone: 'green' },
          { label: 'Avg score', value: avgScore, tone: 'amber' },
          { label: 'Search volume', value: null, tone: 'slate', note: 'needs a keyword tool' },
        ]}
      />

      <AIPanel
        capability="seo"
        placeholder="e.g. Build an SEO keyword plan for WhatsApp lead automation targeting mid-market SaaS"
        examples={['Keyword plan for lead automation', 'Content brief for a pillar page']}
        onSave={active ? saveKeywordsFromAI : undefined}
        saving={addKeyword.isPending}
        saveLabel={active ? `Save keywords to "${active.name}"` : 'Save'}
        renderResult={(out) => (
          <div className="space-y-3">
            {(out?.primary_keywords || out?.keywords || []).length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Keywords</p>
                <div className="flex flex-wrap gap-1.5">
                  {(out.primary_keywords || out.keywords).map((k, i) => (
                    <Badge key={i} tone="violet">{typeof k === 'string' ? k : k.term || k.keyword}</Badge>
                  ))}
                </div>
              </div>
            )}
            {out?.content_brief && (
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Brief</p>
                <p className="text-[12px] text-slate-700 whitespace-pre-wrap">
                  {typeof out.content_brief === 'string' ? out.content_brief : JSON.stringify(out.content_brief, null, 2)}
                </p>
              </div>
            )}
            {!active && (
              <p className="text-[11px] text-amber-600">
                Create a project below before saving keywords.
              </p>
            )}
          </div>
        )}
      />

      <Card className="p-4">
        <SectionTitle
          title="SEO projects"
          subtitle="One per site or property you're optimizing."
          action={<Button icon={Plus} onClick={() => setProjectOpen(true)}>New project</Button>}
        />
        {isLoading ? (
          <div className="py-6 flex justify-center text-slate-300"><Loader2 size={18} className="animate-spin" /></div>
        ) : !projects.length ? (
          <EmptyState
            icon={Search}
            title="No SEO projects yet"
            body="A project groups the keywords you track for one domain."
            action={<Button variant="primary" icon={Plus} onClick={() => setProjectOpen(true)}>New project</Button>}
          />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveId(p.id)}
                className={`text-left rounded-xl border px-3.5 py-3 transition-all ${
                  active?.id === p.id
                    ? 'border-rose-300 bg-rose-50/50'
                    : 'border-[#E4E8F0] hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#0F1929] truncate">{p.name}</p>
                  <ChevronRight size={14} className="text-slate-300 flex-shrink-0" />
                </div>
                <p className="text-[11px] text-slate-400 truncate">{p.domain || 'No domain set'}</p>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                  <span>{p.keyword_count} keyword{p.keyword_count === 1 ? '' : 's'}</span>
                  <span>score {fmt(p.latest_score)}</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Last audit {p.last_audit_at ? fmtDate(p.last_audit_at) : 'never'}
                </p>
              </button>
            ))}
          </div>
        )}
      </Card>

      {active && <KeywordTable project={active} />}

      <NewProjectModal open={projectOpen} onClose={() => setProjectOpen(false)} />
    </div>
  );
}

/** Inline-editable rank. Only this column is writable: the others have no
 *  source, and letting a user type a search volume would manufacture data. */
function RankCell({ projectId, keyword }) {
  const update = useUpdateSeoKeyword();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(keyword.current_rank ?? '');

  const save = async () => {
    setEditing(false);
    const n = value === '' ? null : Number(value);
    if (n === keyword.current_rank) return;
    if (n !== null && (!Number.isFinite(n) || n < 1)) return;
    await update.mutateAsync({ projectId, keywordId: keyword.id, current_rank: n });
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        title="Click to set the rank you see in Search Console"
        className="font-mono text-[12px] text-slate-500 hover:text-rose-600"
      >
        {fmt(keyword.current_rank)}
      </button>
    );
  }
  return (
    <input
      autoFocus
      type="number"
      min={1}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { setValue(keyword.current_rank ?? ''); setEditing(false); }
      }}
      className="w-16 font-mono text-[12px] px-1.5 py-0.5 rounded border border-rose-300 outline-none"
    />
  );
}

function KeywordTable({ project }) {
  const { data: keywords = [], isLoading } = useSeoKeywords(project.id);
  const [open, setOpen] = useState(false);
  const [auditOpen, setAuditOpen] = useState(false);
  const del = useDeleteSeoKeyword();

  return (
    <>
      <Card className="p-0 overflow-hidden">
        <div className="px-4 pt-4">
          <SectionTitle
            title={`Keywords — ${project.name}`}
            subtitle="Volume and difficulty stay blank until a keyword tool is connected. Rank is editable."
            action={
              <div className="flex items-center gap-1.5">
                <Button icon={ClipboardCheck} onClick={() => setAuditOpen(true)}>Record audit</Button>
                <Button icon={Plus} onClick={() => setOpen(true)}>Add keyword</Button>
              </div>
            }
          />
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center text-slate-300"><Loader2 size={18} className="animate-spin" /></div>
        ) : !keywords.length ? (
          <div className="px-4 pb-4"><EmptyState icon={Search} title="No keywords tracked yet" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="border-b border-[#EEF1F6]">
                  {['Keyword', 'Intent', 'Priority', 'Volume', 'Difficulty', 'Rank', 'Source', ''].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keywords.map((k) => (
                  <tr key={k.id} className="border-b border-[#F4F6FA] last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#0F1929]">{k.term}</p>
                      {k.rationale && <p className="text-[11px] text-slate-400 truncate max-w-[280px]">{k.rationale}</p>}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-600">{k.intent || '—'}</td>
                    <td className="px-4 py-3">
                      {k.priority ? <Badge tone={PRIORITY_TONE[k.priority]}>{k.priority}</Badge> : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-500" title="No keyword tool is connected">
                      {fmt(k.search_volume)}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-slate-500" title="No keyword tool is connected">
                      {fmt(k.difficulty)}
                    </td>
                    {/* Rank is the one number a human plausibly knows, from
                        reading Search Console — so it's the one that's editable.
                        Saving it flips data_source to "manual", which is why the
                        Source badge sits right beside it. */}
                    <td className="px-4 py-3">
                      <RankCell projectId={project.id} keyword={k} />
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={SOURCE_TONE[k.data_source] || 'slate'}>{k.data_source.replace('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="danger" icon={Trash2}
                        onClick={() => del.mutate({ projectId: project.id, keywordId: k.id })}
                        className="!px-2 !py-1"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AddKeywordModal open={open} onClose={() => setOpen(false)} projectId={project.id} />
      <RecordAuditModal open={auditOpen} onClose={() => setAuditOpen(false)} project={project} />
    </>
  );
}

/** Writes `latest_score` + `last_audit_at` back to the project.
 *
 *  Without this the project showed "never audited" no matter how many times
 *  the `seo` capability had been run against it — there was no PUT to write
 *  the result anywhere. */
function RecordAuditModal({ open, onClose, project }) {
  const update = useUpdateSeoProject();
  const [score, setScore] = useState(project.latest_score ?? '');

  const submit = async () => {
    const n = Number(score);
    if (!Number.isFinite(n) || n < 0 || n > 100) return;
    await update.mutateAsync({ id: project.id, latest_score: Math.round(n), mark_audited: true });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record an audit"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={score === '' || update.isPending}>
            {update.isPending ? 'Saving…' : 'Record'}
          </Button>
        </>
      }
    >
      <ErrorNote error={update.error} />
      <Field label="Score (0–100)" required hint="Stamps the audit date so “last audited” stops being stale.">
        <Input type="number" min={0} max={100} value={score} onChange={(e) => setScore(e.target.value)} />
      </Field>
    </Modal>
  );
}

function NewProjectModal({ open, onClose }) {
  const create = useCreateSeoProject();
  const [form, setForm] = useState({ name: '', domain: '', target_keywords: [] });

  const submit = async () => {
    await create.mutateAsync({
      name: form.name.trim(),
      domain: form.domain.trim() || null,
      target_keywords: form.target_keywords,
    });
    setForm({ name: '', domain: '', target_keywords: [] });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New SEO project"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Main website" />
      </Field>
      <Field label="Domain">
        <Input value={form.domain} onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))} placeholder="example.com" />
      </Field>
      <Field label="Target keywords" hint="Comma-separated.">
        <TagsInput
          value={form.target_keywords}
          onChange={(target_keywords) => setForm((f) => ({ ...f, target_keywords }))}
          placeholder="lead automation, whatsapp crm"
        />
      </Field>
    </Modal>
  );
}

function AddKeywordModal({ open, onClose, projectId }) {
  const add = useAddSeoKeyword();
  const [form, setForm] = useState({ term: '', intent: '', priority: '', rationale: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    await add.mutateAsync({
      projectId,
      term: form.term.trim(),
      intent: form.intent || null,
      priority: form.priority || null,
      rationale: form.rationale.trim() || null,
      data_source: 'manual',
    });
    setForm({ term: '', intent: '', priority: '', rationale: '' });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add keyword"
      subtitle="Saved as a manual entry, distinct from AI-inferred terms."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!form.term.trim() || add.isPending}>
            {add.isPending ? 'Adding…' : 'Add'}
          </Button>
        </>
      }
    >
      <ErrorNote error={add.error} />
      <Field label="Keyword" required>
        <Input value={form.term} onChange={set('term')} placeholder="whatsapp lead automation" />
      </Field>
      <Field label="Intent">
        <Select value={form.intent} onChange={set('intent')} options={KEYWORD_INTENTS} placeholder="Not set" />
      </Field>
      <Field label="Priority">
        <Select
          value={form.priority}
          onChange={set('priority')}
          options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]}
          placeholder="Not set"
        />
      </Field>
      <Field label="Why this keyword">
        <Input value={form.rationale} onChange={set('rationale')} placeholder="High commercial intent, low competition" />
      </Field>
    </Modal>
  );
}
