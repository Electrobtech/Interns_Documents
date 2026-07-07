'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Send } from 'lucide-react';
import { useApi } from '@/lib/useApi';

export default function ConversationView() {
  const { id } = useParams();
  const { call } = useApi();
  const [conv, setConv] = useState(null);
  const [reply, setReply] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [suggesting, setSuggesting] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    call(`/conversations/${id}`).then(setConv).catch((e) => setErr(e.message));
  }, [call, id]);

  useEffect(() => { load(); }, [load]);

  // Ask the AI for a suggested reply based on the latest inbound message.
  const getSuggestion = useCallback(() => {
    setSuggesting(true);
    call('/ai-agents/suggest', { method: 'POST', body: { conversation_id: id } })
      .then(setSuggestion).catch(() => {}).finally(() => setSuggesting(false));
  }, [call, id]);

  useEffect(() => { if (conv) getSuggestion(); }, [conv, getSuggestion]);

  async function send(text) {
    const body = (text ?? reply).trim();
    if (!body) return;
    setSending(true);
    setErr('');
    try {
      await call(`/conversations/${id}/reply`, { method: 'POST', body: { body } });
      setReply('');
      setSuggestion(null);
      load();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  const name = conv?.contact_name || conv?.contact_id || 'Conversation';
  const messages = conv?.messages || [];

  return (
    <div className="p-6 max-w-3xl">
      <Link href="/inbox" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand mb-4">
        <ArrowLeft size={16} /> Back to inbox
      </Link>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
            {String(name).split(' ').map((w) => w[0]).join('').slice(0, 2)}
          </div>
          <div>
            <p className="text-sm font-medium">{name}</p>
            <p className="text-[11px] text-slate-400 capitalize">{conv?.channel_type} · {conv?.status}</p>
          </div>
        </div>

        {/* Thread */}
        <div className="p-5 space-y-3 min-h-[240px] max-h-[420px] overflow-y-auto bg-slate-50/50">
          {messages.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                m.direction === 'outbound' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                {m.body}
                <div className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-white/70' : 'text-slate-400'}`}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* AI Suggested Reply */}
        <div className="px-5 py-3 border-t border-slate-100 bg-indigo-50/40">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 mb-2">
            <Sparkles size={14} /> AI Suggested Reply
            {suggestion?.confidence != null && (
              <span className="text-[10px] font-normal text-slate-400">· {Math.round(suggestion.confidence * 100)}% confident</span>
            )}
          </div>
          {suggesting && <p className="text-xs text-slate-400">Thinking…</p>}
          {!suggesting && suggestion && (
            <>
              <p className="text-sm text-slate-700 bg-white border border-indigo-100 rounded-lg px-3 py-2">{suggestion.suggestion}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => send(suggestion.suggestion)} disabled={sending}
                  className="bg-brand text-white text-xs rounded-lg px-3 py-1.5 font-medium disabled:opacity-60">Send</button>
                <button onClick={() => setReply(suggestion.suggestion)}
                  className="border border-slate-300 text-slate-600 text-xs rounded-lg px-3 py-1.5 font-medium">Edit</button>
                <button onClick={getSuggestion}
                  className="text-slate-400 text-xs px-2 py-1.5 hover:text-brand">Regenerate</button>
              </div>
            </>
          )}
        </div>

        {/* Reply box */}
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-2">
          <input value={reply} onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a reply…" className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={() => send()} disabled={sending}
            className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
            <Send size={15} /> Send
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
    </div>
  );
}
