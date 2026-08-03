'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// This route moved. The sidebar's "Templates" entry now points straight at
// /app/campaigns/templates (see components/Sidebar.jsx), but this redirect
// stays in place for anyone with the old URL bookmarked or linked.
export default function TemplatesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/app/campaigns/templates');
  }, [router]);

  return (
    <div className="p-6 flex items-center gap-2 text-sm text-slate-400 py-20 justify-center">
      <Loader2 size={16} className="animate-spin" /> Redirecting to Templates…
    </div>
  );
}
