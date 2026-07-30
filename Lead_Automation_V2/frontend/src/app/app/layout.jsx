'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import { getToken } from '@/lib/auth';
import { useApi } from '@/lib/useApi';

// Authenticated shell shared by every page in the (app) group: sidebar + topbar +
// a guard that bounces unauthenticated visitors to /login.
export default function AppLayout({ children }) {
  const router = useRouter();
  const { call } = useApi();
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
      return;
    }
    setReady(true);
    call('/auth/profile').then(setProfile).catch(() => {});
  }, [router, call]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    // Soft violet-tinted canvas so white cards lift off the page instead of
    // blending into a flat white background — matches the landing page's palette.
    <div className="flex min-h-screen bg-[#FAFAFC]">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Topbar profile={profile} />
        {children}
      </main>
    </div>
  );
}
