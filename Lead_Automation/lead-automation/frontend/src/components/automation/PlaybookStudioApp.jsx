'use client';
import { useState, useMemo, useEffect, useCallback } from 'react';
import { Rows3, LayoutList } from 'lucide-react';
import FlowBuilder, { seedGraph, exportFlowJson } from './FlowBuilder.jsx';
import DiagnosticBench from './DiagnosticBench.jsx';
import { useApi } from '@/lib/useApi';

/**
 * Playbook Studio — ported from the standalone Lead Automation project into
 * the CRM's WhatsApp/Instagram > Automation pages. Same component, same
 * behavior; only the surrounding chrome changed (it now renders inside the
 * CRM's Sidebar/Topbar shell instead of owning the whole viewport).
 *
 * Single source of truth: `graph` (the canvas's node/edge state) lives here,
 * not inside either child component. Switching tabs doesn't serialize to
 * localStorage or round-trip through a backend — it's the same in-memory
 * object, converted once via exportFlowJson() right before the simulator
 * reads it. That's what makes "branch created in the builder is visible in
 * the simulator" actually true rather than just two components that look similar.
 *
 * `channel` drives the Simulate tab's chat chrome (WhatsApp vs Instagram —
 * see DiagnosticBench) and, together with `playbookId`, scopes the
 * localStorage autosave key below so two different flows/channels never
 * clobber each other's drafts.
 */
export default function PlaybookStudioApp({ channel = 'whatsapp', playbookId = 'draft' }) {
  const storageKey = `playbookStudio:${channel}:${playbookId}`;
  const { call } = useApi();

  // ---- Conversation view preference (Compact / Detailed) --------------
  // Purely a display-density toggle for the Studio's own chrome — separate
  // from the graph/title autosave above, so it's kept under its own
  // localStorage key (shared across channels/playbooks; it's a user
  // preference, not a per-flow one) and its own tiny bit of state.
  const [viewPreference, setViewPreference] = useState('detailed');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('playbookStudio:conversationView');
    if (saved === 'compact' || saved === 'detailed') setViewPreference(saved);
  }, []);

  const handleViewPreferenceChange = useCallback(async (next) => {
    setViewPreference(next); // optimistic — the toggle shouldn't wait on the network
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('playbookStudio:conversationView', next);
    }
    try {
      await call('/automation/preferences/conversation-view', {
        method: 'POST',
        body: { preference: next },
      });
    } catch (err) {
      // Non-critical: the UI already reflects the choice and it's saved
      // locally, so a failed round-trip to the (currently stubbed) backend
      // isn't worth surfacing as an error toast — just log it.
      console.warn('Failed to sync conversation view preference:', err.message);
    }
  }, [call]);

  // ---- Hydrate on mount ----------------------------------------------
  // There's no real "load this playbook from the database" endpoint yet —
  // the whole studio is client-side/in-memory today (see FlowBuilder's
  // always-on "Saved" pill and the Deploy button's JSON-export-only
  // behavior). Until that endpoint exists, a locally-saved draft IS the
  // most current copy, so it takes priority; seedGraph is the fallback.
  // When a real fetch lands, it slots into the `else` branch below.
  const [graph, setGraphState] = useState(() => {
    if (typeof window === 'undefined') return seedGraph();
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      // Guard against a corrupt/old-shape entry (e.g. saved by an earlier,
      // buggy build) rather than trusting it blindly and crashing later
      // inside exportFlowJson/FlowBuilder when `.nodes` turns out missing.
      if (Array.isArray(parsed?.graph?.nodes)) return parsed.graph;
    } catch {
      // JSON.parse failure — ignore and fall through to seedGraph()
    }
    return seedGraph();
  });

  const [title, setTitleState] = useState(() => {
    if (typeof window === 'undefined') return 'WEB — Ecommerce Customer Support';
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (typeof parsed?.title === 'string') return parsed.title;
    } catch {
      /* ignore */
    }
    return 'WEB — Ecommerce Customer Support';
  });

  const [tab, setTab] = useState('builder'); // 'builder' | 'simulate'

  // Re-hydrate if the channel or playbook identity changes under us (e.g.
  // navigating from /channels/whatsapp/automation straight to
  // /channels/instagram/automation without a full page reload).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const saved = raw ? JSON.parse(raw) : null;
      setGraphState(Array.isArray(saved?.graph?.nodes) ? saved.graph : seedGraph());
      setTitleState(typeof saved?.title === 'string' ? saved.title : 'WEB — Ecommerce Customer Support');
    } catch {
      setGraphState(seedGraph());
      setTitleState('WEB — Ecommerce Customer Support');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const persist = useCallback((nextGraph, nextTitle) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ graph: nextGraph, title: nextTitle, savedAt: Date.now() }));
    } catch {
      // localStorage full/unavailable (private browsing, quota) — edits still
      // work for the rest of this session, they just won't survive a refresh.
    }
  }, [storageKey]);

  // Every node/edge edit funnels through FlowBuilder's `commit()`, which
  // calls onGraphChange — so this one handler is all that's needed to
  // autosave on every change, no separate "Save" click required.
  const handleGraphChange = useCallback((next) => {
    setGraphState(next);
    persist(next, title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, title]);

  const handleTitleChange = useCallback((next) => {
    setTitleState(next);
    persist(graph, next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist, graph]);

  const exportedFlow = useMemo(() => exportFlowJson(graph, title), [graph, title]);

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex items-center gap-1 px-3 pt-2 border-b bg-white" style={{ borderColor: '#E7E4DD' }}>
        <TabButton active={tab === 'builder'} onClick={() => setTab('builder')}>
          Builder
        </TabButton>
        <TabButton active={tab === 'simulate'} onClick={() => setTab('simulate')}>
          Simulate
        </TabButton>
        <div className="flex-1" />
        <ViewPreferenceToggle value={viewPreference} onChange={handleViewPreferenceChange} />
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'builder' ? (
          <FlowBuilder
            initialGraph={graph}
            initialTitle={title}
            onGraphChange={handleGraphChange}
            onTitleChange={handleTitleChange}
            onTestBot={() => setTab('simulate')}
          />
        ) : (
          <DiagnosticBench flow={exportedFlow} channel={channel} density={viewPreference} onBack={() => setTab('builder')} />
        )}
      </div>
    </div>
  );
}

function ViewPreferenceToggle({ value, onChange }) {
  const options = [
    { id: 'compact', label: 'Compact', Icon: Rows3 },
    { id: 'detailed', label: 'Detailed', Icon: LayoutList },
  ];
  return (
    <div className="flex items-center rounded-lg border p-0.5 mb-1.5 mr-1" style={{ borderColor: '#E7E4DD', background: '#FAFAF9' }}>
      {options.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => value !== id && onChange(id)}
          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
          style={{
            background: value === id ? '#fff' : 'transparent',
            color: value === id ? '#26241F' : '#8A8578',
            boxShadow: value === id ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <Icon size={13} /> {label}
        </button>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="text-sm font-medium px-3 py-2 border-b-2 -mb-px"
      style={{
        borderColor: active ? '#1D6FC4' : 'transparent',
        color: active ? '#1D6FC4' : '#8A8578',
      }}
    >
      {children}
    </button>
  );
}