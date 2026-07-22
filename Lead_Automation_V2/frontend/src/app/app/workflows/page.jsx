'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkflowsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/app/ai-agents'); }, [router]);
  return null;
}
