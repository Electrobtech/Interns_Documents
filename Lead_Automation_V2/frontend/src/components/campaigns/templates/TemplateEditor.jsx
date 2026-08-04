'use client';
import { useMemo, useState } from 'react';
import {
  Image as ImageIcon, Type, Ban, Upload, Plus, X, Smile, Variable,
  MessageSquareReply, Link2, Phone, AlertTriangle, Loader2, Save,
} from 'lucide-react';
import { useUploadTemplateMedia } from '@/lib/queries/templates';
import WhatsAppPreviewCard from './WhatsAppPreviewCard';

const CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
const LANGUAGES = [
  { value: 'en_US', label: 'English (US) - en_US' },
  { value: 'en_GB', label: 'English (UK) - en_GB' },
  { value: 'hi_IN', label: 'Hindi - hi_IN' },
  { value: 'es_ES', label: 'Spanish - es_ES' },
  { value: 'pt_BR', label: 'Portuguese (BR) - pt_BR' },
  { value: 'ar', label: 'Arabic - ar' },
];
const CHANNEL_OPTIONS = ['WhatsApp', 'RCS', 'SMS', 'Email'];
const HEADER_TYPES = [
  { value: 'NONE', label: 'None', icon: Ban },
  { value: 'TEXT', label: 'Text', icon: Type },
  { value: 'IMAGE', label: 'Media', icon: ImageIcon },
];
const EMOJIS = ['😀', '🎉', '🔥', '👍', '❤️', '📅', '✅', '🎁', '📢', '💬'];
const FOOTER_MAX = 60;

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Every {{1}}, {{2}}, … referenced in the body, in first-seen order — drives
// the "example value" inputs so the live preview can render realistic data.
function extractVariables(body) {
  const seen = [];
  const re = /\{\{\s*(\w+)\s*\}\}/g;
  let m;
  while ((m = re.exec(body || ''))) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

const emptyForm = {
  name: '', category: 'MARKETING', language: 'en_US', channels: ['WhatsApp'],
  header_type: 'NONE', header_text: '', header_media_url: '',
  body: '', body_variables: {}, footer: '',
  buttons: [],
};

/**
 * Shared creator/editor form. `initial` (a saved template row, snake_case
 * from the API) seeds edit mode; omit it for a fresh template. `onSubmit`
 * receives the same snake_case shape the API expects.
 */
export default function TemplateEditor({ initial, onSubmit, submitting, submitLabel = 'Save Template' }) {
  const [form, setForm] = useState(() => initial ? {
    name: initial.name || '',
    category: initial.category || 'MARKETING',
    language: initial.language || 'en_US',
    channels: (initial.channels || ['WHATSAPP']).map((c) =>
      CHANNEL_OPTIONS.find((o) => o.toUpperCase() === c) || c),
    header_type: initial.header_type || 'NONE',
    header_text: initial.header_text || '',
    header_media_url: initial.header_media_url || '',
    body: initial.body || '',
    body_variables: initial.body_variables || {},
    footer: initial.footer || '',
    buttons: initial.buttons || [],
  } : emptyForm);
  const [nameTouched, setNameTouched] = useState(!!initial);
  const [err, setErr] = useState('');

  const uploadMedia = useUploadTemplateMedia();

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const variables = useMemo(() => extractVariables(form.body), [form.body]);

  const toggleChannel = (ch) => {
    setForm((p) => ({
      ...p,
      channels: p.channels.includes(ch) ? p.channels.filter((c) => c !== ch) : [...p.channels, ch],
    }));
  };

  const insertVariable = () => {
    const next = variables.length + 1;
    set('body', `${form.body}${form.body.endsWith(' ') || !form.body ? '' : ' '}{{${next}}}`);
  };

  const insertEmoji = (emoji) => set('body', `${form.body}${emoji}`);

  const setVariableExample = (key, value) =>
    setForm((p) => ({ ...p, body_variables: { ...p.body_variables, [key]: value } }));

  const handleFile = async (file) => {
    if (!file) return;
    try {
      const result = await uploadMedia.mutateAsync(file);
      set('header_media_url', result.url);
    } catch (ex) {
      setErr(ex.message || 'Upload failed');
    }
  };

  const addButton = (type) => {
    if (form.buttons.length >= 3) return;
    setForm((p) => ({ ...p, buttons: [...p.buttons, { type, text: '', value: '' }] }));
  };
  const updateButton = (i, patch) => {
    setForm((p) => ({ ...p, buttons: p.buttons.map((b, idx) => idx === i ? { ...b, ...patch } : b) }));
  };
  const removeButton = (i) => setForm((p) => ({ ...p, buttons: p.buttons.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.name.trim()) return setErr('Template name is required.');
    if (!form.body.trim()) return setErr('Body text is required.');
    if (form.header_type === 'IMAGE' && !form.header_media_url.trim()) {
      return setErr('Upload an image or paste an image URL for the header.');
    }
    try {
      await onSubmit({
        name: slugify(form.name),
        category: form.category,
        language: form.language,
        channels: form.channels.map((c) => c.toUpperCase()),
        header_type: form.header_type,
        header_text: form.header_type === 'TEXT' ? form.header_text : null,
        header_media_url: form.header_type === 'IMAGE' ? form.header_media_url : null,
        body: form.body,
        body_variables: form.body_variables,
        footer: form.footer || null,
        buttons: form.buttons,
      });
    } catch (ex) {
      setErr(ex.message || 'Failed to save template');
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 xl:grid-cols-5 gap-6 items-start">
      {/* LEFT: form */}
      <div className="xl:col-span-3 space-y-5">

        {/* Metadata */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Template Details</h3>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Template Name *</label>
            <input
              value={form.name}
              onChange={(e) => { set('name', e.target.value); setNameTouched(true); }}
              placeholder="e.g. College Broadcast 17 6 26"
              className="input-premium"
            />
            {nameTouched && form.name && (
              <p className="text-[11px] text-slate-400 mt-1">Saved as: <span className="font-mono text-violet-600">{slugify(form.name)}</span></p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
              <select value={form.category} onChange={(e) => set('category', e.target.value)} className="input-premium">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Language</label>
              <select value={form.language} onChange={(e) => set('language', e.target.value)} className="input-premium">
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Channel Tags</label>
            <div className="flex flex-wrap gap-2">
              {CHANNEL_OPTIONS.map((ch) => {
                const active = form.channels.includes(ch);
                return (
                  <button
                    type="button"
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      active
                        ? 'bg-violet-600 text-white border-violet-600'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-violet-300'
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Header */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Header</h3>
          <div className="flex gap-2">
            {HEADER_TYPES.map(({ value, label, icon: Icon }) => (
              <button
                type="button"
                key={value}
                onClick={() => set('header_type', value)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
                  form.header_type === value
                    ? 'bg-violet-50 text-violet-700 border-violet-200'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-violet-200'
                }`}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>

          {form.header_type === 'TEXT' && (
            <input
              value={form.header_text}
              onChange={(e) => set('header_text', e.target.value)}
              placeholder="Header text"
              maxLength={60}
              className="input-premium"
            />
          )}

          {form.header_type === 'IMAGE' && (
            <div className="space-y-2">
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 rounded-xl py-6 cursor-pointer hover:border-violet-300 hover:bg-violet-50/30 transition-colors">
                {uploadMedia.isPending ? (
                  <Loader2 size={20} className="text-violet-500 animate-spin" />
                ) : (
                  <Upload size={20} className="text-slate-300" />
                )}
                <span className="text-xs font-medium text-slate-500">
                  {uploadMedia.isPending ? 'Uploading…' : 'Click to upload or drag an image'}
                </span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              <input
                value={form.header_media_url}
                onChange={(e) => set('header_media_url', e.target.value)}
                placeholder="…or paste an image URL"
                className="input-premium text-xs"
              />
            </div>
          )}
        </section>

        {/* Body */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Body</h3>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={insertVariable}
                title="Insert variable"
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-50 px-2 py-1 rounded-lg transition-colors">
                <Variable size={12} /> {'{{ }}'}
              </button>
              <div className="relative group">
                <button type="button"
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors">
                  <Smile size={12} /> Emoji
                </button>
                <div className="hidden group-hover:flex absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-card-lg border border-slate-200 p-2 gap-1 flex-wrap w-48">
                  {EMOJIS.map((em) => (
                    <button type="button" key={em} onClick={() => insertEmoji(em)}
                      className="text-lg hover:scale-125 transition-transform">{em}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <textarea
            rows={6}
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={'Write your message… use {{1}}, {{2}} for dynamic variables.'}
            className="input-premium resize-none"
          />

          {variables.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Example values (for preview)</p>
              {variables.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-violet-600 bg-violet-50 px-2 py-1.5 rounded-lg shrink-0">{`{{${v}}}`}</span>
                  <input
                    value={form.body_variables[v] || ''}
                    onChange={(e) => setVariableExample(v, e.target.value)}
                    placeholder={`Example for {{${v}}}`}
                    className="input-premium"
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-2">
          <h3 className="text-sm font-bold text-slate-800">Footer</h3>
          <input
            value={form.footer}
            onChange={(e) => set('footer', e.target.value.slice(0, FOOTER_MAX))}
            placeholder="Optional muted text, e.g. Reply STOP to unsubscribe"
            className="input-premium"
          />
          <p className="text-[11px] text-slate-400 text-right">{form.footer.length}/{FOOTER_MAX}</p>
        </section>

        {/* Buttons */}
        <section className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Buttons</h3>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={form.buttons.length >= 3} onClick={() => addButton('QUICK_REPLY')}
                className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:bg-violet-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40">
                <MessageSquareReply size={12} /> Quick Reply
              </button>
              <button type="button" disabled={form.buttons.length >= 3} onClick={() => addButton('URL')}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40">
                <Link2 size={12} /> URL
              </button>
              <button type="button" disabled={form.buttons.length >= 3} onClick={() => addButton('PHONE_NUMBER')}
                className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 px-2 py-1 rounded-lg transition-colors disabled:opacity-40">
                <Phone size={12} /> Phone
              </button>
            </div>
          </div>

          {form.buttons.length === 0 ? (
            <p className="text-xs text-slate-400">No buttons — e.g. add a Quick Reply like &quot;Interested&quot;.</p>
          ) : (
            <div className="space-y-2">
              {form.buttons.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 w-20 shrink-0 uppercase">{b.type.replace('_', ' ')}</span>
                  <input
                    value={b.text}
                    onChange={(e) => updateButton(i, { text: e.target.value })}
                    placeholder="Button text"
                    maxLength={25}
                    className="input-premium"
                  />
                  {b.type !== 'QUICK_REPLY' && (
                    <input
                      value={b.value}
                      onChange={(e) => updateButton(i, { value: e.target.value })}
                      placeholder={b.type === 'URL' ? 'https://…' : '+1…'}
                      className="input-premium"
                    />
                  )}
                  <button type="button" onClick={() => removeButton(i)} className="p-2 text-slate-300 hover:text-red-500 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {err && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
            <AlertTriangle size={14} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{err}</p>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          <Save size={14} /> {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>

      {/* RIGHT: live preview */}
      <div className="xl:col-span-2 xl:sticky xl:top-6 space-y-3">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide px-1">Live Preview</p>
        <WhatsAppPreviewCard template={form} />
      </div>
    </form>
  );
}
