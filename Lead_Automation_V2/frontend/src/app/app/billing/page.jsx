'use client';
import { CreditCard } from 'lucide-react';
import Tabs from '@/components/Tabs';
import WalletPanel from '@/components/billing/WalletPanel';
import WalkinPOS from '@/components/billing/WalkinPOS';
import PaymentHistory from '@/components/billing/PaymentHistory';

export default function BillingPage() {
  return (
    <Tabs title="Billing & Payments" icon={CreditCard} tabs={[
      { label: 'Wallet', render: () => <WalletPanel /> },
      { label: 'Walk-in POS', render: () => <WalkinPOS /> },
      { label: 'Payment History', render: () => <PaymentHistory /> },
    ]} />
  );
}
