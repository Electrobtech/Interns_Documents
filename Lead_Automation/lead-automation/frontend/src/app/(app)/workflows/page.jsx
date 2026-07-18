'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WorkflowsRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/ai-agents'); }, [router]);
  return null;
}
