'use client';
import { useCallback, useEffect, useState } from 'react';
import { Instagram, Facebook, MessageCircle, Send, RefreshCw, Link2, AlertCircle, CheckCircle2, Loader2, Lock, Unlock } from 'lucide-react';
import { useApi } from '@/lib/useApi';

// ---------- Manual credentials form (Facebook/Instagram) ----------
// Alternative to the OAuth "Connect" button above — lets an admin paste in
// a Meta App ID / App Secret / Page ID / Page Access Token by hand instead
// (e.g. from Meta Business Manager). Hits the same backend endpoint the
// OAuth flow would end up at: POST /credentials/facebook. The token is
// validated against Meta's own /debug_token endpoint server-side, and the
// connection is locked automatically the moment it's saved — see
// services/integration-service/src/routes/credentials.js.

function FacebookCredentialsForm({ locked, isAdmin, onConnected }) {
  const { call } = useApi();
  const [appId, setAppId] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [pageAccessToken, setPageAccessToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await call('/credentials/facebook', {
        method: 'POST',
        body: { appId, appSecret, pageId, pageName, pageAccessToken },
      });
      setAppSecret('');
      setPageAccessToken('');
      onConnected();
    } catch (err) {
      setError(err.data?.error || err.message || 'Could not save these credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  if (locked && !isAdmin) return null; // StatusCard already shows the shared "locked" notice.

  return (
    <details className="mt-1 group">
      <summary className="text-xs font-medium text-slate-500 cursor-pointer select-none hover:text-slate-700">
        Or enter App ID / Page credentials manually
      </summary>
      <form onSubmit={handleSubmit} className="space-y-2 text-sm mt-2">
        {locked && isAdmin && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
            <Lock size={12} /> Locked — use "Unlock to reconnect" above before saving new credentials here.
          </p>
        )}
        <input
          value={appId}
          onChange={(e) => setAppId(e.target.value)}
          placeholder="Meta App ID"
          disabled={locked}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <input
          value={appSecret}
          onChange={(e) => setAppSecret(e.target.value)}
          placeholder="Meta App Secret"
          type="password"
          disabled={locked}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <input
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          placeholder="Page ID"
          required
          disabled={locked}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <input
          value={pageName}
          onChange={(e) => setPageName(e.target.value)}
          placeholder="Page name (optional, cosmetic)"
          disabled={locked}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <input
          value={pageAccessToken}
          onChange={(e) => setPageAccessToken(e.target.value)}
          placeholder="Page Access Token"
          type="password"
          required
          disabled={locked}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <p className="text-[11px] text-slate-400">
          The linked Instagram Business Account is auto-detected from the Page. Saving locks this
          connection immediately — an admin can unlock it later to change these values.
        </p>
        {error && (
          <p className="text-sm text-red-600 flex items-center gap-1">
            <AlertCircle size={14} /> {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || locked}
          className="w-full inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
            bg-brand text-white hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting && <Loader2 size={14} className="animate-spin" />}
          {submitting ? 'Saving…' : 'Save & Lock'}
        </button>
      </form>
    </details>
  );
}

// ---------- Admin password prompt shown before an unlock goes through ----------

function UnlockPasswordPrompt({ onConfirm, onCancel, unlocking, error }) {
  const [password, setPassword] = useState('');

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onConfirm(password);
      }}
      className="mt-1 space-y-2"
    >
      <p className="text-xs text-slate-500">Enter the admin password to unlock this connection.</p>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Admin password"
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={unlocking || !password}
          className="inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
            border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {unlocking ? <Loader2 size={14} className="animate-spin" /> : <Unlock size={14} />}
          {unlocking ? 'Unlocking…' : 'Confirm unlock'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={unlocking}
          className="text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- Connection status card (Instagram or Facebook) ----------

function StatusCard({ platform, icon: Icon, status, onConnect, connecting, isAdmin, onUnlock, unlocking, onConnected }) {
  const { loading, connected, data, error } = status;
  const locked = Boolean(data?.locked);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockError, setUnlockError] = useState('');

  const handleConfirmUnlock = async (password) => {
    setUnlockError('');
    try {
      await onUnlock(platform, password);
      setShowUnlockPrompt(false);
    } catch (err) {
      setUnlockError(err.data?.error || err.message || 'Could not unlock this connection.');
    }
  };
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
          <div className="flex items-center gap-1.5">
            {locked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 flex items-center gap-1">
                <Lock size={10} /> Locked
              </span>
            )}
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                connected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
              }`}
            >
              {connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
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

      {locked && !isAdmin && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          This connection is locked to keep it from being changed by mistake. Ask an account admin if it needs to be reconnected.
        </p>
      )}

      {platform === 'facebook' && (!locked || isAdmin) && (
        <FacebookCredentialsForm locked={locked} isAdmin={isAdmin} onConnected={onConnected} />
      )}

      {locked ? (
        isAdmin && (
          showUnlockPrompt ? (
            <UnlockPasswordPrompt
              onConfirm={handleConfirmUnlock}
              onCancel={() => { setShowUnlockPrompt(false); setUnlockError(''); }}
              unlocking={unlocking === platform}
              error={unlockError}
            />
          ) : (
            <button
              onClick={() => setShowUnlockPrompt(true)}
              className="mt-1 inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
                border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Unlock size={14} />
              Unlock to reconnect
            </button>
          )
        )
      ) : (
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
      )}
    </div>
  );
}

// ---------- Post composers ----------
// Split into one always-visible block per platform (Instagram, Facebook)
// instead of a single form behind a Platform dropdown — same layout pattern
// as the dedicated Google Reviews block, so each channel is its own card.

const INSTAGRAM_POST_TYPES = [
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video / Reel' },
];

// Instagram's Graph API has no text-only post type — every IG post needs a
// photo or video attached. This isn't a bug in this app, it's a Meta
// platform restriction, so the UI reflects it instead of hiding it and
// letting the request fail on Meta's side.
const FACEBOOK_POST_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'image', label: 'Image' },
  { value: 'video', label: 'Video' },
];

function ComposerResultRow({ label, result }) {
  if (!result) return null;
  const isSuccess = result.success;
  const isSkipped = !isSuccess && result.skipped;
  const tone = isSuccess
    ? 'bg-emerald-50 text-emerald-700'
    : isSkipped
    ? 'bg-slate-100 text-slate-600'
    : 'bg-red-50 text-red-700';

  return (
    <div className={`flex items-start gap-2 text-sm rounded-lg px-3 py-2 ${tone}`}>
      {isSuccess ? (
        <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
      ) : (
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
      )}
      <div className="flex-1">
        <p className="font-medium">{label}</p>
        {isSuccess ? (
          <p className="text-xs opacity-80">
            Published. ID: {result.postId || result.mediaId || result.videoId || result.photoId}
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

function InstagramComposer() {
  const { call } = useApi();
  const [postType, setPostType] = useState('image');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [isReel, setIsReel] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  const publish = useCallback(async () => {
    try {
      const body =
        postType === 'video'
          ? { videoUrl: mediaUrl, caption, isReel }
          : { imageUrl: mediaUrl, caption };
      const data = await call('/instagram/publish', { method: 'POST', body });
      return { success: true, ...data };
    } catch (err) {
      return {
        success: false,
        message: err.data?.message || err.message || 'Failed to publish to Instagram.',
        retryable: Boolean(err.data?.retryable),
      };
    }
  }, [call, postType, mediaUrl, caption, isReel]);

  const run = useCallback(async () => {
    setFormError('');
    if (!mediaUrl.trim()) {
      setFormError(`Add a public ${postType} URL to publish.`);
      return;
    }
    setSubmitting(true);
    setResult(await publish());
    setSubmitting(false);
  }, [postType, mediaUrl, publish]);

  const handleSubmit = (e) => {
    e.preventDefault();
    run();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Instagram size={18} className="text-brand" />
        <h3 className="font-semibold text-sm">Publish to Instagram</h3>
      </div>
      <p className="text-[11px] text-slate-400 mb-3">
        Instagram requires a photo or video for every post — text-only isn't supported by its API.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Post type</label>
          <div className="flex gap-2">
            {INSTAGRAM_POST_TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { setPostType(o.value); setResult(null); setFormError(''); }}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 ${
                  postType === o.value ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {postType === 'video' ? 'Video URL' : 'Image URL'} <span className="text-red-400">*</span>
          </label>
          <input
            type="url"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder={postType === 'video' ? 'https://example.com/clip.mp4' : 'https://example.com/photo.jpg'}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
          <p className="text-[11px] text-slate-400 mt-1">
            Must be a public, direct file URL — there's no file upload yet, so host it somewhere reachable first (S3, Cloudinary, etc.).
          </p>
        </div>

        {postType === 'video' && (
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              className="w-4 h-4 accent-brand"
              checked={isReel}
              onChange={(e) => setIsReel(e.target.checked)}
            />
            Publish as a Reel (uncheck for a regular feed video)
          </label>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Caption</label>
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

      {result && (
        <div className="mt-4">
          <ComposerResultRow label="Instagram" result={{ ...result, onRetry: run }} />
        </div>
      )}
    </div>
  );
}

function FacebookComposer() {
  const { call } = useApi();
  const [postType, setPostType] = useState('text');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [formError, setFormError] = useState('');

  const publish = useCallback(async () => {
    try {
      let data;
      if (postType === 'text') {
        data = await call('/facebook/publish', { method: 'POST', body: { message: caption } });
      } else if (postType === 'video') {
        data = await call('/facebook/publish-video', {
          method: 'POST',
          body: { videoUrl: mediaUrl, description: caption },
        });
      } else {
        data = await call('/facebook/publish-photo', {
          method: 'POST',
          body: { imageUrl: mediaUrl, caption },
        });
      }
      return { success: true, ...data };
    } catch (err) {
      return {
        success: false,
        message: err.data?.message || err.message || 'Failed to publish to Facebook.',
        retryable: Boolean(err.data?.retryable),
      };
    }
  }, [call, postType, mediaUrl, caption]);

  const run = useCallback(async () => {
    setFormError('');
    if (postType !== 'text' && !mediaUrl.trim()) {
      setFormError(`Add a public ${postType} URL to publish.`);
      return;
    }
    if (postType === 'text' && !caption.trim()) {
      setFormError('Write something to post.');
      return;
    }
    setSubmitting(true);
    setResult(await publish());
    setSubmitting(false);
  }, [postType, mediaUrl, caption, publish]);

  const handleSubmit = (e) => {
    e.preventDefault();
    run();
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Facebook size={18} className="text-brand" />
        <h3 className="font-semibold text-sm">Publish to Facebook</h3>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Post type</label>
          <div className="flex gap-2">
            {FACEBOOK_POST_TYPES.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { setPostType(o.value); setResult(null); setFormError(''); }}
                className={`text-xs font-medium rounded-lg px-3 py-1.5 ${
                  postType === o.value ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {postType !== 'text' && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              {postType === 'video' ? 'Video URL' : 'Image URL'} <span className="text-red-400">*</span>
            </label>
            <input
              type="url"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder={postType === 'video' ? 'https://example.com/clip.mp4' : 'https://example.com/photo.jpg'}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Must be a public, direct file URL — there's no file upload yet, so host it somewhere reachable first (S3, Cloudinary, etc.).
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            {postType === 'text' ? 'Message' : 'Caption'} {postType === 'text' && <span className="text-red-400">*</span>}
          </label>
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

      {result && (
        <div className="mt-4">
          <ComposerResultRow label="Facebook" result={{ ...result, onRetry: run }} />
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

function WhatsAppConnectForm({ onConnected, locked, isAdmin }) {
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

  if (locked && !isAdmin) {
    return (
      <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
        <Lock size={12} /> This connection is locked to keep it from being changed by mistake. Ask an account admin if it needs to be reconnected.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 text-sm">
      {locked && isAdmin && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <Lock size={12} /> Locked — use "Unlock to reconnect" below before saving new credentials here.
        </p>
      )}
      <input
        value={phoneNumberId}
        onChange={(e) => setPhoneNumberId(e.target.value)}
        placeholder="Phone Number ID"
        required
        disabled={locked}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <input
        value={wabaId}
        onChange={(e) => setWabaId(e.target.value)}
        placeholder="WhatsApp Business Account ID"
        required
        disabled={locked}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <input
        value={accessToken}
        onChange={(e) => setAccessToken(e.target.value)}
        placeholder="Permanent access token"
        type="password"
        required
        disabled={locked}
        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-slate-50 disabled:text-slate-400"
      />
      {error && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <AlertCircle size={14} /> {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || locked}
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

function WhatsAppCard({ isAdmin }) {
  const { call } = useApi();
  const [status, setStatus] = useState({ loading: true, connected: false, data: null, error: '' });
  const [unlocking, setUnlocking] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [unlockError, setUnlockError] = useState('');

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
  const locked = Boolean(data?.locked);

  const handleUnlock = async (password) => {
    setUnlocking(true);
    setUnlockError('');
    try {
      await call('/whatsapp/unlock', { method: 'POST', body: { password } });
      await loadStatus();
      setShowUnlockPrompt(false);
    } catch (err) {
      setUnlockError(err.data?.error || err.message || 'Could not unlock this connection.');
    } finally {
      setUnlocking(false);
    }
  };

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
          <div className="flex items-center gap-1.5">
            {locked && (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-50 text-amber-600 flex items-center gap-1">
                <Lock size={10} /> Locked
              </span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              connected ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}>
              {connected ? 'Connected' : 'Not Connected'}
            </span>
          </div>
        )}
      </div>

      {connected && (
        <div className="text-sm text-slate-600 space-y-1">
          <p><span className="text-slate-400">Number:</span> {data?.displayPhoneNumber || '—'}</p>
          <p><span className="text-slate-400">Verified name:</span> {data?.verifiedName || '—'}</p>
        </div>
      )}

      <WhatsAppConnectForm onConnected={loadStatus} locked={locked} isAdmin={isAdmin} />

      {locked && isAdmin && (
        showUnlockPrompt ? (
          <div className="self-start w-full max-w-xs">
            <UnlockPasswordPrompt
              onConfirm={handleUnlock}
              onCancel={() => { setShowUnlockPrompt(false); setUnlockError(''); }}
              unlocking={unlocking}
              error={unlockError}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowUnlockPrompt(true)}
            className="self-start inline-flex items-center justify-center gap-2 text-sm font-medium px-3 py-2 rounded-lg
              border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Unlock size={14} />
            Unlock to reconnect
          </button>
        )
      )}
    </div>
  );
}

// ---------- Top-level panel ----------

export default function ConnectionsPanel() {
  const { call } = useApi();
  const [instagram, setInstagram] = useState({ loading: true, connected: false, data: null, error: '' });
  const [facebook, setFacebook] = useState({ loading: true, connected: false, data: null, error: '' });
  const [connecting, setConnecting] = useState(null);
  const [unlocking, setUnlocking] = useState(null);
  const [connectError, setConnectError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    call('/auth/profile').then((p) => setIsAdmin(p?.role === 'admin')).catch(() => {});
  }, [call]);

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
        setConnectError(err.data?.error || err.data?.message || err.message || 'Could not start the connection. Please try again.');
        setConnecting(null);
      }
    },
    [call]
  );

  const handleUnlock = useCallback(
    async (platform, password) => {
      setConnectError('');
      setUnlocking(platform);
      try {
        // Instagram and Facebook share one underlying connection row, so
        // either card's Unlock button lifts the lock for both.
        await call('/auth/unlock', { method: 'POST', body: { password } });
        await Promise.all([loadStatus('instagram', setInstagram), loadStatus('facebook', setFacebook)]);
      } catch (err) {
        // Re-throw so the card's own password prompt can show the error
        // inline (e.g. wrong password) instead of only the page-level banner.
        throw err;
      } finally {
        setUnlocking(null);
      }
    },
    [call, loadStatus]
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
          isAdmin={isAdmin}
          onUnlock={handleUnlock}
          unlocking={unlocking}
        />
        <StatusCard
          platform="facebook"
          icon={Facebook}
          status={facebook}
          onConnect={handleConnect}
          connecting={connecting}
          isAdmin={isAdmin}
          onUnlock={handleUnlock}
          unlocking={unlocking}
          onConnected={() => {
            loadStatus('instagram', setInstagram);
            loadStatus('facebook', setFacebook);
          }}
        />
        <WhatsAppCard isAdmin={isAdmin} />
      </div>
    </div>
  );
}

// InstagramComposer, FacebookComposer ("Publish to Instagram" / "Publish to
// Facebook") and WhatsAppSendTest ("Send a test message") live in Reviews &
// Social now, not here — Integrations & APIs is credentials-only.
// Re-exported so that page can render them directly, each as its own block.
export { InstagramComposer, FacebookComposer, WhatsAppSendTest };