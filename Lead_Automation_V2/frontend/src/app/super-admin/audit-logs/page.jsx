'use client';
import { useState } from 'react';
import { useAuditLogs } from '@/lib/queries/superAdmin';
import { Card, CardContent } from '@/components/ui/card';

// Platform-wide Audit Log (section D) — every Super Admin action
// (top-ups, suspensions, plan/flag changes) via GET /super-admin/audit-logs,
// which is the cross-tenant equivalent of team-service's tenant-scoped
// GET /audit-logs.
export default function AuditLogsPage() {
  const [action, setAction] = useState('');
  const { data, isLoading, error } = useAuditLogs({ action });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Audit Log</h1>

      <input
        className="rounded-md border px-3 py-2 text-sm max-w-sm"
        placeholder="Filter by action (e.g. wallet.recharge)…"
        value={action}
        onChange={(e) => setAction(e.target.value)}
      />

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {isLoading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : error ? (
            <p className="text-sm text-red-600">{error.message}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Company</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{log.organization_name || '—'}</td>
                    <td className="py-2 pr-4 font-medium">{log.action}</td>
                    <td className="py-2 pr-4 text-slate-500">
                      {log.meta?.description ? (
                        log.meta.description
                      ) : (
                        <code className="text-xs">{JSON.stringify(log.meta)}</code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}