'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Search, Plus, ChevronDown, Check, Loader2, Pencil, Download } from 'lucide-react';
import { useCompanies, useUpdateCompanyStatus, useCreateCompany, useUpdateCompany } from '@/lib/queries/superAdmin';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import CompanyForm, { EMPTY_COMPANY_FORM, validateCompanyForm } from '@/components/registration/CompanyForm';
import { exportCompanyCsv } from '@/lib/exportCompanyCsv';

// Single source of truth for status styling — the row badge/dropdown and
// the quick-action button both read from this so they can never drift
// out of sync with each other.
const STATUS_META = {
  active: { label: 'Active', badge: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100', dot: 'bg-emerald-500' },
  pending: { label: 'Pending', badge: 'bg-amber-50 text-amber-700 hover:bg-amber-100', dot: 'bg-amber-500' },
  suspended: { label: 'Suspended', badge: 'bg-red-50 text-red-700 hover:bg-red-100', dot: 'bg-red-500' },
};
const STATUS_ORDER = ['active', 'pending', 'suspended'];

const STATUS_TOGGLE_ACTIVE = {
  active: 'bg-emerald-600 text-white',
  suspended: 'bg-red-600 text-white',
  pending: 'bg-amber-500 text-white',
  '': 'bg-slate-800 text-white',
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
];

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
        <AddCompanyDialog />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
          <input
            className="w-full rounded-md border border-slate-300 bg-white pl-8 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>

        <div className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-1 gap-1">
          {STATUS_TABS.map((tab) => {
            const isActive = status === tab.value;
            return (
              <button
                key={tab.value || 'all'}
                type="button"
                onClick={() => { setStatus(tab.value); setPage(1); }}
                className={`rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? STATUS_TOGGLE_ACTIVE[tab.value]
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
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

function AddCompanyDialog() {
  const [open, setOpen] = useState(false);
  const createCompany = useCreateCompany();
  const [form, setForm] = useState(EMPTY_COMPANY_FORM);
  const [errors, setErrors] = useState({});

  function submit(e) {
    e.preventDefault();
    const validationErrors = validateCompanyForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    createCompany.mutate(form, {
      onSuccess: () => {
        setOpen(false);
        setForm(EMPTY_COMPANY_FORM);
        setErrors({});
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="bg-blue-600 text-white hover:bg-blue-700 gap-1.5">
        <Plus className="size-4" />
        Add Company
      </Button>
      <DialogContent className="bg-white text-slate-900 border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Register a company</DialogTitle>
          <DialogDescription className="text-slate-500">
            Add a new tenant record to the Companies list. New status defaults to Pending.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <CompanyForm value={form} onChange={setForm} errors={errors} idPrefix="add-company" />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="border-slate-300 text-slate-700">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={createCompany.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
              {createCompany.isPending ? 'Adding…' : 'Add company'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Edit modal (section 3.B) — pre-filled with the row's current values,
// reuses the exact same CompanyForm as Add, plus the Status field (Add
// leaves status at its Pending default; Edit lets an admin change it
// directly too, in addition to the row's own status dropdown).
function EditCompanyDialog({ company, open, onOpenChange }) {
  const updateCompany = useUpdateCompany(company.id);
  const [form, setForm] = useState(() => ({ ...EMPTY_COMPANY_FORM, ...company }));
  const [errors, setErrors] = useState({});

  // Re-sync the form whenever the dialog is (re)opened for this row, so
  // stale edits from a previous open don't linger.
  function handleOpenChange(next) {
    if (next) {
      setForm({ ...EMPTY_COMPANY_FORM, ...company });
      setErrors({});
    }
    onOpenChange(next);
  }

  function submit(e) {
    e.preventDefault();
    const validationErrors = validateCompanyForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    updateCompany.mutate(form, {
      onSuccess: () => onOpenChange(false),
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-white text-slate-900 border border-slate-200">
        <DialogHeader>
          <DialogTitle className="text-slate-900">Edit {company.name || 'company'}</DialogTitle>
          <DialogDescription className="text-slate-500">
            Update this tenant's details. Changes are logged to the audit trail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <CompanyForm value={form} onChange={setForm} errors={errors} showStatus idPrefix={`edit-${company.id}`} />

          <DialogFooter className="justify-between sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 border-slate-300 text-slate-700"
              onClick={() => exportCompanyCsv(company)}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button type="button" variant="outline" className="border-slate-300 text-slate-700">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={updateCompany.isPending} className="bg-blue-600 text-white hover:bg-blue-700">
                {updateCompany.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CompanyRow({ company }) {
  // Single mutation instance shared by the status dropdown AND the quick
  // action button below — both call the same updateStatus.mutate(), so
  // the moment one succeeds, the query invalidation re-renders both from
  // the same fresh `company.status`. There's no separate local state to
  // fall out of sync.
  const updateStatus = useUpdateCompanyStatus(company.id);
  const quickAction = company.status === 'suspended' ? 'active' : 'suspended';
  const [editOpen, setEditOpen] = useState(false);

  function changeStatus(nextStatus) {
    if (nextStatus === company.status || updateStatus.isPending) return;
    updateStatus.mutate(nextStatus);
  }

  return (
    <tr className="border-b last:border-0">
      <td className="py-2 pr-4">
        <Link href={`/super-admin/companies/${company.id}`} className="font-medium hover:underline">
          {company.name || 'Untitled Company'}
        </Link>
      </td>
      <td className="py-2 pr-4 text-slate-500">{company.email || 'N/A'}</td>
      <td className="py-2 pr-4">{company.industry || 'N/A'}</td>
      <td className="py-2 pr-4 capitalize">{company.plan || 'N/A'}</td>
      <td className="py-2 pr-4">
        {company.registeredAt ? new Date(company.registeredAt).toLocaleDateString() : 'N/A'}
      </td>
      <td className="py-2 pr-4">
        <StatusDropdown status={company.status} isPending={updateStatus.isPending} onChange={changeStatus} />
      </td>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            disabled={updateStatus.isPending}
            onClick={() => changeStatus(quickAction)}
          >
            {updateStatus.isPending
              ? 'Updating…'
              : quickAction === 'suspended'
              ? 'Suspend'
              : 'Activate'}
          </Button>
          <Button variant="outline" size="icon-sm" title="Edit company" onClick={() => setEditOpen(true)}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" title="Download details (CSV)" onClick={() => exportCompanyCsv(company)}>
            <Download className="size-3.5" />
          </Button>
        </div>
      </td>
      <EditCompanyDialog company={company} open={editOpen} onOpenChange={setEditOpen} />
    </tr>
  );
}

// Interactive status control for the table row: a colored badge that
// opens a dropdown of the three supported statuses. Selecting one calls
// back into the shared mutation handler in CompanyRow.
function StatusDropdown({ status, isPending, onChange }) {
  const meta = STATUS_META[status] || { label: status, badge: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isPending}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${meta.badge}`}
        >
          {isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <span className={`size-1.5 rounded-full ${meta.dot}`} />
          )}
          {meta.label}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-36 bg-white text-slate-900">
        {STATUS_ORDER.map((value) => {
          const optionMeta = STATUS_META[value];
          const isCurrent = value === status;
          return (
            <DropdownMenuItem
              key={value}
              onSelect={() => onChange(value)}
              className="flex items-center gap-2 text-sm"
            >
              <span className={`size-1.5 rounded-full ${optionMeta.dot}`} />
              <span className="flex-1">{optionMeta.label}</span>
              {isCurrent && <Check className="size-3.5 text-slate-500" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}