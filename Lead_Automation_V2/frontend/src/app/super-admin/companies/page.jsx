'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { useCompanies, useUpdateCompanyStatus } from '@/lib/queries/superAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const STATUS_BADGE = {
  active: 'bg-emerald-50 text-emerald-700',
  suspended: 'bg-red-50 text-red-700',
  pending: 'bg-amber-50 text-amber-700',
};

// CompanyManagement — paginated, filterable tenant table (section A).
// Status toggle calls PATCH /super-admin/companies/:id/status directly
// from the row; anything deeper (plan changes, wallet, agents) lives in
// the detail view at /super-admin/companies/[id].
export default function CompanyManagementPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, error } = useCompanies({ search, status, page, pageSize: 20 });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Companies</h1>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
          <input
            className="w-full rounded-md border pl-8 pr-3 py-2 text-sm"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="rounded-md border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="pending">Pending</option>
        </select>
      </div>

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
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Industry</th>
                  <th className="py-2 pr-4">Plan</th>
                  <th className="py-2 pr-4">Registered</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4" />
                </tr>
              </thead>
              <tbody>
                {data.rows.map((c) => (
                  <CompanyRow key={c.id} company={c} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {data.page} · {data.total} companies</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page * data.pageSize >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CompanyRow({ company }) {
  const updateStatus = useUpdateCompanyStatus(company.id);
  const nextAction = company.status === 'suspended' ? 'active' : 'suspended';

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">
        <Link href={`/super-admin/companies/${company.id}`} className="font-medium hover:underline">
          {company.name}
        </Link>
      </td>
      <td className="py-2 pr-4 text-slate-500">{company.company_email}</td>
      <td className="py-2 pr-4">{company.industry || '—'}</td>
      <td className="py-2 pr-4">{company.subscription_plan || '—'}</td>
      <td className="py-2 pr-4">{new Date(company.created_at).toLocaleDateString()}</td>
      <td className="py-2 pr-4">
        <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_BADGE[company.status] || 'bg-slate-100'}`}>
          {company.status}
        </span>
      </td>
      <td className="py-2 pr-4">
        <Button
          variant="outline"
          size="sm"
          disabled={updateStatus.isPending}
          onClick={() => updateStatus.mutate(nextAction)}
        >
          {nextAction === 'suspended' ? 'Suspend' : 'Reactivate'}
        </Button>
      </td>
    </tr>
  );
}
