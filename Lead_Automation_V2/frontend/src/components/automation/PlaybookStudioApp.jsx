'use client';
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Rows3, LayoutList } from 'lucide-react';
import FlowBuilder, { seedGraph, exportFlowJson, importFlowJson } from './FlowBuilder.jsx';
import DiagnosticBench from './DiagnosticBench.jsx';
import { useApi } from '@/lib/useApi';

// How long to wait after the last edit before autosaving to Postgres.
// Keeps every keystroke/drag from firing its own network request while
// still saving well within "close the laptop lid" timeframes.
const AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Playbook Studio — ported from the standalone Lead Automation project into
 * the CRM's WhatsApp/Instagram > Automation pages. Same component, same
 * behavior; only the surrounding chrome changed (it now renders inside the
 * CRM's Sidebar/Topbar shell instead of owning the whole viewport).
 *
 * Single source of truth: `graph` (the canvas's node/edge state) lives here,
 * not inside either child component. Switching tabs doesn't round-trip
 * through anything — it's the same in-memory object, converted once via
 * exportFlowJson() right before the simulator reads it. That's what makes
 * "branch created in the builder is visible in the simulator" actually true
 * rather than just two components that look similar.
 *
 * Persistence: the graph is autosaved to PostgreSQL via
 * GET/PUT /automation/playbooks/:playbookId (see playbookController.js) —
 * that's what makes a flow built on one machine reopen identically on
 * another. localStorage is kept only as an instant local echo / offline
 * fallback (e.g. mid-edit network hiccup), never the source of truth once a
 * backend copy exists.
 */
export default function PlaybookStudioApp({ channel = 'whatsapp', playbookId = 'draft' }) {
  const storageKey = `playbookStudio:${channel}:${playbookId}`;
  const { call } = useApi();

  // ---- Conversation view preference (Compact / Detailed) --------------
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
      console.warn('Failed to sync conversation view preference:', err.message);
    }
  }, [call]);

  // ---- Graph + title state, hydrated from Postgres on mount -----------
  const [graph, setGraphState] = useState(seedGraph);
  const [title, setTitleState] = useState('WEB — Ecommerce Customer Support');
  const [tab, setTab] = useState('builder'); // 'builder' | 'simulate'
  const [syncStatus, setSyncStatus] = useState('loading'); // loading | saved | saving | offline | error
  // Deploy is DELIBERATELY separate from the debounced autosave above: the
  // autosave keeps status/playbookType whatever they already were (draft on
  // a brand-new playbook — see playbookController.js's `status || 'draft'`
  // fallback), so a flow can be edited indefinitely without going live by
  // accident. Only clicking Deploy sets status: 'active', which is the ONE
  // thing resolvePlaybook() (automation-service's webhookController.js)
  // actually checks before it'll route a real inbound message — and
  // playbookType: 'default' so it's picked up as this channel's first-touch
  // welcome bot (matches any inbound text/keyword, not just a specific
  // trigger), which is what "type hi in the inbox and see it fire" needs.
  const [deployState, setDeployState] = useState('idle'); // idle | deploying | deployed | error

  const handleDeploy = useCallback(async (exported) => {
    setDeployState('deploying');
    try {
      const saved = await call(`/automation/playbooks/${playbookId}`, {
        method: 'PUT',
        body: { ...exported, channels: [channel], playbookType: 'default', status: 'active' },
      });
      setSyncStatus('saved');
      setDeployState('deployed');
      setPlaybookStatus(saved?.status || 'active');
      setTimeout(() => setDeployState('idle'), 2500);
      return saved;
    } catch (err) {
      console.warn('Deploy failed:', err.message);
      setDeployState('error');
      setTimeout(() => setDeployState('idle'), 3000);
    }
  }, [call, playbookId, channel]);

  // ---- Pause / Resume — stops the bot from auto-replying to every ------
  // number without touching the saved flow itself. Flips status between
  // 'active' and 'paused'; resolvePlaybook() in automation-service's
  // webhookController.js only ever matches status = 'active', so a
  // 'paused' playbook is invisible to the engine — inbound messages still
  // land in the transcript (that write happens before playbook lookup),
  // there's just no automated reply. Toggling back to 'active' resumes it
  // exactly where it left off; nothing about the flow itself changes.
  const [playbookStatus, setPlaybookStatus] = useState('draft'); // draft | active | paused | archived
  const [pauseState, setPauseState] = useState('idle'); // idle | working | error

  const handleTogglePause = useCallback(async () => {
    const nextStatus = playbookStatus === 'active' ? 'paused' : 'active';
    setPauseState('working');
    try {
      const exported = exportFlowJson(graph, title);
      const saved = await call(`/automation/playbooks/${playbookId}`, {
        method: 'PUT',
        body: { ...exported, channels: [channel], status: nextStatus },
      });
      setPlaybookStatus(saved?.status || nextStatus);
      setPauseState('idle');
    } catch (err) {
      console.warn('Pause/resume failed:', err.message);
      setPauseState('error');
      setTimeout(() => setPauseState('idle'), 3000);
    }
  }, [call, playbookId, channel, graph, title, playbookStatus]);

  // Guards the autosave effect from firing while we're still hydrating (or
  // re-hydrating after a channel/playbookId change) — otherwise the very
  // first render after a fetch would immediately PUT back what we just GET.
  const hydratingRef = useRef(true);
  const saveTimerRef = useRef(null);

  const readLocalCache = useCallback(() => {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (Array.isArray(parsed?.graph?.nodes)) return parsed;
    } catch {
      /* corrupt/old-shape cache entry — ignore */
    }
    return null;
  }, [storageKey]);

  const writeLocalCache = useCallback((nextGraph, nextTitle) => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ graph: nextGraph, title: nextTitle, savedAt: Date.now() }));
    } catch {
      // localStorage full/unavailable (private browsing, quota) — non-fatal,
      // the Postgres save is what actually matters.
    }
  }, [storageKey]);

  // Hydrate from Postgres whenever channel/playbookId changes (e.g.
  // navigating from /channels/whatsapp/automation to
  // /channels/instagram/automation without a full page reload). Falls back
  // to a local cache, then the bundled seed, only if the backend fetch
  // itself fails (offline, DB down) — a clean 404 (no playbook saved yet)
  // still prefers the local cache once, so an in-progress edit isn't lost
  // the first time this endpoint goes live under an existing draft.
  useEffect(() => {
    let cancelled = false;
    hydratingRef.current = true;
    setSyncStatus('loading');

    (async () => {
      try {
        const playbook = await call(`/automation/playbooks/${playbookId}`);
        if (cancelled) return;
        setGraphState(importFlowJson(playbook));
        setTitleState(playbook.name || 'WEB — Ecommerce Customer Support');
        setPlaybookStatus(playbook.status || 'draft');
        setSyncStatus('saved');
      } catch (err) {
        if (cancelled) return;
        const cached = readLocalCache();
        if (cached) {
          setGraphState(cached.graph);
          setTitleState(cached.title);
        } else {
          setGraphState(seedGraph());
          setTitleState('WEB — Ecommerce Customer Support');
        }
        // A 404 just means "nothing saved yet for this id" — that's normal
        // for a brand-new playbook, not an error worth flagging.
        setSyncStatus(/not found|404/i.test(err.message || '') ? 'saved' : 'offline');
      } finally {
        if (!cancelled) {
          // Let the hydration's own state updates flush before re-enabling
          // the autosave effect below, so it doesn't immediately re-save.
          setTimeout(() => { hydratingRef.current = false; }, 0);
        }
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbookId, channel]);

  const handleGraphChange = useCallback((next) => {
    setGraphState(next);
  }, []);

  const handleTitleChange = useCallback((next) => {
    setTitleState(next);
  }, []);

  // ---- Debounced autosave to Postgres ----------------------------------
  useEffect(() => {
    if (hydratingRef.current) return; // don't save what we just loaded
    writeLocalCache(graph, title); // instant local echo regardless of network

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSyncStatus('saving');
      try {
        const exported = exportFlowJson(graph, title);
        await call(`/automation/playbooks/${playbookId}`, {
          method: 'PUT',
          body: { ...exported, channels: [channel] },
        });
        setSyncStatus('saved');
      } catch (err) {
        console.warn('Autosave to Postgres failed, kept locally only:', err.message);
        setSyncStatus('offline');
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph, title]);

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
          syncStatus === 'loading' ? (
            <div className="w-full h-full flex items-center justify-center text-sm" style={{ color: '#8A8578' }}>
              Loading your saved flow…
            </div>
          ) : (
            <FlowBuilder
              key={playbookId}
              initialGraph={graph}
              initialTitle={title}
              syncStatus={syncStatus}
              onGraphChange={handleGraphChange}
              onTitleChange={handleTitleChange}
              onTestBot={() => setTab('simulate')}
              onDeploy={handleDeploy}
              deployState={deployState}
              playbookStatus={playbookStatus}
              onTogglePause={handleTogglePause}
              pauseState={pauseState}
            />
          )
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
