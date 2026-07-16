'use client';
import { Suspense } from 'react';
import { Star } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import GoogleReviewsPanel from '@/components/googleReviews/GoogleReviewsPanel';
import { reviews, social } from '@/lib/resources';

export default function ReviewsPage() {
  return (
    <Tabs title="Reviews & Social" icon={Star} tabs={[
      {
        label: 'Google Reviews',
        render: () => (
          <Suspense fallback={<p className="text-sm text-slate-400 py-8 text-center">Loading…</p>}>
            <GoogleReviewsPanel />
          </Suspense>
        ),
      },
      { label: 'Reviews', render: () => <CrudPage {...reviews} header={false} /> },
      { label: 'Social Comments', render: () => <CrudPage {...social} header={false} /> },
    ]} />
  );
}
