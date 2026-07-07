'use client';
import { Search, Bell, HelpCircle, LogOut } from 'lucide-react';
import { logout } from '@/lib/auth';

export default function Topbar({ profile }) {
  const name = profile?.name || 'Arjun Kumar';
  const role = profile?.role || 'Admin';
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-bold text-brand-dark tracking-tight">LEAD AUTOMATION</h1>
        <p className="text-[11px] text-slate-400 -mt-0.5">Unified Customer Engagement & Revenue Platform</p>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2 w-72">
          <Search size={15} className="text-slate-400" />
          <input className="bg-transparent text-sm outline-none w-full" placeholder="Search (Leads, Contacts, Conversations...)" />
        </div>
        <Bell size={18} className="text-slate-500" />
        <HelpCircle size={18} className="text-slate-500" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand text-white grid place-items-center text-xs font-bold">{initials}</div>
          <div className="text-xs leading-tight">
            <div className="font-medium">{name}</div>
            <div className="text-slate-400 capitalize">{role}</div>
          </div>
        </div>
        <button
          onClick={logout}
          title="Log out"
          className="text-slate-400 hover:text-slate-700 ml-1"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
