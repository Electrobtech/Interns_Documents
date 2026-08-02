'use client';

// Small deterministic palette so the same contact always gets the same
// avatar color across renders/sessions (hash of the name -> palette index),
// matching QuickReply's varied-but-consistent avatar colors.
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-emerald-100 text-emerald-600',
  'bg-violet-100 text-violet-600',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-600',
  'bg-cyan-100 text-cyan-600',
  'bg-indigo-100 text-indigo-600',
  'bg-fuchsia-100 text-fuchsia-600',
];

function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name) {
  return name.trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

// "03:06 pm" for anything sent today, "29/06/26" otherwise — mirrors the
// QuickReply chat list's timestamp formatting.
function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase();
  }
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

export default function ChatListItem({ conversation, active, onClick }) {
  const name = conversation.contact_name || conversation.contact_phone || 'Unknown';
  const preview = conversation.last_message_preview || 'No messages yet';
  const isUnassigned = !conversation.assigned_to;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
        active ? 'bg-brand-light/70' : 'hover:bg-[#f8fafc]'}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 shrink-0 rounded-full grid place-items-center text-xs font-semibold ${avatarColor(name)}`}>
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold text-slate-800 truncate">{name}</span>
            <span className="text-[11px] text-slate-400 shrink-0">{formatTimestamp(conversation.last_message_at)}</span>
          </div>
          <p className="text-xs text-slate-500 truncate mt-0.5">{preview}</p>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isUnassigned ? 'bg-emerald-500' : 'bg-sky-500'}`} />
              <span className="truncate">
                {isUnassigned ? 'Unassigned' : (conversation.assigned_to_name ? `Assigned · ${conversation.assigned_to_name}` : 'Assigned')}
              </span>
            </span>
            {conversation.lead_stage && (
              <span className="text-[11px] font-medium text-emerald-600 shrink-0 capitalize">Lead</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
