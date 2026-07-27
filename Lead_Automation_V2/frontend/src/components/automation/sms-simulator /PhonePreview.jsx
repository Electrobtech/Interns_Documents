'use client';
import { ChevronLeft, User, Plus, ArrowUp } from 'lucide-react';

/**
 * Left column — a realistic phone-frame preview of the simulated SMS thread.
 * Purely presentational: renders whatever `message`/`recipientPhone` the
 * parent (SmsAutomationSimulator) currently holds in state. The footer input
 * is disabled by design — this is a preview surface, not a real composer.
 */
export default function PhonePreview({ recipientPhone, message, timestampLabel }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className="relative w-[280px] rounded-[2.5rem] border-[10px] border-slate-900 bg-slate-900 shadow-xl overflow-hidden"
        style={{ aspectRatio: '280 / 570' }}
      >
        <div className="absolute inset-0 rounded-[1.75rem] bg-white flex flex-col overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-4 pt-2 pb-1 text-[11px] font-semibold text-slate-900 shrink-0">
            <span>9:41</span>
            <div className="flex items-center gap-1">
              <Bars />
              <Wifi />
              <Battery />
            </div>
          </div>

          {/* Header */}
          <div className="flex flex-col items-center px-3 pb-2 border-b border-slate-100 shrink-0">
            <div className="w-full flex items-center gap-1">
              <ChevronLeft size={20} className="text-blue-500" />
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center -mt-1">
              <User size={18} className="text-slate-400" />
            </div>
            <div className="text-[13px] font-medium text-slate-800 mt-0.5">
              {recipientPhone || '+91 90000 00000'}
            </div>
          </div>

          {/* Chat body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 bg-white">
            <div className="text-center text-[10px] text-slate-400 mb-2">
              {timestampLabel || 'Today, 10:30 AM'}
            </div>
            {message ? (
              <div className="max-w-[85%] bg-slate-100 rounded-2xl rounded-tl-sm px-3 py-2 text-[12.5px] leading-snug text-slate-800 whitespace-pre-wrap">
                {message}
              </div>
            ) : (
              <div className="text-center text-[11px] text-slate-300 mt-10">
                Run a simulation to preview the message here
              </div>
            )}
          </div>

          {/* Footer (disabled/simulated composer) */}
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 shrink-0">
            <Plus size={18} className="text-slate-300" />
            <div className="flex-1 h-8 rounded-full bg-slate-100 flex items-center px-3 text-[11px] text-slate-400">
              Text Message
            </div>
            <div className="w-7 h-7 rounded-full bg-emerald-400/60 flex items-center justify-center">
              <ArrowUp size={14} className="text-white" />
            </div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 text-center mt-4 max-w-[240px] leading-snug">
        This is a preview of how the SMS will appear on the recipient&apos;s device.
      </p>
    </div>
  );
}

function Bars() {
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none">
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={i * 4} y={9 - i * 2.3} width="2.5" height={2 + i * 2.3} rx="0.5" fill="currentColor" />
      ))}
    </svg>
  );
}
function Wifi() {
  return (
    <svg width="14" height="11" viewBox="0 0 14 11" fill="none">
      <path d="M7 9.5a1 1 0 100-2 1 1 0 000 2zM3.5 5.8a5 5 0 017 0M1 3.2a9 9 0 0112 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function Battery() {
  return (
    <svg width="22" height="11" viewBox="0 0 22 11" fill="none">
      <rect x="0.5" y="0.5" width="18" height="10" rx="2.5" stroke="currentColor" strokeWidth="1" />
      <rect x="2" y="2" width="15" height="7" rx="1.2" fill="currentColor" />
      <rect x="19.5" y="3.5" width="1.5" height="4" rx="0.5" fill="currentColor" />
    </svg>
  );
}
