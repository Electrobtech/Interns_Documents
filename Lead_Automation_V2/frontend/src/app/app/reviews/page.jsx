'use client';
import { Suspense, useState } from 'react';
import { Star, Megaphone, Sparkles, AlertTriangle, Smile, MessageSquareReply, TrendingUp, Send } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import GoogleReviewsPanel from '@/components/googleReviews/GoogleReviewsPanel';
import { InstagramComposer, FacebookComposer, WhatsAppSendTest } from '@/components/ConnectionsPanel';
import { reviews, social } from '@/lib/resources';

/* ─── Publish & WhatsApp panel ─── */
// Moved here from Integrations & APIs, which is now credentials-only.
// Facebook, Instagram and WhatsApp each get their own dedicated block —
// same pattern as the Google Reviews tab — instead of one shared composer
// behind a Platform dropdown.
function PublishPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
      <FacebookComposer />
      <InstagramComposer />
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <h3 className="font-semibold text-sm mb-1">WhatsApp test message</h3>
        <p className="text-[11px] text-slate-400 mb-3">
          Requires a connected WhatsApp number — set that up under Integrations &amp; APIs first.
        </p>
        <WhatsAppSendTest />
      </div>
    </div>
  );
}

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