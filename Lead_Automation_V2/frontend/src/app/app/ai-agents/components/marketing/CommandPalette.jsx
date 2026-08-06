'use client';
/**
 * ⌘K command palette — jump to any section without reaching for the rail.
 *
 * Sections only. Actions ("create campaign", "generate report") are
 * deliberately absent: a palette entry that opens a wizard three states deep
 * is a good way to start something you can't finish, and every one of those
 * flows already has an obvious button on its own page.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

import { ACCENT } from './MarketingUI';

export default function CommandPalette({ open, onClose, sections, groups, onSelect }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.capability?.toLowerCase().includes(q) ||
        groupOf(groups, s.id)?.toLowerCase().includes(q),
    );
  }, [query, sections, groups]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setCursor(0);
      // Focus after paint, or the input isn't mounted yet.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(results.length - 1, c + 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)); }
      else if (e.key === 'Enter' && results[cursor]) {
        e.preventDefault();
        onSelect(results[cursor].id);
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, results, cursor, onSelect, onClose]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] px-4">
      <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px]" onClick={onClose} />

      <div
        role="dialog"
        aria-label="Search sections"
        className="relative w-full max-w-lg rounded-2xl border border-[#E4E8F0] bg-white shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#EEF1F6]">
          <Search size={15} className="text-slate-300 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to a section…"
            className="flex-1 text-sm outline-none placeholder:text-slate-300"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#E4E8F0] text-slate-400">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-slate-400">
              Nothing matches “{query}”.
            </p>
          ) : (
            results.map((s, i) => {
              const Icon = s.icon;
              const active = i === cursor;
              return (
                <button
                  key={s.id}
                  data-active={active}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { onSelect(s.id); onClose(); }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    active ? 'bg-rose-50' : 'hover:bg-slate-50'
                  }`}
                >
                  <Icon size={15} style={{ color: active ? ACCENT : '#94A3B8' }} className="flex-shrink-0" />
                  <span className="text-[13px] font-medium text-[#0F1929] flex-1 truncate">{s.label}</span>
                  <span className="text-[10px] text-slate-300 uppercase tracking-wide flex-shrink-0">
                    {groupOf(groups, s.id)}
                  </span>
                  {active && <CornerDownLeft size={12} className="text-slate-300 flex-shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 px-4 py-2 border-t border-[#EEF1F6] bg-slate-50/60 text-[10px] text-slate-400">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> open</span>
          <span className="ml-auto">{results.length} section{results.length === 1 ? '' : 's'}</span>
        </div>
      </div>
    </div>
  );
}

function groupOf(groups, id) {
  return groups.find((g) => g.items.includes(id))?.label;
}
