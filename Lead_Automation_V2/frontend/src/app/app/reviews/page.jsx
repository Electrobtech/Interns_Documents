'use client';
import { Suspense } from 'react';
import { Star, MessageSquareReply } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import GoogleReviewsPanel from '@/components/googleReviews/GoogleReviewsPanel';
import { reviews, social } from '@/lib/resources';

/* ─── page ──────────────────────────── */
export default function ReviewsPage() {
  return (
    <Tabs title="Reviews & Social" icon={Star} tabs={[
      {
        label: 'Google Reviews',
        icon: Star,
        render: () => (
          <Suspense fallback={<p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}>
            <GoogleReviewsPanel />
          </Suspense>
        ),
      },
      { label: 'Reviews',         render: () => <CrudPage {...reviews} header={false} /> },
      { label: 'Social Comments', icon: MessageSquareReply, render: () => <CrudPage {...social} header={false} /> },
    ]} />
  );
}