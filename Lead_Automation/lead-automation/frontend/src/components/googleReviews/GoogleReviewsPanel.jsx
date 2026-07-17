'use client';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useGoogleReviews } from '@/hooks/useGoogleReviews';
import { ToastStack, useToast } from '@/components/Toast';
import ConnectionPanel from './ConnectionPanel';
import StatsPanel from './StatsPanel';
import ReviewsList from './ReviewsList';

export default function GoogleReviewsPanel() {
  const g = useGoogleReviews();
  const { toasts, toast, dismiss } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handledRedirect = useRef(false);

  const [filters, setFilters] = useState({ locationId: '', rating: '', replied: '', search: '', sort: 'newest', page: 1, limit: 10 });

  // Handle the ?google=connected / ?google_error=... redirect from
  // /google/callback exactly once, then strip it from the URL.
  useEffect(() => {
    if (handledRedirect.current) return;
    const connected = searchParams.get('google');
    const err = searchParams.get('google_error');
    if (connected === 'connected') {
      handledRedirect.current = true;
      toast.success('Google Business Profile connected successfully.');
      g.loadStatus();
      router.replace(pathname);
    } else if (err) {
      handledRedirect.current = true;
      toast.error(`Google connection failed: ${err}`);
      router.replace(pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    if (g.status?.connected) {
      g.loadAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.status?.connected]);

  useEffect(() => {
    if (g.status?.selectedLocationId) {
      setFilters((f) => ({ ...f, locationId: g.status.selectedLocationId }));
      g.loadStats(g.status.selectedLocationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.status?.selectedLocationId]);

  useEffect(() => {
    if (g.status?.connected) g.loadReviews(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g.status?.connected, filters]);

  const handleSync = async (locationId) => {
    toast.info('Sync started…');
    const summary = await g.sync(locationId);
    if (summary) {
      toast.success(`Sync completed — ${summary.inserted} new, ${summary.updated} updated.`);
      g.loadStats(filters.locationId);
      g.loadReviews(filters);
    } else if (g.error) {
      toast.error(g.error);
    }
  };

  const handleReply = async (reviewId, comment) => {
    try {
      await g.reply(reviewId, comment);
      toast.success('Reply posted.');
      g.loadStats(filters.locationId);
      g.loadReviews(filters);
    } catch {
      toast.error(g.error || 'Failed to post reply.');
    }
  };

  const handleDeleteReply = async (reviewId) => {
    try {
      await g.deleteReply(reviewId);
      toast.success('Reply removed.');
      g.loadStats(filters.locationId);
      g.loadReviews(filters);
    } catch {
      toast.error(g.error || 'Failed to delete reply.');
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Disconnect Google Business Profile? Synced reviews will be kept, but replying and syncing will stop until you reconnect.')) return;
    await g.disconnect();
    toast.info('Google Business Profile disconnected.');
  };

  return (
    <div className="space-y-4">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <ConnectionPanel
        status={g.status}
        statusLoading={g.statusLoading}
        accounts={g.accounts}
        locations={g.locations}
        busy={g.busy}
        onConnect={g.connect}
        onDisconnect={handleDisconnect}
        onLoadAccounts={g.loadAccounts}
        onLoadLocations={g.loadLocations}
        onSelectLocation={(id) => g.selectLocation(id)}
        onSync={() => handleSync(filters.locationId)}
      />

      {g.status?.connected && g.status?.selectedLocationId && (
        <>
          <StatsPanel stats={g.stats} />
          <ReviewsList
            reviews={g.reviews}
            loading={g.reviewsLoading}
            filters={filters}
            onFilterChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onReply={handleReply}
            onDeleteReply={handleDeleteReply}
            busy={g.busy}
          />
        </>
      )}

      {g.status?.connected && !g.status?.selectedLocationId && !g.statusLoading && (
        <div className="text-center py-10 text-sm text-slate-400 border border-dashed border-slate-200 rounded-xl">
          Select a business location above to see reviews and statistics.
        </div>
      )}
    </div>
  );
}
