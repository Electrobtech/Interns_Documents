'use client';
import { useMemo, useState } from 'react';
import {
  Package, Plus, Star, Archive, ArchiveRestore, Pencil, X,
  AlertTriangle, Tag, Link as LinkIcon, Sparkles, Loader2,
} from 'lucide-react';
import {
  useProducts, useCreateProduct, useUpdateProduct, useArchiveProduct,
} from '@/lib/queries/products';

// Products / Offers — what the org actually sells. Owned by campaign-service
// (services/campaign-service/src/products.js); the Sales Agent's Revenue
// Targets + Pipeline-by-Product views (SalesWorkspace.jsx) and the Marketing
// Agent both read this list via useProducts(), so a product created here
// shows up there immediately.

const STATUS_TABS = [
  { key: 'active', label: 'Active' },
  { key: 'draft', label: 'Draft' },
  { key: 'archived', label: 'Archived' },
  { key: '', label: 'All' },
];

const STATUS_BADGE = {
  active: 'badge-emerald',
  draft: 'badge-amber',
  archived: 'badge-slate',
};

function money(p) {
  if (p.price_display) return p.price_display;
  if (p.price_amount != null) {
    const amt = Number(p.price_amount).toLocaleString();
    return `${p.currency || 'INR'} ${amt}${p.billing_period ? ` / ${p.billing_period}` : ''}`;
  }
  return null;
}

/* ─── array-field textarea: one item per line, joined/split on save ───── */
function ListField({ label, hint, value, onChange }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
        {label}
      </label>
      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={hint || 'One per line'}
        className="input-premium resize-none text-sm"
      />
    </div>
  );
}

const EMPTY_FORM = {
  name: '', category: '', status: 'active', tagline: '', description: '',
  price_display: '', price_amount: '', currency: 'INR', billing_period: '',
  value_props: '', target_segments: '', objections: '', differentiators: '',
  keywords: '', tone: '', claims_to_avoid: '', landing_url: '', is_primary: false,
};

const ARRAY_KEYS = ['value_props', 'target_segments', 'objections', 'differentiators', 'keywords', 'claims_to_avoid'];

function toFormState(p) {
  if (!p) return { ...EMPTY_FORM };
  const f = { ...EMPTY_FORM, ...p };
  ARRAY_KEYS.forEach((k) => { f[k] = Array.isArray(p[k]) ? p[k].join('\n') : (p[k] || ''); });
  f.price_amount = p.price_amount ?? '';
  f.is_primary = !!p.is_primary;
  return f;
}

function toBody(f) {
  const body = { ...f };
  ARRAY_KEYS.forEach((k) => {
    body[k] = f[k].split(/[\n,]/).map((v) => v.trim()).filter(Boolean);
  });
  body.price_amount = f.price_amount === '' ? null : Number(f.price_amount);
  return body;
}

/* ─── create/edit slide-over ───────────────────────────────────────── */
function ProductDrawer({ product, onClose }) {
  const isEdit = !!product;
  const create = useCreateProduct();
  const update = useUpdateProduct();
  const [form, setForm] = useState(() => toFormState(product));
  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const mutation = isEdit ? update : create;

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const body = toBody(form);
    const action = isEdit ? { id: product.id, ...body } : body;
    mutation.mutate(action, { onSuccess: onClose });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto animate-slide-in-right">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center gap-3 z-10">
          <div className="icon-wrap-violet w-9 h-9 shrink-0"><Package size={16} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-slate-800">{isEdit ? 'Edit Product / Offer' : 'New Product / Offer'}</p>
            <p className="text-[11px] text-slate-400">Grounds the Marketing & Sales Agents in real pricing and positioning</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 shrink-0">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-5">
          {/* Basics */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Name *</label>
                <input required value={form.name} onChange={(e) => set('name', e.target.value)}
                  placeholder="e.g. Growth Plan" className="input-premium" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Category</label>
                <input value={form.category} onChange={(e) => set('category', e.target.value)}
                  placeholder="e.g. Subscription" className="input-premium" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Status</label>
                <select value={form.status} onChange={(e) => set('status', e.target.value)} className="input-premium">
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tagline</label>
              <input value={form.tagline} onChange={(e) => set('tagline', e.target.value)}
                placeholder="One line a rep can say out loud" className="input-premium" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)}
                className="input-premium resize-none text-sm" />
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={form.is_primary} onChange={(e) => set('is_primary', e.target.checked)}
                className="rounded accent-violet-600" />
              Set as primary offer (used as the default when nothing else fits)
            </label>
          </div>

          <div className="section-divider" />

          {/* Pricing */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pricing</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Display price</label>
                <input value={form.price_display} onChange={(e) => set('price_display', e.target.value)}
                  placeholder="e.g. ₹4,999/mo — shown as-is if set" className="input-premium" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Amount</label>
                <input type="number" min="0" step="0.01" value={form.price_amount}
                  onChange={(e) => set('price_amount', e.target.value)} className="input-premium" />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Currency</label>
                <input value={form.currency} onChange={(e) => set('currency', e.target.value)} className="input-premium" />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Billing period</label>
                <input value={form.billing_period} onChange={(e) => set('billing_period', e.target.value)}
                  placeholder="e.g. monthly, yearly, one_time" className="input-premium" />
              </div>
            </div>
          </div>

          <div className="section-divider" />

          {/* Sales enablement */}
          <div className="space-y-3">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Sales &amp; Marketing Enablement</p>
            <ListField label="Value props" value={form.value_props} onChange={(v) => set('value_props', v)} />
            <ListField label="Target segments" value={form.target_segments} onChange={(v) => set('target_segments', v)} />
            <ListField label="Common objections" value={form.objections} onChange={(v) => set('objections', v)} />
            <ListField label="Differentiators" value={form.differentiators} onChange={(v) => set('differentiators', v)} />
            <ListField label="Keywords" value={form.keywords} onChange={(v) => set('keywords', v)} />
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Tone</label>
              <input value={form.tone} onChange={(e) => set('tone', e.target.value)}
                placeholder="e.g. confident, friendly, technical" className="input-premium" />
            </div>
            <ListField label="Claims to avoid" hint="Compliance guardrails — one per line" value={form.claims_to_avoid} onChange={(v) => set('claims_to_avoid', v)} />
            <div>
              <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Landing URL</label>
              <input value={form.landing_url} onChange={(e) => set('landing_url', e.target.value)}
                placeholder="https://…" className="input-premium" />
            </div>
          </div>

          {mutation.isError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
              <AlertTriangle size={13} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600">{mutation.error?.message}</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1 pb-2">
            <button type="button" onClick={onClose} className="btn-ghost btn-sm">Cancel</button>
            <button type="submit" disabled={mutation.isPending || !form.name.trim()} className="btn-primary btn-sm">
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── card ──────────────────────────────────────────────────────────── */
function ProductCard({ product, onEdit }) {
  const update = useUpdateProduct();
  const archive = useArchiveProduct();
  const price = money(product);
  const archived = product.status === 'archived';

  return (
    <div className="card-hover p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 truncate">{product.name}</h3>
            {product.is_primary && <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />}
          </div>
          {product.category && (
            <p className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
              <Tag size={10} /> {product.category}
            </p>
          )}
        </div>
        <span className={STATUS_BADGE[product.status] || 'badge-slate'}>{product.status || 'active'}</span>
      </div>

      {product.tagline && <p className="text-xs text-slate-500 leading-snug">{product.tagline}</p>}
      {price && <p className="text-sm font-semibold text-slate-700">{price}</p>}
      {product.landing_url && (
        <a href={product.landing_url} target="_blank" rel="noreferrer"
          className="flex items-center gap-1 text-[11px] text-violet-600 hover:underline truncate">
          <LinkIcon size={10} className="shrink-0" /> <span className="truncate">{product.landing_url}</span>
        </a>
      )}

      <div className="flex items-center gap-1.5 pt-2 mt-auto border-t border-slate-100">
        <button onClick={() => onEdit(product)}
          className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-violet-600 px-2 py-1 rounded-lg hover:bg-violet-50">
          <Pencil size={11} /> Edit
        </button>
        {!product.is_primary && !archived && (
          <button onClick={() => update.mutate({ id: product.id, is_primary: true })} disabled={update.isPending}
            className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-amber-600 px-2 py-1 rounded-lg hover:bg-amber-50">
            <Star size={11} /> Set primary
          </button>
        )}
        <div className="ml-auto">
          {archived ? (
            <button onClick={() => update.mutate({ id: product.id, status: 'active' })} disabled={update.isPending}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg hover:bg-emerald-50">
              <ArchiveRestore size={11} /> Restore
            </button>
          ) : (
            <button onClick={() => { if (confirm(`Archive "${product.name}"? Campaigns/leads that reference it keep the name.`)) archive.mutate(product.id); }}
              disabled={archive.isPending}
              className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
              <Archive size={11} /> Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── page ──────────────────────────────────────────────────────────── */
export default function ProductsPage() {
  const [statusFilter, setStatusFilter] = useState('active');
  const { data, isLoading, error } = useProducts(statusFilter || undefined);
  const [drawer, setDrawer] = useState(null); // null = closed, {} = new, product = edit
  const products = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="icon-wrap-violet w-9 h-9"><Package size={17} /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Products &amp; Offers</h2>
            <p className="text-xs text-slate-400">What you sell — powers Sales targets, Forecasting, and AI-generated content</p>
          </div>
        </div>
        <button onClick={() => setDrawer({})} className="btn-primary btn-sm">
          <Plus size={14} /> New Product
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {STATUS_TABS.map((t) => (
          <button key={t.key} onClick={() => setStatusFilter(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              statusFilter === t.key ? 'bg-violet-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-100 rounded-xl">
          <AlertTriangle size={13} className="text-red-500 shrink-0" />
          <p className="text-xs text-red-600">{error.message}</p>
        </div>
      )}

      {isLoading ? (
        <div className="text-xs text-slate-400 py-12 text-center">Loading products…</div>
      ) : products.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <div className="p-4 rounded-2xl bg-slate-50 mb-3"><Package size={22} className="text-slate-300" /></div>
          <p className="text-sm font-medium text-slate-500">No {statusFilter || ''} products yet</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            Add what you sell so leads can be tracked per product, revenue targets can be set per offer,
            and the AI agents ground their content in real pricing.
          </p>
          <button onClick={() => setDrawer({})} className="btn-primary btn-sm mt-4">
            <Plus size={14} /> New Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {products.map((p) => <ProductCard key={p.id} product={p} onEdit={setDrawer} />)}
        </div>
      )}

      {drawer !== null && (
        <ProductDrawer product={drawer.id ? drawer : null} onClose={() => setDrawer(null)} />
      )}
    </div>
  );
}
