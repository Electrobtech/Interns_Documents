'use client';
import { Users } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import { contacts, leads } from '@/lib/resources';

export default function ContactsPage() {
  return (
    <Tabs title="Contacts & Leads" icon={Users} tabs={[
      { label: 'Contacts', render: () => <CrudPage {...contacts} header={false} /> },
      { label: 'Leads', render: () => <CrudPage {...leads} header={false} /> },
    ]} />
  );
}
