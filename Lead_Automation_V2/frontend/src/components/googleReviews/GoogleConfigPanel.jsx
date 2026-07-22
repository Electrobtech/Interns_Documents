'use client';
import { useEffect, useState } from 'react';
import { KeyRound, Loader2, CheckCircle2 } from 'lucide-react';

export default function GoogleConfigPanel({ config, configLoading, savingConfig, onSaveConfig }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [touched, setTouched] = useState(false);

  // Only the Client ID is ever returned by the backend — the secret is
  // never echoed back, so the password field always starts blank.
  useEffect(() => {
    if (config?.clientId) setClientId(config.clientId);
  }, [config?.clientId]);

  const clientIdValid = clientId.trim().length > 0;
  const clientSecretValid = clientSecret.trim().length > 0;

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!clientIdValid || !clientSecretValid) return;
    const ok = await onSaveConfig(clientId.trim(), clientSecret.trim());
    if (ok) setClientSecret('');
  };

  if (configLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-400">
        Loading Google OAuth configuration…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={15} className="text-slate-400" />
          <p className="font-semibold text-sm text-slate-800">Google OAuth Credentials</p>
        </div>
        {config?.configured && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 size={13} /> Configured
          </span>
        )}
      </div>
      <p className="text-xs text-slate-400 -mt-2">
        Use your own Google Cloud OAuth client so this Google Business Profile connects under your
        company's credentials. Save these before clicking Connect below.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Google Client ID</label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="xxxxxxxx.apps.googleusercontent.com"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          {touched && !clientIdValid && <p className="text-xs text-red-500 mt-1">Client ID is required</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Google Client Secret</label>
          <input
            type="password"
            value={clientSecret}
            onChange={(e) => setClientSecret(e.target.value)}
            placeholder={config?.configured ? 'Enter a new secret to replace it' : 'Enter client secret'}
            autoComplete="new-password"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          {touched && !clientSecretValid && <p className="text-xs text-red-500 mt-1">Client Secret is required</p>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        {config?.updatedAt
          ? <p className="text-xs text-slate-400">Last saved {new Date(config.updatedAt).toLocaleString()}</p>
          : <span />}
        <button
          type="submit"
          disabled={savingConfig}
          className="flex items-center gap-1.5 bg-slate-800 text-white text-sm rounded-lg px-4 py-2 font-medium disabled:opacity-60"
        >
          {savingConfig && <Loader2 size={15} className="animate-spin" />}
          Save
        </button>
      </div>
    </form>
  );
}
