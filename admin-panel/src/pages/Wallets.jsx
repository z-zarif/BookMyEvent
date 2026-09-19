import { useEffect, useState } from 'react';
import { getWallets, getTransactions } from '../api/api';

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

export default function Wallets() {
  const [wallets, setWallets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [tab, setTab] = useState('wallets');
  const [error, setError] = useState('');

  useEffect(() => {
    getWallets().then(setWallets).catch((err) => setError(err.message));
    getTransactions().then(setTransactions).catch(() => {});
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="font-['Anton'] text-3xl tracking-tight mb-6">WALLETS</h1>

      {error && (
        <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      <div className="flex gap-1 border-b border-[#1C1C2A] mb-5">
        <button
          onClick={() => setTab('wallets')}
          className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
            tab === 'wallets' ? 'border-[#7C3AED] text-[#F5F3FF]' : 'border-transparent text-[#9C97B8] hover:text-[#F5F3FF]'
          }`}
        >
          Balances
        </button>
        <button
          onClick={() => setTab('transactions')}
          className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
            tab === 'transactions' ? 'border-[#7C3AED] text-[#F5F3FF]' : 'border-transparent text-[#9C97B8] hover:text-[#F5F3FF]'
          }`}
        >
          All Transactions
        </button>
      </div>

      {tab === 'wallets' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#9C97B8] text-xs uppercase tracking-wide border-b border-[#1C1C2A]">
                <th className="py-3 pr-4 font-normal">User</th>
                <th className="py-3 pr-4 font-normal">Email</th>
                <th className="py-3 pr-4 font-normal">Last Used</th>
                <th className="py-3 text-right font-normal">Balance</th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.wallet_id} className="border-b border-[#1C1C2A]">
                  <td className="py-3 pr-4">{w.user_name}</td>
                  <td className="py-3 pr-4 text-[#9C97B8]">{w.email}</td>
                  <td className="py-3 pr-4 text-[#9C97B8]/60 text-xs">{formatDate(w.last_used)}</td>
                  <td className="py-3 text-right font-semibold">₹{w.balance}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {wallets.length === 0 && <p className="text-[#9C97B8] py-4">No wallets found.</p>}
        </div>
      )}

      {tab === 'transactions' && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[#9C97B8] text-xs uppercase tracking-wide border-b border-[#1C1C2A]">
                <th className="py-3 pr-4 font-normal">User</th>
                <th className="py-3 pr-4 font-normal">Type</th>
                <th className="py-3 pr-4 font-normal">Reason</th>
                <th className="py-3 pr-4 font-normal">When</th>
                <th className="py-3 pr-4 text-right font-normal">Amount</th>
                <th className="py-3 text-right font-normal">After</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.transaction_id} className="border-b border-[#1C1C2A]">
                  <td className="py-3 pr-4">{t.user_name}</td>
                  <td className="py-3 pr-4">
                    <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded-full border border-[#1C1C2A]">
                      {t.type}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-[#9C97B8]">{t.reason}</td>
                  <td className="py-3 pr-4 text-[#9C97B8]/60 text-xs whitespace-nowrap">
                    {formatDate(t.happened_at)}
                  </td>
                  <td className={`py-3 pr-4 text-right font-semibold whitespace-nowrap ${t.type === 'payment' ? 'text-[#FF3D77]' : 'text-[#4ADE80]'}`}>
                    {t.type === 'payment' ? '-' : '+'}₹{t.amount}
                  </td>
                  <td className="py-3 text-right text-[#9C97B8]">₹{t.balance_after}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {transactions.length === 0 && <p className="text-[#9C97B8] py-4">No transactions yet.</p>}
        </div>
      )}
    </div>
  );
}
