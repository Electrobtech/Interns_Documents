'use client';
import { Plug } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import ConnectionsPanel from '@/components/ConnectionsPanel';
import { integrations, apiKeys, webhooks, channels } from '@/lib/resources';

export default function IntegrationsPage() {
  return (
    <Tabs title="Integrations & APIs" icon={Plug} tabs={[
      { label: 'Connections', render: () => <ConnectionsPanel /> },
      { label: 'Integrations', render: () => <CrudPage {...integrations} header={false} /> },
      { label: 'API Keys', render: () => <CrudPage {...apiKeys} header={false} /> },
      { label: 'Webhooks', render: () => <CrudPage {...webhooks} header={false} /> },
      { label: 'Channels', render: () => <CrudPage {...channels} header={false} /> },
    ]} />
  );
}
