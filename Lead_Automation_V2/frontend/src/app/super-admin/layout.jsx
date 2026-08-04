'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, ScrollText, LogOut, ShieldAlert, Receipt, BarChart3 } from 'lucide-react';
import { getSuperAdminToken, superAdminLogout } from '@/lib/superAdminAuth';

const NAV = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/super-admin' },
  { label: 'Companies', icon: Building2, href: '/super-admin/companies' },
  { label: 'Billing', icon: Receipt, href: '/super-admin/billing' },
  { label: 'Analytics', icon: BarChart3, href: '/super-admin/analytics' },
  { label: 'Audit Log', icon: ScrollText, href: '/super-admin/audit-logs' },
];

// Separate shell from src/app/app/layout.jsx (tenant app) — different
// nav, different guard (super-admin token, not the tenant one), and
// deliberately no Sidebar/Topbar reuse since those assume a tenant
// profile (org name, agent role) that doesn't exist here.
export default function SuperAdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (pathname === '/super-admin/login') {
      setReady(true);
      return;
    }
    if (!getSuperAdminToken()) {
      router.replace('/super-admin/login');
      return;
    }
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  if (pathname === '/super-admin/login') return children;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-60 shrink-0 border-r bg-slate-950 text-slate-300 flex flex-col">
        <div className="flex items-center gap-2 px-4 py-4 text-white">
          <ShieldAlert className="size-5" />
          <span className="font-semibold">Super Admin</span>
        </div>
        <nav className="flex-1 px-2 space-y-1">
          {NAV.map(({ label, icon: Icon, href }) => {
            const active = pathname === href || (href !== '/super-admin' && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${
                  active ? 'bg-slate-800 text-white' : 'hover:bg-slate-900'
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <button
          onClick={superAdminLogout}
          className="flex items-center gap-2 px-4 py-3 text-sm text-slate-400 hover:text-white border-t border-slate-800"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </aside>
      <main className="flex-1 min-w-0 p-6">{children}</main>
    </div>
  );
}
