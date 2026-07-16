'use client';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Bot, Headset, RotateCcw, FileText } from 'lucide-react';
import { useApi } from '@/lib/useApi';

// Bot messages carry their raw send-template in `metadata` — see
// buildSendTemplate() in automation-service's webhookController.js — which
// differs by channel (WhatsApp's native interactive-button/list shapes vs.
// the generic Instagram/Messenger fallback shape). This normalizes any of
// them into a flat { id, label } option list, plus the `interaction.type`
// the engine actually branches on for that kind of message (workflowEngine
// only matches 'button_click' against a 'buttons' node and 'list_select'
// against a 'list' node — see evaluateWorkflowStep) — so clicking an option
// reaches the exact same branch a real customer tapping it would.
// Returns null if this message has no clickable options.
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

export default function ConversationView() {
  const { id } = useParams();
  const { call } = useApi();
  const [conv, setConv] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [err, setErr] = useState('');
  // Two very different things can happen when you hit "Send" here:
  //  - 'agent'    -> POST /conversations/:id/reply, a plain outbound message
  //                  logged as written by the logged-in CRM user. Never
  //                  touches the automation engine.
  //  - 'customer' -> POST /automation/internal/inbox-reply with a free-text
  //                  interaction, running the EXACT SAME engine turn a real
  //                  inbound WhatsApp/Instagram message would (resolves a
  //                  playbook by trigger keyword, walks the flow, sends +
  //                  logs the bot's reply). This is what lets someone type
  //                  "hi" in the inbox and see the automation fire, for demos.
  const [sendAs, setSendAs] = useState('customer');

  const load = useCallback(() => {
    call(`/conversations/${id}`).then(setConv).catch((e) => setErr(e.message));
  }, [call, id]);

  useEffect(() => { load(); }, [load]);

  // Clears the transcript, reopens the conversation, hands it back to the
  // bot, and drops any in-progress automation flow state for this contact
  // — so the next inbound message replays the playbook from the start.
  // Meant for resetting a test/demo conversation between runs.
  const resetConversation = useCallback(async () => {
    if (!conv || resetting) return;
    if (!window.confirm('Reset this conversation? This clears the message history so you can run the demo again.')) return;
    setResetting(true);
    setErr('');
    try {
      await call(`/conversations/${id}/reset`, { method: 'POST' });
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setResetting(false);
    }
  }, [conv, resetting, call, id, load]);

  // Bot vs human ownership of this conversation. Flipping to 'human' takes
  // effect on the very next inbound webhook (automation-service checks this
  // same flag before invoking the flow engine — see webhookController), so
  // it silences the bot mid-flow, not just after it reaches a Handoff node.
  // Flipping back to 'bot' just lets the next inbound message resolve a
  // playbook normally; there's no separate "resume" step needed.
  const setHandledBy = useCallback(async (next) => {
    if (!conv || conv.handled_by === next || switching) return;
    setSwitching(true);
    setConv((c) => ({ ...c, handled_by: next })); // optimistic
    try {
      const updated = await call(`/conversations/${id}/handled-by`, { method: 'PUT', body: { handled_by: next } });
      setConv((c) => ({ ...c, ...updated }));
    } catch (e) {
      setErr(e.message);
      load(); // roll back the optimistic flip
    } finally {
      setSwitching(false);
    }
  }, [conv, switching, call, id, load]);

  async function send(text) {
    const body = (text ?? reply).trim();
    if (!body) return;
    setSending(true);
    setErr('');
    try {
      if (sendAs === 'customer') {
        // Simulate the customer texting in — same engine turn a real inbound
        // webhook triggers: logs the inbound line, resolves/continues a
        // playbook (matching "hi" etc. against triggerKeywords), and
        // delivers + logs whatever the bot replies with next.
        await call('/automation/internal/inbox-reply', {
          method: 'POST',
          body: { conversationId: id, interaction: { type: 'text', text: body } },
        });
      } else {
        // A human agent's own outbound reply — plain transcript entry, no
        // automation engine involvement.
        await call(`/conversations/${id}/reply`, { method: 'POST', body: { body } });
      }
      setReply('');
      load();
    } catch (e) { setErr(e.message); }
    finally { setSending(false); }
  }

  // Clicking a bot message's option acts as the customer, not as a human
  // agent — it does NOT go through /conversations/:id/reply (that always
  // logs an agent-authored outbound message). Instead it calls
  // automation-service directly, which runs the exact same engine turn a
  // live inbound webhook would: logs the inbound selection, advances the
  // playbook, and sends + logs whatever the bot replies with next — so the
  // transcript reloaded below reflects a full real round-trip, not a mock.
  async function selectOption(option, interactionType) {
    if (!conv || selecting) return;
    setSelecting(true);
    setErr('');
    try {
      await call('/automation/internal/inbox-reply', {
        method: 'POST',
        // `label` rides along purely for the transcript line (see
        // describeInteraction in automation-service's messageRepository.js)
        // — the engine itself only ever looks at `selectedId` to route,
        // so this can't affect which branch fires, only how the customer's
        // pick reads back in the Unified Inbox (was showing as a raw
        // "[list] b_1783594854112" id with no label before this).
        body: { conversationId: id, interaction: { type: interactionType, selectedId: option.id, label: option.label } },
      });
      load();
    } catch (e) { setErr(e.message); }
    finally { setSelecting(false); }
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
          <div className="flex-1">
            <p className="text-sm font-medium">{name}</p>
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
        <div className="p-5 space-y-3 min-h-[240px] max-h-[420px] overflow-y-auto bg-slate-50/50">
          {messages.length === 0 && <p className="text-sm text-slate-400 text-center py-8">No messages yet.</p>}
          {messages.map((m, i) => {
            // Only the most recent bot message's options are still "live" —
            // once the conversation has moved past it, older option sets are
            // no longer what the flow is currently waiting on, so they're
            // rendered as plain history instead of re-clickable buttons.
            const isLatest = i === messages.length - 1;
            const opts = isLatest && m.direction === 'outbound' ? getMessageOptions(m) : null;
            // A document's file lives in metadata.document, but the field name
            // differs by channel: buildSendTemplate()'s WhatsApp branch emits
            // the Cloud-API-native `link` (webhookController.js), while the
            // generic Instagram/Messenger fallback passes the node's original
            // `url` through as-is. The persisted metadata is that raw template
            // untouched, so read either — same as getMessageOptions() already
            // normalizes the per-channel button/list shapes above.
            const doc = m.metadata?.document;
            const docUrl = m.message_type === 'document' ? (doc?.url || doc?.link) : null;
            return (
              <div key={m.id} className={`flex flex-col ${m.direction === 'outbound' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  m.direction === 'outbound' ? 'bg-brand text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
                  {m.body}
                  {/* buildSendTemplate()'s document case stores the actual
                      file in metadata.document (see webhookController.js);
                      without this the bubble only rendered `m.body` (the
                      caption/filename text) with no indication there was a
                      real attachment behind it, let alone a way to open it. */}
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
        <div className="px-5 pt-3 flex items-center gap-2 border-t border-slate-100">
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
        <div className="px-5 pb-3 pt-2 flex items-center gap-2">
          <input value={reply} onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={sendAs === 'customer' ? 'Type what the customer would say… (e.g. "hi")' : 'Type a reply…'}
            className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none" />
          <button onClick={() => send()} disabled={sending || (sendAs === 'customer' && selecting)}
            className="bg-brand text-white rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-1.5 disabled:opacity-60">
            <Send size={15} /> {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
      {err && <p className="text-sm text-red-500 mt-2">{err}</p>}
    </div>
  );
}