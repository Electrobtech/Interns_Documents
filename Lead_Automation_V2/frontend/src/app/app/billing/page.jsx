'use client';
import { CreditCard } from 'lucide-react';
import Tabs from '@/components/Tabs';
import WalletPanel from '@/components/billing/WalletPanel';
import WalkinPOS from '@/components/billing/WalkinPOS';
import PaymentHistory from '@/components/billing/PaymentHistory';
import ChannelSubscriptions from '@/components/billing/ChannelSubscriptions';
import InvoiceView from '@/components/billing/InvoiceView';

export default function BillingPage() {
  return (
    <Tabs title="Billing & Payments" icon={CreditCard} tabs={[
      { label: 'Channels', render: () => <ChannelSubscriptions /> },
      { label: 'Wallet', render: () => <WalletPanel /> },
      { label: 'Invoices', render: () => <InvoiceView /> },
      { label: 'Walk-in POS', render: () => <WalkinPOS /> },
      { label: 'Payment History', render: () => <PaymentHistory /> },
    ]} />
  );
}
