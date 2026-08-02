'use client';
import { useCallback, useEffect, useState } from 'react';
import { Send, Bot, Headset, RotateCcw, FileText } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { useConversationRoom, useSocketEvent } from '@/lib/socket';

// Same options-normalizing helper as ConversationThread.jsx — see that file
// for the full rationale (per-channel button/list shapes -> a flat
// {id,label} option list plus the workflowEngine interaction type).
function getMessageOptions(message) {
  const meta = message?.metadata;
  if (!meta || typeof meta !== 'object') return null;

  if (meta.type === 'interactive' && meta.interactive?.type === 'button') {
    const options = (meta.interactive.action?.buttons || [])
      .map((b) => ({ id: b.reply?.id, label: b.reply?.title }))
      .filter((o) => o.id);
    return options.length ? { interactionType: 'button_click', options } : null;
  }
  if (meta.type === 'interactive' && meta.interactive?.type === 'list') {
    const options = (meta.interactive.action?.sections || [])
      .flatMap((s) => (s.rows || []).map((r) => ({ id: r.id, label: r.title })))
      .filter((o) => o.id);
    return options.length ? { interactionType: 'list_select', options } : null;
  }
  if (meta.type === 'buttons' && Array.isArray(meta.buttons)) {
    const options = meta.buttons.map((b) => ({ id: b.id, label: b.label })).filter((o) => o.id);
    return options.length ? { interactionType: 'button_click', options } : null;
  }
  if (meta.type === 'list' && meta.list?.sections) {
    const options = meta.list.sections
      .flatMap((s) => (s.rows || []).map((r) => ({ id: r.id, label: r.title })))
      .filter((o) => o.id);
    return options.length ? { interactionType: 'list_select', options } : null;
  }
  return null;
}

// Right-hand pane of the WhatsApp split view — same underlying behavior as
// ConversationThread.jsx (bot/human toggle, reset, send-as customer/agent,
// clickable bot options, document attachments) but embedded inline instead
// of being its own route: takes `conversationId` as a prop and fills the
// height of its parent pane rather than rendering a back link.
export default function ActiveChatPanel({ conversationId, onConversationChanged }) {
  const { call } = useApi();
  const [conv, setConv] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [err, setErr] = useState('');
  const [sendAs, setSendAs] = useState('customer');

  const load = useCallback(() => {
    call(`/conversations/${conversationId}`).then((c) => {
      setConv(c);
      onConversationChanged?.();
    }).catch((e) => setErr(e.message));
  }, [call, conversationId, onConversationChanged]);

  useEffect(() => { load(); }, [load]);

  useConversationRoom(conversationId);
  useSocketEvent('message:new', (message) => {
    if (message.conversation_id !== conversationId) return;
    setConv((c) => {
      if (!c || c.messages?.some((m) => m.id === message.id)) return c;
      return { ...c, messages: [...(c.messages || []), message], handled_by: message.handled_by ?? c.handled_by, status: message.status ?? c.status };
    });
    onConversationChanged?.();
  }, [conversationId]);

  const resetConversation = useCallback(async () => {
    if (!conv || resetting) return;
    if (!window.confirm('Reset this conversation? This clears the message history so you can run the demo again.')) return;
    setResetting(true);
    setErr('');
    try {
      await call(`/conversations/${conversationId}/reset`, { method: 'POST' });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setResetting(false);
    }
  }, [conv, resetting, call, conversationId, load]);

  const setHandledBy = useCallback(async (next) => {
    if (!conv || conv.handled_by === next || switching) return;
    setSwitching(true);
    setConv((c) => ({ ...c, handled_by: next }));
    try {
      const updated = await call(`/conversations/${conversationId}/handled-by`, { method: 'PUT', body: { handled_by: next } });
      setConv((c) => ({ ...c, ...updated }));
    } catch (e) {
      setErr(e.message);
      load();
    } finally {
      setSwitching(false);
    }
  }, [conv, switching, call, conversationId, load]);

  async function send(text) {
    const body = (text ?? reply).trim();
    if (!body) return;
    setSending(true);
    setErr('');
    try {
      if (sendAs === 'customer') {
        await call('/automation/internal/inbox-reply', {
          method: 'POST',
          body: { conversationId, interaction: { type: 'text', text: body } },
        });
      } else {
        await call(`/conversations/${conversationId}/reply`, { method: 'POST', body: { body } });
      }
      setReply('');
      load();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  async function selectOption(option, interactionType) {
    if (!conv || selecting) return;
    setSelecting(true);
    setErr('');
    try {
      await call('/automation/internal/inbox-reply', {
        method: 'POST',
        body: { conversationId, interaction: { type: interactionType, selectedId: option.id, label: option.label } },
      });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSelecting(false); }
  }

  const name = conv?.contact_name || conv?.contact_id || 'Conversation';
  const messages = conv?.messages || [];
  const initials = String(name).trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      {/* Header */}
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-full bg-slate-200 grid place-items-center text-xs font-semibold text-slate-600">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-[11px] text-slate-400 capitalize">{conv?.channel_type} · {conv?.status}</p>
        </div>
        {conv && (
          <>
            <button
              onClick={resetConversation}
              disabled={resetting}
              title="Clear this conversation's history and start it fresh"
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-red-600 hover:border-red-200 transition-colors disabled:opacity-60"
            >
              <RotateCcw size={13} /> {resetting ? 'Resetting…' : 'Reset'}
            </button>
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setHandledBy('bot')}
                disabled={switching}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-60"
                style={{
                  background: conv.handled_by === 'bot' ? '#fff' : 'transparent',
                  color: conv.handled_by === 'bot' ? '#26241F' : '#8A8578',
                  boxShadow: conv.handled_by === 'bot' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Bot size={13} /> Bot
              </button>
              <button
                onClick={() => setHandledBy('human')}
                disabled={switching}
                className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors disabled:opacity-60"
                style={{
                  background: conv.handled_by === 'human' ? '#fff' : 'transparent',
                  color: conv.handled_by === 'human' ? '#26241F' : '#8A8578',
                  boxShadow: conv.handled_by === 'human' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                <Headset size={13} /> Human
              </button>
            </div>
          </>
        )}
      </div>

      {/* Thread */}
      <div className="flex-1 p-5 space-y-3 overflow-y-auto bg-slate-50/50">
        {messages.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>}
        {messages.map((m, i) => {
          const isLatest = i === messages.length - 1;
          const opts = isLatest && m.direction === 'outbound' ? getMessageOptions(m) : null;
          const doc = m.metadata?.document;
          const docUrl = m.message_type === 'document' ? (doc?.url || doc?.link) : null;
          return (
            <div key={m.id} className={`flex flex-col ${m.direction === 'outbound' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap ${
                m.direction === 'outbound' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                {m.body}
                {docUrl && (
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium rounded-lg px-2.5 py-1.5 ${
                      m.direction === 'outbound' ? 'bg-white/15 hover:bg-white/25' : 'bg-slate-50 hover:bg-slate-100 border border-slate-200'}`}
                  >
                    <FileText size={13} />
                    <span className="truncate">{doc?.filename || 'Attachment'}</span>
                  </a>
                )}
                <div className={`text-[10px] mt-1 ${m.direction === 'outbound' ? 'text-white/70' : 'text-slate-400'}`}>
                  {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </div>
              </div>
              {opts && (
                <div className="max-w-[75%] flex flex-wrap gap-2 mt-2">
                  {opts.options.map((o) => (
                    <button
                      key={o.id}
                      disabled={selecting}
                      onClick={() => selectOption(o, opts.interactionType)}
                      title="Simulate the customer tapping this option"
                      className="text-xs font-medium px-3 py-1.5 rounded-full border border-brand text-brand hover:bg-brand hover:text-white transition-colors disabled:opacity-50"
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Send-as toggle */}
      <div className="px-5 pt-3 flex items-center gap-2 border-t border-slate-100 shrink-0">
        <span className="text-[11px] text-slate-400">Send as:</span>
        <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
          <button
            onClick={() => setSendAs('customer')}
            title='Simulates an inbound message from the customer — triggers the automation flow, e.g. type "hi" to fire the welcome playbook'
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: sendAs === 'customer' ? '#fff' : 'transparent',
              color: sendAs === 'customer' ? '#26241F' : '#8A8578',
              boxShadow: sendAs === 'customer' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Bot size={13} /> Customer (simulate)
          </button>
          <button
            onClick={() => setSendAs('agent')}
            title="Sends as you, the logged-in agent — a plain outbound message, no automation triggered"
            className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md transition-colors"
            style={{
              background: sendAs === 'agent' ? '#fff' : 'transparent',
              color: sendAs === 'agent' ? '#26241F' : '#8A8578',
              boxShadow: sendAs === 'agent' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <Headset size={13} /> Agent
          </button>
        </div>
      </div>

      {/* Reply box */}
      <div className="px-5 pb-4 pt-2 flex items-center gap-2 shrink-0">
        <input value={reply} onChange={(e) => setReply(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder={sendAs === 'customer' ? 'Type what the customer would say… (e.g. "hi")' : 'Type a reply…'}
          className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
        <button onClick={() => send()} disabled={sending || (sendAs === 'customer' && selecting)}
          className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
          <Send size={15} /> {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {err && <p className="text-xs text-red-500 px-5 pb-2">{err}</p>}
    </div>
  );
}
