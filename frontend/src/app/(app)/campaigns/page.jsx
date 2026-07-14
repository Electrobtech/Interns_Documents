'use client';
import CrudPage from '@/components/CrudPage';
import { campaigns } from '@/lib/resources';

export default function CampaignsPage() {
  return <CrudPage {...campaigns} />;
}
