'use client';
import { useEffect, useState } from 'react';
import { ShoppingCart, TrendingUp } from 'lucide-react';
import Tabs from '@/components/Tabs';
import CrudPage from '@/components/CrudPage';
import { orders, carts } from '@/lib/resources';
import { useApi } from '@/lib/useApi';
import PayOrderButton from '@/components/billing/PayOrderButton';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');

function Metric({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs text-emerald-600 flex items-center gap-1 mt-1"><TrendingUp size={12} /> {sub}</p>}
    </div>
  );
}

export default function EcommercePage() {
  const { call } = useApi();
  const [rev, setRev] = useState(null);
  const [ordersKey, setOrdersKey] = useState(0); // bump to force CrudPage to reload after a payment

  useEffect(() => { call('/analytics/revenue').then(setRev).catch(() => {}); }, [call]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <ShoppingCart size={20} className="text-brand" />
        <h2 className="text-lg font-bold">Ecommerce & Revenue</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric label="Recovered Carts" value={`${rev?.recoveredCarts ?? 0}/${rev?.totalCarts ?? 0}`} sub={inr(rev?.recoveredValue) + ' recovered'} />
        <Metric label="Revenue Impact" value={inr(rev?.revenue)} />
        <Metric label="COD → Prepaid" value={`${rev?.prepaidOrders ?? 0} prepaid`} sub={`${rev?.codOrders ?? 0} COD`} />
        <Metric label="ROAS" value={`${rev?.roas ?? 0}x`} />
      </div>

      <Tabs title="" tabs={[
        {
          label: 'Orders',
          render: () => (
            <CrudPage
              key={ordersKey}
              {...orders}
              header={false}
              rowActions={(row) => (
                <PayOrderButton order={row} onPaid={() => setOrdersKey((k) => k + 1)} />
              )}
            />
          ),
        },
        { label: 'Abandoned Carts', render: () => <CrudPage {...carts} header={false} /> },
      ]} />
    </div>
  );
}
