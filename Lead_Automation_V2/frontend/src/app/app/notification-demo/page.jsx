'use client';
import { Bell } from 'lucide-react';
import NotificationClickDemo from '@/components/NotificationClickDemo';

export default function NotificationDemoPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bell size={18} className="text-brand" />
        <h2 className="text-lg font-bold">Click Notification Demo</h2>
      </div>
      <NotificationClickDemo />
    </div>
  );
}
