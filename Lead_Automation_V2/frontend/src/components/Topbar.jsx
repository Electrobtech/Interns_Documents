'use client';
import { Search, HelpCircle, LogOut } from 'lucide-react';
import { logout } from '@/lib/auth';
import NotificationBell from './NotificationBell';

export default function Topbar({ profile }) {
  const name = profile?.name || 'Arjun Kumar';
  const role = profile?.role || 'Admin';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Search leads the bar — the page itself carries its own title, so a
          duplicated app name here was just taking up room. */}
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 w-full max-w-md
                      transition-all duration-150 focus-within:border-violet-300 focus-within:bg-white focus-within:ring focus-within:ring-violet-100">
        <Search size={15} className="text-slate-400 shrink-0" />
        <input
          className="bg-transparent text-sm outline-none w-full placeholder:text-slate-400"
          placeholder="Search leads, contacts, conversations…"
        />
        <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shrink-0">
          ⌘K
        </kbd>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-4">
        <NotificationBell />
        <button title="Help" className="p-2 rounded-lg text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition-colors">
          <HelpCircle size={18} />
        </button>

        <div className="hidden sm:block w-px h-6 bg-slate-200" />

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-rose-600 text-white grid place-items-center text-xs font-bold shadow-sm shadow-violet-500/20">
            {initials}
          </div>
          <div className="hidden sm:block text-xs leading-tight">
            <div className="font-semibold text-slate-800">{name}</div>
            <div className="text-slate-400 capitalize">{role}</div>
          </div>
        </div>

        <button
          onClick={logout}
          title="Log out"
          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
