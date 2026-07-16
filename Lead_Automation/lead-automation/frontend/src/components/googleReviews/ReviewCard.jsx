'use client';
import { useState } from 'react';
import { Star, MessageSquareReply, Pencil, Trash2, User } from 'lucide-react';

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={13}
          className={n <= (rating || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
      ))}
    </div>
  );
}

function fmtDate(v) {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d) ? String(v) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function ReviewCard({ review, onReply, onDeleteReply, busy }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-start gap-3">
        {review.reviewerPhotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.reviewerPhotoUrl} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-slate-100 grid place-items-center text-slate-400 shrink-0">
            <User size={16} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-sm text-slate-800 truncate">{review.reviewerName || 'Anonymous'}</p>
            <span className="text-xs text-slate-400 shrink-0">{fmtDate(review.createTime)}</span>
          </div>
          <Stars rating={review.starRating} />
        </div>
      </div>

      {review.comment && <p className="text-sm text-slate-600 leading-relaxed">{review.comment}</p>}

      {review.replyComment ? (
        <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500">Your reply · {fmtDate(review.replyUpdateTime)}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setOpen(true)} className="text-slate-400 hover:text-brand" title="Edit reply"><Pencil size={13} /></button>
              <button onClick={() => onDeleteReply(review.reviewId)} className="text-slate-400 hover:text-red-500" title="Delete reply"><Trash2 size={13} /></button>
            </div>
          </div>
          <p className="text-sm text-slate-600">{review.replyComment}</p>
        </div>
      ) : (
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-dark">
          <MessageSquareReply size={14} /> Reply
        </button>
      )}

      {open && (
        <InlineReplyForm
          initial={review.replyComment || ''}
          busy={busy}
          onCancel={() => setOpen(false)}
          onSubmit={async (text) => { await onReply(review.reviewId, text); setOpen(false); }}
        />
      )}
    </div>
  );
}

function InlineReplyForm({ initial, busy, onSubmit, onCancel }) {
  const [text, setText] = useState(initial);
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (text.trim()) onSubmit(text.trim()); }}
      className="space-y-2 border-t border-slate-100 pt-3"
    >
      <textarea
        autoFocus
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Write a public reply…"
        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
      />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 text-slate-600">Cancel</button>
        <button type="submit" disabled={busy || !text.trim()}
          className="px-3 py-1.5 text-xs rounded-lg bg-brand text-white font-medium disabled:opacity-60">
          {busy ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </form>
  );
}
