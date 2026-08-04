'use client';
import { CalendarClock, AlertTriangle, Sun, CalendarDays, List } from 'lucide-react';
import Tabs from '@/components/Tabs';
import FollowUpsTable from '@/components/followups/FollowUpsTable';
import { AddFollowUpButton } from '@/components/followups/AddFollowUpButton';
import { useFollowUpCounts } from '@/lib/queries/followUps';

// Tabs.jsx keys each tab button off `label` directly (`key={t.label}`), so
// labels here stay plain strings — a count suffix rather than a JSX badge —
// to keep that key stable and unique across renders.
function withCount(label, count) {
  return count ? `${label} (${count})` : label;
}

/**
 * Follow-ups management view — the PLATFORM sidebar's "Follow-ups" entry
 * (components/Sidebar.jsx). Shows overdue / today / upcoming / all buckets
 * (contact-service's GET /follow-ups?bucket=…) and lets a user manually log
 * a new follow-up for any lead/contact. Rows can also arrive here
 * automatically from the Automation Builder's Handoff node — see
 * services/automation-service/src/repositories/followUpRepository.js.
 */
export default function FollowUpsPage() {
  const { data: counts } = useFollowUpCounts();

  return (
    <div>
      <div className="flex items-center justify-end px-6 pt-6">
        <AddFollowUpButton variant="full" />
      </div>
      <Tabs
        title="Follow-ups"
        icon={CalendarClock}
        tabs={[
          { label: withCount('Overdue', counts?.overdue), icon: AlertTriangle, render: () => <FollowUpsTable bucket="overdue" /> },
          { label: withCount('Today', counts?.today), icon: Sun, render: () => <FollowUpsTable bucket="today" /> },
          { label: withCount('Upcoming', counts?.upcoming), icon: CalendarDays, render: () => <FollowUpsTable bucket="upcoming" /> },
          { label: withCount('All', counts?.all), icon: List, render: () => <FollowUpsTable bucket="all" /> },
        ]}
      />
    </div>
  );
}
