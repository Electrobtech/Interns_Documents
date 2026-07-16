'use client';
import { Search } from 'lucide-react';
import ReviewCard from './ReviewCard';

const RATING_OPTIONS = [
  { value: '', label: 'All ratings' },
  { value: '5', label: '5★' },
  { value: '4', label: '4★' },
  { value: '3', label: '3★' },
  { value: '2', label: '2★' },
  { value: '1', label: '1★' },
];

const REPLY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'replied', label: 'Replied' },
  { value: 'pending', label: 'Pending Reply' },
];

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
];

function Skeleton() {
  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-100 rounded w-1/3" />
          <div className="h-2.5 bg-slate-100 rounded w-1/4" />
        </div>
      </div>
      <div className="h-3 bg-slate-100 rounded w-full" />
      <div className="h-3 bg-slate-100 rounded w-2/3" />
    </div>
  );
}

export default function ReviewsList({ reviews, loading, filters, onFilterChange, onReply, onDeleteReply, busy }) {
  const { rows, total, page, limit } = reviews;
  const totalPages = Math.max(1, Math.ceil(total / (limit || 10)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by reviewer or review text…"
            defaultValue={filters.search}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-8 border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <select value={filters.rating} onChange={(e) => onFilterChange({ rating: e.target.value, page: 1 })}
          className="border border-slate-300 rounded-lg px-2.5 py-2 text-sm">
          {RATING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.replied} onChange={(e) => onFilterChange({ replied: e.target.value, page: 1 })}
          className="border border-slate-300 rounded-lg px-2.5 py-2 text-sm">
          {REPLY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => onFilterChange({ sort: e.target.value, page: 1 })}
          className="border border-slate-300 rounded-lg px-2.5 py-2 text-sm">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)}</div>
      ) : !rows.length ? (
        <div className="text-center py-12 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
          No reviews match these filters yet.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <ReviewCard key={r.reviewId} review={r} onReply={onReply} onDeleteReply={onDeleteReply} busy={busy} />
          ))}
        </div>
      )}

      {!loading && total > limit && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Page {page} of {totalPages} · {total} reviews</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onFilterChange({ page: page - 1 })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40">Previous</button>
            <button disabled={page >= totalPages} onClick={() => onFilterChange({ page: page + 1 })}
              className="px-3 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
