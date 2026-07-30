'use client';

import { useEffect, useState } from 'react';
import { Plug, Plus, Trash2, RefreshCw, Facebook } from 'lucide-react';
import ConnectionsPanel from '@/components/ConnectionsPanel';
import { useApi } from '@/lib/useApi';

// NOTE: There is currently no `/crm/*` backend anywhere in this codebase
// (no gateway route, no service implements connections/sync-jobs/sync).
// This section was calling endpoints that don't exist yet, so requests
// below will fail. It's now wired up defensively (auth token attached like
// every other page via useApi(), and every response is guarded to always
// be an array) so a missing/failing endpoint shows an inline error instead
// of crashing the whole page. Build the crm-sync backend service + gateway
// route before this section will actually work end-to-end.
export default function IntegrationsPage() {
  const { call } = useApi();
  const [connections, setConnections] = useState([]);
  const [syncJobs, setSyncJobs] = useState([]);
  const [crmError, setCrmError] = useState('');
  const [workspace, setWorkspace] = useState('00000000-0000-0000-0000-000000000000');
  const [showCreate, setShowCreate] = useState(false);
  const [newConnection, setNewConnection] = useState({ provider: '', config: '{}' });

  async function loadConnections() {
    try {
      const data = await call(`/crm/connections/${workspace}`);
      setConnections(Array.isArray(data) ? data : []);
      setCrmError('');
    } catch (e) {
      console.error(e);
      setConnections([]);
      setCrmError('CRM integrations are not available yet.');
    }
  }

  async function loadSyncJobs() {
    try {
      const data = await call(`/crm/sync-jobs/${workspace}`);
      setSyncJobs(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setSyncJobs([]);
    }
  }

  useEffect(() => {
    loadConnections();
    loadSyncJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace]);

  async function createConnection() {
    if (!newConnection.provider.trim()) return;
    let config;
    try {
      config = JSON.parse(newConnection.config || '{}');
    } catch (e) {
      alert('Invalid JSON config');
      return;
    }
    try {
      await call('/crm/connections', {
        method: 'POST',
        body: {
          workspace_id: workspace,
          provider: newConnection.provider,
          config,
          active: true,
        },
      });
      await loadConnections();
      setNewConnection({ provider: '', config: '{}' });
      setShowCreate(false);
    } catch (e) {
      console.error(e);
      setCrmError('Could not save this connection — CRM integrations may not be available yet.');
    }
  }

  async function deleteConnection(id) {
    if (!confirm('Delete this connection?')) return;
    try {
      await call(`/crm/connections/${id}`, { method: 'DELETE' });
      setConnections((prev) => prev.filter((c) => c.id !== id));
    } catch (e) {
      console.error(e);
      setCrmError('Could not delete this connection.');
    }
  }

  async function triggerSync() {
    try {
      await call('/crm/sync/outbound', {
        method: 'POST',
        body: {
          workspace_id: workspace,
          entity_type: 'contact',
          payload: {},
        },
      });
      await loadSyncJobs();
    } catch (e) {
      console.error(e);
      setCrmError('Could not trigger sync — CRM integrations may not be available yet.');
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-10">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Plug size={24} className="text-violet-600" />
          <h1 className="text-2xl font-bold">Integrations & APIs</h1>
        </div>
        <p className="text-sm text-slate-500">
          Connect CRMs, and Facebook / Instagram / WhatsApp for messaging and publishing.
        </p>
      </div>

      {/* ---------- Meta Integrations (Facebook, Instagram, WhatsApp) ---------- */}
      <section>
        <div className="flex items-center gap-2 mb-1">
          <Facebook size={20} className="text-brand" />
          <h2 className="text-lg font-bold">Meta Integrations</h2>
        </div>
        <p className="text-sm text-slate-500 mb-4">
          Facebook and Instagram share a single connection — connect via Meta login or by pasting
          in Page credentials directly. Once a connection is saved, it locks automatically so it
          can't be changed by accident; only an org admin can unlock it to reconnect.
        </p>
        <ConnectionsPanel />
      </section>

      {/* ---------- CRM Integrations ---------- */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-lg font-bold">CRM Integrations</h2>
        </div>

        {crmError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3 mb-4">
            {crmError}
          </div>
        )}

        <div className="flex gap-4 mb-6">
          <input
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className="border rounded px-3 py-2"
            placeholder="Workspace ID"
          />
          <button
            onClick={triggerSync}
            className="bg-violet-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-violet-700"
          >
            <RefreshCw size={16} /> Trigger Sync
          </button>
        </div>

        {showCreate && (
        <div className="bg-white rounded-xl shadow border p-6 mb-6">
          <h2 className="font-semibold mb-4">Add CRM Connection</h2>
          <div className="space-y-3">
            <select
              value={newConnection.provider}
              onChange={(e) => setNewConnection({ ...newConnection, provider: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option value="">Select provider</option>
              <option value="hubspot">HubSpot</option>
              <option value="salesforce">Salesforce</option>
              <option value="pipedrive">Pipedrive</option>
            </select>
            <textarea
              value={newConnection.config}
              onChange={(e) => setNewConnection({ ...newConnection, config: e.target.value })}
              className="w-full border rounded px-3 py-2 font-mono text-sm"
              placeholder='{"api_key": "..."}'
              rows={4}
            />
            <div className="flex gap-2">
              <button onClick={createConnection} className="bg-violet-600 text-white px-4 py-2 rounded-lg">
                Add Connection
              </button>
              <button onClick={() => setShowCreate(false)} className="border px-4 py-2 rounded-lg">
                Cancel
              </button>
            </div>
          </div>
        </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow border p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">CRM Connections</h2>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-violet-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-sm"
            >
              <Plus size={14} /> Add
            </button>
          </div>
          {connections.length === 0 && <p className="text-gray-500">No connections.</p>}
          <div className="space-y-2">
            {connections.map((c) => (
              <div key={c.id} className="flex justify-between items-center border rounded-lg p-3">
                <div>
                  <p className="font-medium capitalize">{c.provider}</p>
                  <p className="text-xs text-gray-500">Active: {c.active ? 'Yes' : 'No'}</p>
                </div>
                <button onClick={() => deleteConnection(c.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow border p-6">
          <h2 className="font-semibold mb-4">Recent Sync Jobs</h2>
          {syncJobs.length === 0 && <p className="text-gray-500">No sync jobs.</p>}
          <div className="space-y-2">
            {syncJobs.map((j) => (
              <div key={j.id} className="border rounded-lg p-3">
                <div className="flex justify-between">
                  <p className="font-medium capitalize">{j.entity_type}</p>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    j.status === 'completed' ? 'bg-green-100 text-green-700' :
                    j.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>{j.status}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{j.direction}</p>
                <p className="text-xs text-gray-400">{new Date(j.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
        </div>
      </section>
    </div>
  );
}