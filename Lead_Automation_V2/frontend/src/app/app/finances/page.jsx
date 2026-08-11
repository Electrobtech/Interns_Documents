'use client';
import { IndianRupee } from 'lucide-react';
import Tabs from '@/components/Tabs';
import FinanceOverview from '@/components/finances/FinanceOverview';
import InvoicesRevenue from '@/components/finances/InvoicesRevenue';
import ExpensesOutgoings from '@/components/finances/ExpensesOutgoings';

// Separate from /app/billing (services/billing-service — platform/wallet
// recharges). This module is the tenant's OWN business ledger, served by
// services/finance-service (/finances/* via the gateway).
export default function FinancesPage() {
  return (
    <Tabs title="Finances & Accounting" icon={IndianRupee} tabs={[
      { label: 'Overview', render: () => <FinanceOverview /> },
      { label: 'Invoices & Revenue', render: () => <InvoicesRevenue /> },
      { label: 'Expenses & Outgoings', render: () => <ExpensesOutgoings /> },
    ]} />
  );
}
