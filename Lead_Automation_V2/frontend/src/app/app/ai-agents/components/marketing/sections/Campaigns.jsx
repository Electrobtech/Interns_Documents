'use client';
/**
 * Campaigns — the enterprise Campaign Manager view.
 *
 * Layout, controls, and states follow the Campaign Manager spec: grouped
 * header actions, Ctrl+K search, dense rows with hover quick-actions, sticky
 * bulk bar, full row menu, saved views, a column customizer, and undo toasts
 * on destructive actions.
 *
 * Columns with no data source in this deployment (CTR, CPC, Spend, AI score,
 * owner) render an explicit em-dash with a tooltip rather than a number. No ad
 * account is connected, so there is nothing to measure — and a fabricated
 * figure is indistinguishable from a real one once it is on screen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Search, Filter, RefreshCw, Copy, Pause, Play, Archive, Trash2,
  MoreVertical, ChevronLeft, ChevronRight, Megaphone, AlertTriangle, Download,
  Upload, Sparkles, Eye, Pencil, BarChart2, Columns3, X, Bookmark, ExternalLink,
  List, LayoutGrid, Kanban,
} from 'lucide-react';

import {
  useCampaigns, useDuplicateCampaign, useCampaignStatus, useDeleteCampaign,
  OBJECTIVES, PLATFORMS, STATUSES, NEXT_STATUSES,
} from '@/lib/queries/campaigns';
import { Card, Badge, Button, EmptyState, fmt } from '../MarketingUI';
import {
  PageHeader, Toolbar, ToolButton, ToolSearch, StatsStrip, ViewSwitcher,
} from '../HubUI';
import { CardView, KanbanView } from '../CampaignViews';
import {
  Menu, SplitButton, ConfirmDialog, Skeleton, NoSource, useToast, timeAgo,
} from './Shared';
import CampaignWizard from '@/app/app/ai-agents/components/marketing/CampaignWizard';
import CampaignDetailDrawer from '@/app/app/ai-agents/components/marketing/CampaignDetailDrawer';

const STATUS_TONE = Object.fromEntries(STATUSES.map((s) => [s.value, s.tone]));
const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));
const OBJECTIVE_LABEL = Object.fromEntries(OBJECTIVES.map((o) => [o.value, o.label]));
const PLATFORM_LABEL = Object.fromEntries(PLATFORMS.map((p) => [p.value, p.label]));

// Two-letter platform marks. Real brand logos would need licensed assets;
// initials stay legible at 20px and carry the full name in a tooltip.
const PLATFORM_MARK = {
  facebook: 'Fb', instagram: 'Ig', linkedin: 'In', google_ads: 'Ga', whatsapp: 'Wa',
  messenger: 'Ms', telegram: 'Tg', email: 'Em', sms: 'Sm', web_push: 'Wp',
};

const ALL_COLUMNS = [
  { key: 'platforms', label: 'Platforms', always: false },
  { key: 'objective', label: 'Objective' },
  { key: 'status', label: 'Status' },
  { key: 'kpis', label: 'Performance' },
  { key: 'budget', label: 'Budget' },
  { key: 'owner', label: 'Owner' },
  { key: 'ai', label: 'AI score' },
  { key: 'updated', label: 'Updated' },
];

const PAGE_SIZE = 50;
const VIEWS_KEY = 'orbq.campaigns.savedViews';
const COLS_KEY = 'orbq.campaigns.columns';

function loadLocal(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Quotes every field — a campaign name containing a comma would otherwise
 *  shift every column after it. */
function exportCsv(rows) {
  const cols = ['name', 'status', 'objective', 'platforms', 'budget_amount', 'currency', 'created_at'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [
    cols.join(','),
    ...rows.map((r) => cols.map((c) => esc(Array.isArray(r[c]) ? r[c].join(' ') : r[c])).join(',')),
  ].join('\n');
  download(new Blob([csv], { type: 'text/csv' }), `campaigns-${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportJson(rows) {
  download(
    new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' }),
    `campaigns-${new Date().toISOString().slice(0, 10)}.json`,
  );
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Campaigns() {
  const toast = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [objectiveFilter, setObjectiveFilter] = useState([]);
  const [platformFilter, setPlatformFilter] = useState([]);
  const [page, setPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [view, setView] = useState('table');
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [columns, setColumns] = useState(() =>
    loadLocal(COLS_KEY, Object.fromEntries(ALL_COLUMNS.map((c) => [c.key, true]))),
  );
  const [views, setViews] = useState(() => loadLocal(VIEWS_KEY, []));

  const searchRef = useRef(null);

  const { data, isLoading, isFetching, isError, refetch } = useCampaigns({
    search: search || undefined,
    status: statusFilter.length ? statusFilter : undefined,
    objective: objectiveFilter.length ? objectiveFilter : undefined,
    platform: platformFilter.length ? platformFilter : undefined,
    page, limit: PAGE_SIZE,
  });

  const duplicate = useDuplicateCampaign();
  const changeStatus = useCampaignStatus();
  const del = useDeleteCampaign();

  const rows = data?.items || [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = statusFilter.length + objectiveFilter.length + platformFilter.length;

  const visible = useCallback((key) => columns[key] !== false, [columns]);

  useEffect(() => {
    try { window.localStorage.setItem(COLS_KEY, JSON.stringify(columns)); } catch { /* quota */ }
  }, [columns]);

  // Ctrl+K / Cmd+K focuses search, matching the hint rendered in the field.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(() => (allSelected ? new Set() : new Set(rows.map((r) => r.id))));
  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const openEdit = (id) => { setEditingId(id); setWizardOpen(true); };
  const openDetail = (id) => setDetailId(id);

  /* ── Actions with feedback ─────────────────────────────────────────── */

  const move = async (c, to_status, label) => {
    const from = c.status;
    try {
      await changeStatus.mutateAsync({ id: c.id, to_status });
      toast({
        message: `${c.name} ${label}.`,
        // Real inverse call — the change already landed, so this restores it.
        onUndo: NEXT_STATUSES[to_status]?.includes(from)
          ? () => changeStatus.mutate({ id: c.id, to_status: from })
          : undefined,
      });
    } catch (e) {
      toast({ tone: 'error', message: e.message || `Could not ${label}.` });
    }
  };

  const doDuplicate = async (c) => {
    try {
      await duplicate.mutateAsync(c.id);
      toast({ message: `Duplicated "${c.name}".` });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not duplicate.' });
    }
  };

  const doDelete = async () => {
    const c = confirmDelete;
    if (!c) return;
    try {
      await del.mutateAsync(c.id);
      setConfirmDelete(null);
      // Deliberately no Undo: delete is a soft-delete server-side but there is
      // no restore endpoint, so offering Undo would be a promise we can't keep.
      toast({ message: `Deleted "${c.name}".` });
    } catch (e) {
      toast({ tone: 'error', message: e.message || 'Could not delete.' });
    }
  };

  const runOnSelected = async (fn, label) => {
    const results = await Promise.allSettled([...selected].map(fn));
    const failed = results.filter((r) => r.status === 'rejected').length;
    setSelected(new Set());
    toast({
      tone: failed ? 'error' : 'success',
      message: failed
        ? `${label}: ${results.length - failed} succeeded, ${failed} failed.`
        : `${results.length} campaigns ${label}.`,
    });
  };

  const saveView = () => {
    const name = window.prompt('Name this view');
    if (!name) return;
    const next = [
      ...views.filter((v) => v.name !== name),
      { name, statusFilter, objectiveFilter, platformFilter, search },
    ];
    setViews(next);
    try { window.localStorage.setItem(VIEWS_KEY, JSON.stringify(next)); } catch { /* quota */ }
    toast({ message: `Saved view "${name}".` });
  };

  const applyView = (v) => {
    setStatusFilter(v.statusFilter || []);
    setObjectiveFilter(v.objectiveFilter || []);
    setPlatformFilter(v.platformFilter || []);
    setSearch(v.search || '');
    setPage(1);
  };

  /* ── Keyboard row navigation ───────────────────────────────────────── */

  const onTableKey = (e) => {
    if (!rows.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIndex((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIndex((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && focusIndex >= 0) { e.preventDefault(); openDetail(rows[focusIndex].id); }
    else if (e.key === ' ' && focusIndex >= 0) { e.preventDefault(); toggleOne(rows[focusIndex].id); }
  };

  const colCount = 2 + ALL_COLUMNS.filter((c) => visible(c.key)).length + 1;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Campaigns"
        subtitle="Plan, schedule, and track multi-step campaigns. Delivery figures fill in once a send provider is connected."
        count={isLoading ? null : total}
      />

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <Toolbar
        right={
          <>
            <ToolSearch
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search campaigns…"
            />
            <ToolButton
              icon={Filter}
              onClick={() => setFiltersOpen((v) => !v)}
              active={activeFilterCount > 0}
            >
              Filter{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </ToolButton>
            <ViewSwitcher
              value={view}
              onChange={setView}
              views={[
                { id: 'table', icon: List, label: 'Table' },
                { id: 'card', icon: LayoutGrid, label: 'Cards' },
                { id: 'kanban', icon: Kanban, label: 'Kanban' },
              ]}
            />
          </>
        }
      >
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => { setEditingId(null); setWizardOpen(true); }}
          className="!py-1.5 !px-3 !text-[12px]"
        >
          Create campaign
        </Button>
        <ToolButton icon={Copy} disabled={!selected.size}
          onClick={() => runOnSelected((id) => duplicate.mutateAsync(id), 'duplicated')}>Duplicate</ToolButton>
        <ToolButton icon={Archive} disabled={!selected.size}
          onClick={() => runOnSelected((id) => changeStatus.mutateAsync({ id, to_status: 'archived' }), 'archived')}>Archive</ToolButton>
        <ToolButton icon={Pause} disabled={!selected.size}
          onClick={() => runOnSelected((id) => changeStatus.mutateAsync({ id, to_status: 'paused' }), 'paused')}>Pause</ToolButton>
        <ToolButton icon={Play} disabled={!selected.size}
          onClick={() => runOnSelected((id) => changeStatus.mutateAsync({ id, to_status: 'running' }), 'resumed')}>Resume</ToolButton>
        <ToolButton icon={Trash2} danger disabled={!selected.size}
          onClick={() => runOnSelected((id) => del.mutateAsync(id), 'deleted')}>Delete</ToolButton>
        <ToolButton icon={Upload} disabled title="Bulk import needs a CSV ingest endpoint, which isn't built yet">Import</ToolButton>
        <ToolButton icon={Download} onClick={() => exportCsv(rows)}>Export</ToolButton>
        <ToolButton icon={Columns3} onClick={() => setColumnsOpen((v) => !v)}>Columns</ToolButton>
        <ToolButton icon={Bookmark} onClick={saveView}>Save view</ToolButton>
        <ToolButton icon={RefreshCw} onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </ToolButton>
      </Toolbar>

      {columnsOpen && (
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-slate-500 mb-2">Visible columns</p>
          <div className="flex flex-wrap gap-3">
            {ALL_COLUMNS.map((c) => (
              <label key={c.key} className="flex items-center gap-1.5 text-[12px] text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={visible(c.key)}
                  onChange={() => setColumns((s) => ({ ...s, [c.key]: !visible(c.key) }))}
                  className="rounded"
                />
                {c.label}
              </label>
            ))}
          </div>
        </Card>
      )}

      {views.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap px-1">
          <span className="text-[11px] text-slate-400">Saved views</span>
          {views.map((v) => (
            <ToolButton key={v.name} icon={Bookmark} onClick={() => applyView(v)}>{v.name}</ToolButton>
          ))}
        </div>
      )}

      {filtersOpen && (
        <Card className="p-4">
          <FilterPanel
            statusFilter={statusFilter} setStatusFilter={setStatusFilter}
            objectiveFilter={objectiveFilter} setObjectiveFilter={setObjectiveFilter}
            platformFilter={platformFilter} setPlatformFilter={setPlatformFilter}
            onApply={() => { setPage(1); setFiltersOpen(false); }}
            onClear={() => { setStatusFilter([]); setObjectiveFilter([]); setPlatformFilter([]); }}
            onSaveView={saveView}
          />
        </Card>
      )}

      {/* ── Stats strip ─────────────────────────────────────────────── */}
      <StatsStrip
        items={[
          { label: 'Total', value: isLoading ? null : total, tone: 'violet' },
          { label: 'Running', value: rows.filter((c) => c.status === 'running').length, tone: 'green' },
          { label: 'Scheduled', value: rows.filter((c) => c.status === 'scheduled').length, tone: 'blue' },
          { label: 'Paused', value: rows.filter((c) => c.status === 'paused').length, tone: 'amber' },
          { label: 'Draft', value: rows.filter((c) => c.status === 'draft').length, tone: 'slate' },
          { label: 'Spend', value: null, tone: 'slate', note: 'Needs a connected ad account' },
          { label: 'ROAS', value: null, tone: 'slate', note: 'Needs a connected ad account' },
        ]}
      />

      {/* ── Sticky bulk bar ─────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="sticky top-24 z-20">
          <Card className="p-3 border-rose-200 bg-rose-50/80 backdrop-blur-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-medium text-rose-800">{selected.size} selected</span>
              <button onClick={() => setSelected(new Set())} className="text-xs text-rose-500 hover:text-rose-700">
                Clear selection
              </button>
              <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                <Button icon={Pause} onClick={() => runOnSelected((id) => changeStatus.mutateAsync({ id, to_status: 'paused' }), 'paused')}>
                  Pause
                </Button>
                <Button icon={Play} onClick={() => runOnSelected((id) => changeStatus.mutateAsync({ id, to_status: 'running' }), 'resumed')}>
                  Resume
                </Button>
                <Button icon={Copy} onClick={() => runOnSelected((id) => duplicate.mutateAsync(id), 'duplicated')}>
                  Duplicate
                </Button>
                <Button icon={Archive} onClick={() => runOnSelected((id) => changeStatus.mutateAsync({ id, to_status: 'archived' }), 'archived')}>
                  Archive
                </Button>
                <Button icon={Download} onClick={() => exportCsv(rows.filter((r) => selected.has(r.id)))}>
                  Export
                </Button>
                <Button variant="danger" icon={Trash2} onClick={() => runOnSelected((id) => del.mutateAsync(id), 'deleted')}>
                  Delete
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Content: table / cards / kanban ─────────────────────────── */}
      {view !== 'table' && !isLoading && rows.length > 0 && (
        view === 'card' ? (
          <CardView
            rows={rows}
            selected={selected}
            onToggle={toggleOne}
            onOpen={openDetail}
            onEdit={openEdit}
            onDuplicate={doDuplicate}
          />
        ) : (
          <KanbanView rows={rows} onOpen={openDetail} />
        )
      )}

      <Card className={view === 'table' ? '' : 'hidden'}>
        {isError && (
          <div className="p-4 flex items-center gap-2 text-sm text-red-600 border-b border-red-100 bg-red-50/60">
            <AlertTriangle size={14} /> Could not load campaigns.
            <button onClick={() => refetch()} className="ml-2 underline">Retry</button>
          </div>
        )}

        <div className="overflow-x-auto" onKeyDown={onTableKey} tabIndex={0} role="grid">
          <table className="w-full text-sm min-w-[1040px]">
            <thead>
              <tr className="border-b border-[#E4E8F0]">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox" checked={allSelected} onChange={toggleAll}
                    aria-label="Select all campaigns" className="rounded"
                  />
                </th>
                <Th>Campaign</Th>
                {visible('platforms') && <Th>Platforms</Th>}
                {visible('objective') && <Th>Objective</Th>}
                {visible('status') && <Th>Status</Th>}
                {visible('kpis') && <Th>Performance</Th>}
                {visible('budget') && <Th align="right">Budget</Th>}
                {visible('owner') && <Th>Owner</Th>}
                {visible('ai') && <Th align="center">AI score</Th>}
                {visible('updated') && <Th>Updated</Th>}
                <th className="w-12 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#EEF1F6]">
                    <td colSpan={colCount} className="px-4 py-5">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={colCount}>
                    <EmptyState
                      icon={Megaphone}
                      title="No campaigns yet"
                      body="Create one, or ask the Marketing Agent for a plan and it lands here as a draft."
                      action={
                        <Button variant="primary" icon={Plus} onClick={() => { setEditingId(null); setWizardOpen(true); }}>
                          Create campaign
                        </Button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                rows.map((c, i) => (
                  <Row
                    key={c.id}
                    c={c}
                    focused={i === focusIndex}
                    checked={selected.has(c.id)}
                    onToggle={() => toggleOne(c.id)}
                    onOpen={() => openDetail(c.id)}
                    onEdit={() => openEdit(c.id)}
                    onDuplicate={() => doDuplicate(c)}
                    onMove={move}
                    onDelete={() => setConfirmDelete(c)}
                    visible={visible}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination ────────────────────────────────────────────── */}
        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#EEF1F6] flex-wrap">
            <p className="text-[11px] text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                icon={ChevronLeft}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="!px-2 !py-1.5"
              />
              <span className="text-[12px] text-slate-500 px-2">{page} / {totalPages}</span>
              <Button
                icon={ChevronRight}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="!px-2 !py-1.5"
              />
            </div>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-slate-400 px-1">
        Performance, owner, and AI-score columns stay blank until an ad account is
        connected. Nothing on this page is estimated.
      </p>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        busy={del.isPending}
        title="Delete campaign?"
        message={`This cannot be undone. Delete "${confirmDelete?.name}" and all of its items?`}
      />

      {wizardOpen && (
        <CampaignWizard
          campaignId={editingId}
          onClose={() => { setWizardOpen(false); setEditingId(null); }}
        />
      )}

      {detailId && (
        <CampaignDetailDrawer
          campaignId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={(id) => { setDetailId(null); openEdit(id); }}
        />
      )}
    </div>
  );
}

function Th({ children, align = 'left' }) {
  return (
    <th className={`text-${align} px-3 py-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap`}>
      {children}
    </th>
  );
}

function Row({ c, focused, checked, onToggle, onOpen, onEdit, onDuplicate, onMove, onDelete, visible }) {
  const next = NEXT_STATUSES[c.status] || [];

  return (
    <tr
      className={`group border-b border-[#EEF1F6] transition-colors ${
        focused ? 'bg-rose-50/60' : 'hover:bg-slate-50/70'
      }`}
      style={{ height: 72 }}
      aria-selected={checked}
    >
      <td className="px-4">
        <input type="checkbox" checked={checked} onChange={onToggle} aria-label={`Select ${c.name}`} className="rounded" />
      </td>

      {/* name + subtitle + hover quick-actions */}
      <td className="px-3">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <button onClick={onOpen} className="block text-left font-semibold text-[15px] text-[#0F1929] hover:text-rose-600 truncate max-w-[260px]">
              {c.name}
            </button>
            <p className="text-[12px] text-slate-400 truncate max-w-[260px]">
              {(c.platforms || []).map((p) => PLATFORM_LABEL[p] || p).join(', ') || 'No platforms'}
              {' · '}Created {new Date(c.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
            </p>
            {c.tags?.length > 0 && (
              <div className="flex gap-1 mt-1">
                {c.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <IconBtn label="Preview" icon={Eye} onClick={onOpen} />
            <IconBtn label="Edit" icon={Pencil} onClick={onEdit} />
            <IconBtn label="Duplicate" icon={Copy} onClick={onDuplicate} />
          </div>
        </div>
      </td>

      {visible('platforms') && (
        <td className="px-3">
          <div className="flex flex-wrap gap-1 max-w-[130px]">
            {(c.platforms || []).map((p) => (
              <span
                key={p}
                title={PLATFORM_LABEL[p] || p}
                className="w-5 h-5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-semibold
                           flex items-center justify-center cursor-default"
              >
                {PLATFORM_MARK[p] || p.slice(0, 2)}
              </span>
            ))}
          </div>
        </td>
      )}

      {visible('objective') && (
        <td className="px-3">
          <Badge tone="violet">{OBJECTIVE_LABEL[c.objective] || c.objective}</Badge>
        </td>
      )}

      {visible('status') && (
        <td className="px-3">
          <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status] || c.status}</Badge>
        </td>
      )}

      {visible('kpis') && (
        <td className="px-3">
          <div className="space-y-0.5 text-[11px] font-mono text-slate-400">
            <div>CTR <NoSource /></div>
            <div>CPC <NoSource /></div>
            <div>Spend <NoSource /></div>
          </div>
        </td>
      )}

      {visible('budget') && (
        <td className="px-3 text-right">
          <p className="font-mono text-[13px] text-slate-700">
            {c.currency} {Number(c.budget_amount).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400">{c.budget_type}</p>
        </td>
      )}

      {visible('owner') && (
        <td className="px-3">
          <NoSource hint="Campaign ownership isn't modelled yet" />
        </td>
      )}

      {visible('ai') && (
        <td className="px-3 text-center">
          <NoSource hint="No AI scoring model is trained for campaigns" />
        </td>
      )}

      {visible('updated') && (
        <td className="px-3 text-[11px] text-slate-400 whitespace-nowrap">{timeAgo(c.updated_at)}</td>
      )}

      <td className="px-3">
        <Menu
          trigger={
            <button
              aria-label={`Actions for ${c.name}`}
              className="w-8 h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600
                         transition-colors flex items-center justify-center"
            >
              <MoreVertical size={15} />
            </button>
          }
          items={[
            { label: 'Open', icon: ExternalLink, onClick: onOpen },
            { label: 'Edit', icon: Pencil, onClick: onEdit },
            { label: 'Duplicate', icon: Copy, onClick: onDuplicate },
            { label: 'Preview', icon: Eye, onClick: onOpen },
            {
              label: 'Analytics', icon: BarChart2, disabled: true,
              disabledReason: 'Per-campaign analytics needs delivery data from a connected account',
            },
            {
              label: 'AI Insights', icon: Sparkles, disabled: true,
              disabledReason: 'Needs performance data to reason about',
            },
            { label: 'Export', icon: Download, onClick: () => exportCsv([c]) },
            { divider: true },
            {
              label: 'Pause', icon: Pause,
              disabled: !next.includes('paused'),
              disabledReason: `Cannot pause a ${c.status} campaign`,
              onClick: () => onMove(c, 'paused', 'paused'),
            },
            {
              label: 'Resume', icon: Play,
              disabled: !next.includes('running'),
              disabledReason: `Cannot resume a ${c.status} campaign`,
              onClick: () => onMove(c, 'running', 'resumed'),
            },
            {
              label: 'Archive', icon: Archive,
              disabled: !next.includes('archived'),
              disabledReason: `Cannot archive a ${c.status} campaign`,
              onClick: () => onMove(c, 'archived', 'archived'),
            },
            { divider: true },
            { label: 'Delete', icon: Trash2, danger: true, onClick: onDelete },
          ]}
        />
      </td>
    </tr>
  );
}

function IconBtn({ label, icon: Icon, onClick }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="w-8 h-8 rounded-lg border border-[#E4E8F0] bg-white text-slate-500
                 hover:bg-slate-50 hover:text-slate-700 transition-colors flex items-center justify-center"
    >
      <Icon size={13} />
    </button>
  );
}

function FilterPanel({
  statusFilter, setStatusFilter, objectiveFilter, setObjectiveFilter,
  platformFilter, setPlatformFilter, onApply, onClear, onSaveView,
}) {
  const toggle = (list, setList, value) =>
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="mt-3 pt-3 border-t border-[#EEF1F6]">
      <div className="grid gap-4 md:grid-cols-3">
        <FilterGroup label="Status" options={STATUSES} selected={statusFilter}
                     onToggle={(v) => toggle(statusFilter, setStatusFilter, v)} />
        <FilterGroup label="Objective" options={OBJECTIVES} selected={objectiveFilter}
                     onToggle={(v) => toggle(objectiveFilter, setObjectiveFilter, v)} />
        <FilterGroup label="Platform" options={PLATFORMS} selected={platformFilter}
                     onToggle={(v) => toggle(platformFilter, setPlatformFilter, v)} />
      </div>
      <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-[#EEF1F6]">
        <Button onClick={onClear}>Reset</Button>
        <Button icon={Bookmark} onClick={onSaveView}>Save view</Button>
        <Button variant="primary" onClick={onApply}>Apply filters</Button>
      </div>
    </div>
  );
}

function FilterGroup({ label, options, selected, onToggle }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 mb-2">{label}</p>
      <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-[12px] text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="rounded"
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
