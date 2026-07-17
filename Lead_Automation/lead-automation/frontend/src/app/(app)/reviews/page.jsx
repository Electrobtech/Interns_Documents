'use client';
import { Star } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import { reviews, social } from '@/lib/resources';

export default function ReviewsPage() {
  return (
    <Tabs title="Reviews & Social" icon={Star} tabs={[
      { label: 'Reviews', render: () => <CrudPage {...reviews} header={false} /> },
      { label: 'Social Comments', render: () => <CrudPage {...social} header={false} /> },
    ]} />
  );
}
