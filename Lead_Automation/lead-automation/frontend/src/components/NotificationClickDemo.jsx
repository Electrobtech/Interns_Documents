'use client';
import { useState } from 'react';
import { Bell, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useApi } from '@/lib/useApi';

// Demo card: clicking the button fires an async POST to the dummy
// notification-service (via the gateway at /notifications/click) and
// surfaces loading / success / error state back in the UI.
export default function NotificationClickDemo() {
  const { call } = useApi();
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleClick() {
    if (status === 'loading') return; // guard against double-clicks
    setStatus('loading');
    setError(null);
    try {
      const data = await call('/notifications/click', {
        method: 'POST',
        body: { source: 'notification-demo-card', label: 'Send test notification' },
      });
      setResult(data.notification);
      setStatus('success');
    } catch (e) {
      setError(e.message || 'Something went wrong');
      setStatus('error');
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 max-w-sm">
      <div className="flex items-center gap-2 mb-1">
        <Bell size={16} className="text-brand" />
        <h3 className="font-semibold text-sm">Click Notification Demo</h3>
      </div>
      <p className="text-xs text-slate-500 mb-4">
        Sends a request to the dummy backend and reports what came back.
      </p>

      <button
        onClick={handleClick}
        disabled={status === 'loading'}
        className="flex items-center justify-center gap-1.5 bg-brand text-white text-sm rounded-lg px-3 py-2 font-medium disabled:opacity-60 w-full"
      >
        {status === 'loading' ? (
          <>
            <Loader2 size={15} className="animate-spin" /> Sending…
          </>
        ) : (
          'Send test notification'
        )}
      </button>

      {status === 'success' && result && (
        <div className="mt-3 flex items-start gap-2 bg-emerald-50 text-emerald-700 text-xs rounded-lg px-3 py-2">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>
            Notification received (id: {result.id.slice(0, 8)}…) at{' '}
            {new Date(result.receivedAt).toLocaleTimeString()}.
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 flex items-start gap-2 bg-red-50 text-red-700 text-xs rounded-lg px-3 py-2">
          <XCircle size={15} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
