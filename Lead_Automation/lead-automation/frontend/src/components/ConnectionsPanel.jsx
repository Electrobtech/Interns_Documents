'use client';
import { useCallback, useEffect, useState } from 'react';
import { Instagram, Facebook, MessageCircle, Send, RefreshCw, Link2, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useApi } from '@/lib/useApi';

// ---------- Connection status card (Instagram or Facebook) ----------

function StatusCard({ platform, icon: Icon, status, onConnect, connecting }) {
  const { loading, connected, data, error } = status;
  const label = platform === 'instagram' ? 'Instagram' : 'Facebook';
  const accountName =
    platform === 'facebook' ? data?.pageName : data?.instagramBusinessAccountId;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-brand" />
          <h3 className="font-semibold text-sm">{label}</h3>
        </div>
        {loading ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Checking…
          </span>
        ) : (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {connected ? 'Connected' : 'Not Connected'}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-16 grid place-items-center">
          <Loader2 size={18} className="animate-spin text-slate-300" />
        </div>
      ) : connected ? (
        <div className="text-sm text-slate-600 space-y-1">
          <p>
            <span className="text-slate-400">Account:</span>{' '}
            {accountName || <span className="text-slate-300">—</span>}
          </p>
          <p>
            <span className="text-slate-400">Token expires:</span>{' '}
            {data?.expiresAt ? new Date(data.expiresAt).toLocaleString() : '—'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-slate-500">
          {error || `No ${label} account connected yet.`}
        </p>
      )}

      <button
        onClick={() => onConnect(platform)}
        disabled={connecting === platform}
        className="mt-1 inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
          bg-brand text-white hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {connecting === platform ? (
          <Loader2 size={14} className="animate-spin" />
        ) : connected ? (
          <RefreshCw size={14} />
        ) : (
          <Link2 size={14} />
        )}
        {connecting === platform ? 'Redirecting…' : connected ? 'Reconnect' : 'Connect'}
      </button>
    </div>
  );
}

// ---------- Post composer ----------

const PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'both', label: 'Both' },
];

function ComposerResultRow({ platform, result }) {
  if (!result) return null;
  const label = platform === 'instagram' ? 'Instagram' : 'Facebook';
  const isSuccess = result.success;
  return (
    <div
      className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${
        isSuccess ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {isSuccess ? (
          <p className="text-xs opacity-80">
            Published. ID: {result.postId || result.mediaId || result.photoId}
          </p>
        ) : (
          <div className="text-xs opacity-90 space-y-1">
            <p>{result.message}</p>
            {result.retryable && (
              <button
                onClick={result.onRetry}
                className="underline font-medium hover:no-underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function PostComposer() {
  const { call } = useApi();
  const [platform, setPlatform] = useState('instagram');
  const [imageUrl, setImageUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState(null); // { instagram?: {...}, facebook?: {...} }
  const [formError, setFormError] = useState('');

  const publishToInstagram = useCallback(async () => {
    try {
      const data = await call('/instagram/publish', {
        method: 'POST',
        body: { imageUrl, caption },
      });
      return { success: true, ...data };
    } catch (err) {
      return {
        success: false,
        message: err.data?.message || err.message || 'Failed to publish to Instagram.',
        retryable: Boolean(err.data?.retryable),
      };
    }
  }, [call, imageUrl, caption]);

  const publishToFacebook = useCallback(async () => {
    try {
      const data = imageUrl
        ? await call('/facebook/publish-photo', { method: 'POST', body: { imageUrl, caption } })
        : await call('/facebook/publish', { method: 'POST', body: { message: caption } });
      return { success: true, ...data };
    } catch (err) {
      return {
        success: false,
        message: err.data?.message || err.message || 'Failed to publish to Facebook.',
        retryable: Boolean(err.data?.retryable),
      };
    }
  }, [call, imageUrl, caption]);

  const runPublish = useCallback(
    async (targetPlatform) => {
      setFormError('');

      if ((targetPlatform === 'instagram' || targetPlatform === 'both') && !imageUrl) {
        setFormError('Instagram requires an image URL.');
        return;
      }
      if (targetPlatform === 'facebook' && !imageUrl && !caption) {
        setFormError('Add an image URL or a message to post.');
        return;
      }
      if (targetPlatform === 'both' && !caption && !imageUrl) {
        setFormError('Add a caption/message.');
        return;
      }

      setSubmitting(true);
      const next = {};

      if (targetPlatform === 'instagram' || targetPlatform === 'both') {
        next.instagram = await publishToInstagram();
      }
      if (targetPlatform === 'facebook' || targetPlatform === 'both') {
        next.facebook = await publishToFacebook();
      }

      setResults(next);
      setSubmitting(false);
    },
    [imageUrl, caption, publishToInstagram, publishToFacebook]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    runPublish(platform);
  };

  const retry = (key) => runPublish(key === 'both' ? platform : key);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h3 className="font-semibold text-sm mb-4">Publish a post</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Platform</label>
          <select
            value={platform}
            onChange={(e) => { setPlatform(e.target.value); setResults(null); }}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {PLATFORM_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Image URL {platform !== 'facebook' && <span className="text-red-400">*</span>}
          </label>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Must be a public image URL — there's no file upload yet.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Caption / message</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            placeholder="Write something…"
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {formError && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle size={14} /> {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg
            bg-brand text-white hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Publishing…' : 'Publish'}
        </button>
      </form>

      {results && (
        <div className="mt-4 space-y-2">
          {results.instagram && (
            <ComposerResultRow
              platform="instagram"
              result={{ ...results.instagram, onRetry: () => retry('instagram') }}
            />
          )}
          {results.facebook && (
            <ComposerResultRow
              platform="facebook"
              result={{ ...results.facebook, onRetry: () => retry('facebook') }}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ---------- WhatsApp card ----------
// Unlike Instagram/Facebook, WhatsApp Cloud API has no OAuth redirect here —
// credentials (Phone Number ID, WABA ID, permanent access token) are
// generated once in Meta Business Manager and pasted in directly.
// See services/integration-service/src/routes/whatsapp.js.

function WhatsAppConnectForm({ onConnected }) {
  const { call } = useApi();
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await call('/whatsapp/connect', {
        method: 'POST',
        body: { phoneNumberId, wabaId, accessToken },
      });
      setAccessToken('');
      onConnected();
    } catch (err) {
      setError(err.data?.error || err.message || 'Could not save this connection.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-sm">
      <input
        value={phoneNumberId}
        onChange={(e) => setPhoneNumberId(e.target.value)}
        placeholder="Phone Number ID"
        required
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <input
        value={wabaId}
        onChange={(e) => setWabaId(e.target.value)}
        placeholder="WhatsApp Business Account ID"
        required
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <input
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        placeholder="Permanent access token"
        type="password"
        required
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
          bg-brand text-white hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        {submitting ? 'Saving…' : 'Save & Connect'}
      </button>
    </form>
  );
}

function WhatsAppSendTest() {
  const { call } = useApi();
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult(null);
    try {
      const data = await call('/whatsapp/send', { method: 'POST', body: { to, text } });
      setResult({ success: true, ...data });
    } catch (err) {
      setResult({
        success: false,
        message: err.data?.message || err.data?.error || err.message || 'Failed to send.',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={handleSend} className="space-y-2 text-sm border-t border-slate-100 pt-3 mt-1">
      <p className="text-xs font-medium text-slate-500">Send a test message</p>
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Recipient number, e.g. 14155551234"
        required
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Message text"
        required
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <button
        type="submit"
        disabled={sending}
        className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
          border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-60"
      >
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        {sending ? 'Sending…' : 'Send'}
      </button>
      {result && (
        <p className={`text-xs ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>
          {result.success ? `Sent. Message ID: ${result.messageId}` : result.message}
        </p>
      )}
      <p className="text-[11px] text-slate-400">
        Free-form text only works within 24h of the recipient's last message to you —
        otherwise use a pre-approved template via /whatsapp/send-template.
      </p>
    </form>
  );
}

function WhatsAppCard() {
  const { call } = useApi();
  const [status, setStatus] = useState({ loading: true, connected: false, data: null, error: '' });

  const loadStatus = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    try {
      const data = await call('/whatsapp/status');
      setStatus({ loading: false, connected: Boolean(data.connected), data, error: '' });
    } catch (err) {
      setStatus({ loading: false, connected: false, data: null, error: err.data?.error || err.message });
    }
  }, [call]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const { loading, connected, data } = status;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col gap-3 md:col-span-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-brand" />
          <h3 className="font-semibold text-sm">WhatsApp</h3>
        </div>
        {loading ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" /> Checking…
          </span>
        ) : (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            connected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
          }`}>
            {connected ? 'Connected' : 'Not Connected'}
          </span>
        )}
      </div>

      {connected && (
        <div className="text-sm text-slate-600 space-y-1">
          <p><span className="text-slate-400">Number:</span> {data?.displayPhoneNumber || '—'}</p>
          <p><span className="text-slate-400">Verified name:</span> {data?.verifiedName || '—'}</p>
        </div>
      )}

      <WhatsAppConnectForm onConnected={loadStatus} />
      {connected && <WhatsAppSendTest />}
    </div>
  );
}

// ---------- Top-level panel ----------

export default function ConnectionsPanel() {
  const { call } = useApi();
  const [instagram, setInstagram] = useState({ loading: true, connected: false, data: null, error: '' });
  const [facebook, setFacebook] = useState({ loading: true, connected: false, data: null, error: '' });
  const [connecting, setConnecting] = useState(null);
  const [connectError, setConnectError] = useState('');

  const loadStatus = useCallback(async (platform, setter) => {
    setter((s) => ({ ...s, loading: true }));
    try {
      const data = await call(`/${platform}/status`);
      setter({ loading: false, connected: Boolean(data.connected), data, error: '' });
    } catch (err) {
      // /instagram/status and /facebook/status return a 400 with
      // {connected: false, error} when nothing is connected yet — that's
      // an expected state here, not a hard failure.
      setter({
        loading: false,
        connected: false,
        data: null,
        error: err.data?.error || err.message,
      });
    }
  }, [call]);

  useEffect(() => {
    loadStatus('instagram', setInstagram);
    loadStatus('facebook', setFacebook);
  }, [loadStatus]);

  const handleConnect = useCallback(
    async (platform) => {
      setConnectError('');
      setConnecting(platform);
      try {
        const { url } = await call('/auth/connect-url');
        // Top-level browser redirect — Facebook's OAuth dialog cannot be
        // opened via fetch/AJAX, and this cannot be a popup per the spec.
        window.location.href = url;
      } catch (err) {
        setConnectError(err.data?.message || err.message || 'Could not start the connection. Please try again.');
        setConnecting(null);
      }
    },
    [call]
  );

  return (
    <div className="space-y-6">
      {connectError && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} /> {connectError}
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusCard
          platform="instagram"
          icon={Instagram}
          status={instagram}
          onConnect={handleConnect}
          connecting={connecting}
        />
        <StatusCard
          platform="facebook"
          icon={Facebook}
          status={facebook}
          onConnect={handleConnect}
          connecting={connecting}
        />
        <WhatsAppCard />
      </div>

      <PostComposer />
    </div>
  );
}
