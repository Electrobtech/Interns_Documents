'use client';
import { useCallback, useEffect, useState } from 'react';
import { Wallet, AlertTriangle, Plus } from 'lucide-react';
import { useApi } from '@/lib/useApi';
import { inr } from '@/lib/billing';
import RechargeWalletModal from './RechargeWalletModal';

export default function WalletPanel() {
  const { call } = useApi();
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    call('/billing/wallet').then(setWallet).catch((e) => setError(e.message));
    call('/billing/wallet/ledger?pageSize=20').then(setLedger).catch(() => {});
  }, [call]);

  useEffect(() => { load(); }, [load]);

  const lowBalance = wallet && Number(wallet.balance) < Number(wallet.low_balance_threshold);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500 flex items-center gap-1"><Wallet size={12} /> Current Balance</p>
          <p className="text-2xl font-bold mt-1">{wallet ? inr(wallet.balance) : '—'}</p>
          {lowBalance && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <AlertTriangle size={12} /> Below low-balance threshold
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Lifetime Deposited</p>
          <p className="text-2xl font-bold mt-1">{wallet ? inr(wallet.lifetime_deposited) : '—'}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Lifetime Spent</p>
          <p className="text-2xl font-bold mt-1">{wallet ? inr(wallet.lifetime_spent) : '—'}</p>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-2 bg-brand text-white rounded-lg px-4 py-2.5 text-sm font-medium"
      >
        <Plus size={15} /> Recharge Wallet
      </button>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold">Recent Transactions</div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Description</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-right px-4 py-2">Balance After</th>
              <th className="text-left px-4 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No transactions yet</td></tr>
            )}
            {ledger.map((tx) => (
              <tr key={tx.id} className="border-t border-slate-100">
                <td className="px-4 py-2">
                  <span className={`text-xs font-medium ${tx.type === 'RECHARGE' ? 'text-emerald-600' : 'text-slate-600'}`}>
                    {tx.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-500">{tx.description || tx.action_key || '—'}</td>
                <td className="px-4 py-2 text-right">
                  {tx.type === 'RECHARGE' ? '+' : '-'}{inr(tx.amount)}
                </td>
                <td className="px-4 py-2 text-right text-slate-500">{inr(tx.balance_after)}</td>
                <td className="px-4 py-2 text-slate-400">{new Date(tx.created_at).toLocaleString('en-IN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <RechargeWalletModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onRecharged={() => load()}
      />
    </div>
  );
}
