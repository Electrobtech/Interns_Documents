'use client';
import { Link2, Unlink, RefreshCw, Loader2 } from 'lucide-react';

export default function ConnectionPanel({
  status, statusLoading, accounts, locations, busy, configured,
  onConnect, onDisconnect, onLoadAccounts, onLoadLocations, onSelectLocation, onSync,
}) {
  if (statusLoading) {
    return <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-400">Checking Google connection…</div>;
  }

  if (!status?.connected) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm text-slate-800">Connect Google Business Profile</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {configured
              ? 'Sync your Google reviews and reply to customers right from this dashboard.'
              : 'Save your Google Client ID and Client Secret above before connecting.'}
          </p>
        </div>
        <button onClick={onConnect} disabled={busy || !configured}
          className="flex items-center gap-1.5 bg-brand text-white text-sm rounded-lg px-4 py-2 font-medium disabled:opacity-60 shrink-0">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />} Connect Google Business
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <p className="text-sm font-medium text-slate-700">Connected to Google Business Profile</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => onSync()} disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 hover:text-brand disabled:opacity-60">
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} /> Sync now
          </button>
          <button onClick={onDisconnect} disabled={busy}
            className="flex items-center gap-1.5 text-xs font-medium border border-slate-300 rounded-lg px-3 py-1.5 text-slate-500 hover:text-red-500 disabled:opacity-60">
            <Unlink size={13} /> Disconnect
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
        {status.lastSyncAt && <span>Last synced {new Date(status.lastSyncAt).toLocaleString()}</span>}
        {status.lastSyncStatus === 'error' && (
          <span className="text-red-500">Last sync had errors: {status.lastSyncError}</span>
        )}
        {!accounts.length && (
          <button onClick={onLoadAccounts} className="text-brand font-medium hover:text-brand-dark">
            Load businesses →
          </button>
        )}
      </div>

      {!!accounts.length && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Business</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              onChange={(e) => onLoadLocations(e.target.value)}
              defaultValue={accounts[0]?.accountId}
            >
              {accounts.map((a) => <option key={a.accountId} value={a.accountId}>{a.accountName}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Location</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
              value={status.selectedLocationId || ''}
              onChange={(e) => onSelectLocation(e.target.value)}
            >
              <option value="">Select a location…</option>
              {locations.map((l) => <option key={l.locationId} value={l.locationId}>{l.locationName}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
