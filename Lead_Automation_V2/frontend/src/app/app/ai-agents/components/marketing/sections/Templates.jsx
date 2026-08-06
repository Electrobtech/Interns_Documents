'use client';
/**
 * Templates — reusable message bodies at /ai-agents/marketing/templates.
 *
 * Variables are parsed out of the body ({{name}}) rather than typed twice, so
 * the stored list can't drift from the text it describes.
 */
import { useState } from 'react';
import { Layers, Plus, Trash2, Copy, Check, Loader2, Pencil } from 'lucide-react';

import {
  useTemplates, useCreateTemplate, useDeleteTemplate, useUpdateTemplate,
  CONTENT_TYPES, BROADCAST_CHANNELS,
} from '@/lib/queries/marketing';
import { Card, Badge, Button, EmptyState, SectionTitle } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip,
} from '../HubUI';
import { Modal, Field, Input, Textarea, Select, SearchInput, TagsInput, ErrorNote, timeAgo } from './Shared';

const TYPE_LABEL = Object.fromEntries(CONTENT_TYPES.map((t) => [t.value, t.label]));

const VAR_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function parseVariables(body) {
  return [...new Set([...body.matchAll(VAR_RE)].map((m) => m[1]))];
}

export default function Templates() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [editing, setEditing] = useState(null);

  const { data: rows = [], isLoading } = useTemplates({
    search: search || undefined,
    template_type: typeFilter || undefined,
  });
  const del = useDeleteTemplate();

  const copy = (t) => {
    navigator.clipboard?.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Templates"
        subtitle="Reusable message bodies with variables. Edit in place, not delete-and-recreate."
        count={rows.length}
      />

      <Toolbar
        right={
          <>
            <ToolSearch value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" />
            <div className="w-44">
              <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} options={CONTENT_TYPES} placeholder="All types" />
            </div>
          </>
        }
      >
        <Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)} className="!py-1.5 !px-3 !text-[12px]">
          New template
        </Button>
        <ToolButton icon={Pencil} disabled title="Hover a template card to edit it">Edit</ToolButton>
      </Toolbar>

      <StatsStrip
        items={[
          { label: 'Templates', value: rows.length, tone: 'violet' },
          { label: 'With variables', value: rows.filter((t) => t.variables?.length).length, tone: 'blue' },
          { label: 'WhatsApp', value: rows.filter((t) => t.channel === 'whatsapp').length, tone: 'green' },
          { label: 'Email', value: rows.filter((t) => t.channel === 'email').length, tone: 'amber' },
          { label: 'Usage', value: null, tone: 'slate', note: 'not tracked yet' },
        ]}
      />

      <Card className="p-4">
        <SectionTitle
          title="Templates"
          subtitle="Reusable message bodies with {{variables}}."
          action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New template</Button>}
        />
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search templates…" />
          <div className="w-48">
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              options={CONTENT_TYPES}
              placeholder="All types"
            />
          </div>
        </div>
      </Card>

      <ErrorNote error={del.error} />

      {isLoading ? (
        <Card className="p-10 flex justify-center text-slate-300"><Loader2 size={20} className="animate-spin" /></Card>
      ) : !rows.length ? (
        <Card className="p-5">
          <EmptyState
            icon={Layers}
            title="No templates yet"
            body="Save the messages you send repeatedly so you're not rewriting them each time."
            action={<Button variant="primary" icon={Plus} onClick={() => setCreateOpen(true)}>New template</Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} hover className="p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-[#0F1929] truncate">{t.name}</p>
                <Badge tone="violet">{TYPE_LABEL[t.template_type] || t.template_type}</Badge>
              </div>
              {t.subject && <p className="text-[11px] font-medium text-slate-500 mb-1">{t.subject}</p>}
              <p className="text-[12px] text-slate-600 line-clamp-5 whitespace-pre-wrap flex-1">{t.body}</p>

              {t.variables?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {t.variables.map((v) => (
                    <span key={v} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {`{{${v}}}`}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[#EEF1F6]">
                <span className="text-[10px] text-slate-400">
                  {t.channel ? `${t.channel} · ` : ''}
                  {/* usage_count has no writer yet — nothing increments it when
                      a template is consumed. Saying "not tracked" beats a
                      permanently-zero counter that looks measured. */}
                  <span title="No consumer increments this yet">usage not tracked</span>
                  {' · '}{timeAgo(t.created_at)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Button icon={Pencil} onClick={() => setEditing(t)} className="!px-2 !py-1.5" title="Edit" />
                  <Button icon={copiedId === t.id ? Check : Copy} onClick={() => copy(t)} className="!px-2 !py-1.5" />
                  <Button variant="danger" icon={Trash2} onClick={() => del.mutate(t.id)} className="!px-2 !py-1.5" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewTemplateModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {editing && <EditTemplateModal template={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

/** Edit in place. Templates were previously create-once: changing a word meant
 *  deleting and recreating, which threw away the row's id and any reference to
 *  it. Live preview substitutes sample values client-side — pure string
 *  templating over data already in hand, so no round trip. */
function EditTemplateModal({ template, onClose }) {
  const update = useUpdateTemplate();
  const [form, setForm] = useState({
    name: template.name ?? '',
    template_type: template.template_type ?? 'whatsapp',
    channel: template.channel ?? '',
    subject: template.subject ?? '',
    body: template.body ?? '',
    tags: template.tags ?? [],
  });
  const [samples, setSamples] = useState({});
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const variables = parseVariables(form.body);
  const preview = variables.reduce(
    (acc, v) => acc.replaceAll(`{{${v}}}`, samples[v] || `{{${v}}}`),
    form.body,
  );

  const submit = async () => {
    await update.mutateAsync({
      id: template.id,
      name: form.name.trim(),
      template_type: form.template_type,
      channel: form.channel || null,
      subject: form.subject.trim() || null,
      body: form.body,
      variables,
      tags: form.tags,
    });
    onClose();
  };

  const valid = form.name.trim() && form.body.trim();

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit template"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!valid || update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <ErrorNote error={update.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} />
      </Field>
      <Field label="Type" required>
        <Select value={form.template_type} onChange={set('template_type')} options={CONTENT_TYPES} />
      </Field>
      <Field label="Channel">
        <Select value={form.channel} onChange={set('channel')} options={BROADCAST_CHANNELS} placeholder="None" />
      </Field>
      {form.template_type === 'email' && (
        <Field label="Subject">
          <Input value={form.subject} onChange={set('subject')} />
        </Field>
      )}
      <Field label="Body" required hint="Use {{name}} for variables — they're detected automatically.">
        <Textarea rows={6} value={form.body} onChange={set('body')} />
      </Field>

      {variables.length > 0 && (
        <>
          <Field label="Sample values" hint="Preview only — never saved.">
            <div className="space-y-1.5">
              {variables.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 w-28 truncate">
                    {v}
                  </code>
                  <Input
                    value={samples[v] || ''}
                    onChange={(e) => setSamples((s) => ({ ...s, [v]: e.target.value }))}
                    placeholder={`e.g. ${v}`}
                  />
                </div>
              ))}
            </div>
          </Field>
          <Field label="Preview">
            <div className="text-[12px] text-slate-700 whitespace-pre-wrap rounded-xl border border-[#E4E8F0] bg-slate-50 p-3">
              {preview}
            </div>
          </Field>
        </>
      )}
    </Modal>
  );
}

function NewTemplateModal({ open, onClose }) {
  const create = useCreateTemplate();
  const [form, setForm] = useState({
    name: '', template_type: 'whatsapp', channel: '', subject: '', body: '', tags: [],
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const variables = parseVariables(form.body);

  const submit = async () => {
    await create.mutateAsync({
      name: form.name.trim(),
      template_type: form.template_type,
      channel: form.channel || null,
      subject: form.subject.trim() || null,
      body: form.body,
      variables,
      tags: form.tags,
    });
    setForm({ name: '', template_type: 'whatsapp', channel: '', subject: '', body: '', tags: [] });
    onClose();
  };

  const valid = form.name.trim() && form.body.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New template"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={!valid || create.isPending}>
            {create.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <ErrorNote error={create.error} />
      <Field label="Name" required>
        <Input value={form.name} onChange={set('name')} placeholder="Welcome message" />
      </Field>
      <Field label="Type" required>
        <Select value={form.template_type} onChange={set('template_type')} options={CONTENT_TYPES} />
      </Field>
      <Field label="Channel">
        <Select value={form.channel} onChange={set('channel')} options={BROADCAST_CHANNELS} placeholder="None" />
      </Field>
      {form.template_type === 'email' && (
        <Field label="Subject">
          <Input value={form.subject} onChange={set('subject')} />
        </Field>
      )}
      <Field label="Body" required hint="Use {{name}} for variables — they're detected automatically.">
        <Textarea rows={6} value={form.body} onChange={set('body')} placeholder="Hi {{name}}, welcome to {{company}}!" />
      </Field>
      {variables.length > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-2 mb-4">
          {variables.map((v) => (
            <span key={v} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">
              {`{{${v}}}`}
            </span>
          ))}
        </div>
      )}
      <Field label="Tags" hint="Comma-separated.">
        <TagsInput value={form.tags} onChange={(tags) => setForm((f) => ({ ...f, tags }))} />
      </Field>
    </Modal>
  );
}
