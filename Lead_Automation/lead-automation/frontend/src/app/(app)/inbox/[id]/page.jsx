'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_INBOX_SERVICE_URL || 'http://localhost:4006';

export default function ConversationView() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch(`${API}/conversations/${id}`)
      .then((r) => r.json())
      .then(setData)
      .catch(console.error);
  }, [id]);

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/conversations/${id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: reply }),
      });
      setReply('');
      const res = await fetch(`${API}/conversations/${id}`);
      setData(await res.json());
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  }

  const conversation = data?.conversation;
  const messages = data?.messages || [];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Link href="/inbox" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 mb-4">
        <ArrowLeft size={16} /> Back to inbox
      </Link>

      {conversation && (
        <div className="bg-white rounded-xl shadow border p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">{conversation.contact_name || 'Unknown'}</h2>
              <p className="text-sm text-gray-500">{conversation.channel} · {conversation.status}</p>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p>Lead Score: {conversation.lead_score || 'N/A'}</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow border overflow-hidden">
        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
          {messages.length === 0 && <p className="text-gray-500 text-center">No messages yet.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                m.direction === 'outbound' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'
              }`}>
                <p className="text-sm">{m.content}</p>
                <p className="text-xs mt-1 opacity-70">{new Date(m.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex gap-2">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendReply()}
            placeholder="Type a reply..."
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            onClick={sendReply}
            disabled={sending}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={16} /> {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}