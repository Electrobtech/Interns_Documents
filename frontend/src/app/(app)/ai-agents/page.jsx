'use client';
import CrudPage from '@/components/CrudPage';
import { aiAgents } from '@/lib/resources';

export default function AiAgentsPage() {
  return <CrudPage {...aiAgents} />;
}
