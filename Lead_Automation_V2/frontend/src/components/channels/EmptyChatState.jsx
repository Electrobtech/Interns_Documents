'use client';
import { useState } from 'react';
import { MessageSquarePlus, X } from 'lucide-react';

// Same empty state as the WhatsApp view (components/whatsapp/EmptyChatState.jsx)
// but with the channel name/label parameterized instead of hardcoded, so it
// reads correctly for Instagram, Messenger, Web Chat, Voice Call, etc.
export default function EmptyChatState({ channelLabel = 'this channel' }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex-1 grid place-items-center px-6">
      <div className="text-center max-w-sm">
        <svg viewBox="0 0 200 160" className="w-48 h-40 mx-auto mb-2" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="100" cy="145" rx="70" ry="8" fill="#F1F5F9" />
          <rect x="40" y="30" width="120" height="85" rx="10" fill="#F8FAFC" stroke="#E2E8F0" strokeWidth="2" />
          <rect x="55" y="48" width="60" height="8" rx="4" fill="#E2E8F0" />
          <rect x="55" y="64" width="90" height="8" rx="4" fill="#E2E8F0" />
          <rect x="55" y="80" width="45" height="8" rx="4" fill="#E2E8F0" />
          <circle cx="145" cy="100" r="28" fill="#ECFDF5" stroke="#A7F3D0" strokeWidth="2" />
          <path d="M136 100l6 6 12-13" stroke="#10B981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="42" cy="26" r="6" fill="#FEE2E2" />
          <circle cx="158" cy="24" r="4" fill="#DBEAFE" />
        </svg>
        <p className="text-base font-semibold text-slate-700">Please Select a Chat</p>
        <p className="text-xs text-slate-400 mt-1">or</p>
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand border border-brand/40 rounded-lg px-4 py-2 hover:bg-brand-light transition-colors"
        >
          <MessageSquarePlus size={15} /> Compose New Chat
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/30 z-50 grid place-items-center px-4" onClick={() => setShowModal(false)}>
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-card-lg max-w-sm w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-800">Compose New Chat</p>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              New {channelLabel} conversations are created automatically the moment a contact reaches out on
              your connected {channelLabel} — there isn&apos;t a way to start one from here yet. Once they write in,
              it&apos;ll show up in this list.
            </p>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-4 w-full text-sm font-medium bg-brand text-white rounded-lg px-4 py-2 hover:bg-brand-dark transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
