'use client';
import { Settings } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import { users, teams } from '@/lib/resources';

export default function SettingsPage() {
  return (
    <Tabs title="Settings & Team" icon={Settings} tabs={[
      { label: 'Team Members', render: () => <CrudPage {...users} header={false} /> },
      { label: 'Teams', render: () => <CrudPage {...teams} header={false} /> },
    ]} />
  );
}
