import { useEffect, useState } from 'react';
import { getWallet, requestAddMoney } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const TYPE_LABEL = {
  deposit: 'Deposit',
  payment: 'Payment',
  refund: 'Refund',
};

export default function Wallet() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function load() {
    getWallet()
      .then((data) => {
        setWallet(data.wallet);
        setTransactions(data.transactions);
      })
      .catch((err) => setError(err.message));
  }

  useEffect(load, []);

  async function handleAddMoney() {
    setError('');
    setSuccess('');
    const value = Number(amount);
    if (!value || value <= 0) {
      setError('Enter a valid amount');
      return;
    }
    try {
      await requestAddMoney(value);
      setSuccess('Request submitted — pending approval.');
      setAmount('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative overflow-hidden">
      <div className="grain-overlay" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <p className="text-xs uppercase tracking-wide text-[#9C97B8] mb-2">Show me the money</p>
        <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight mb-8">MY WALLET</h1>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-4">
            {error}
          </p>
        )}
        {success && (
          <p className="text-[#4ADE80] text-sm bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-lg px-4 py-3 mb-4">
            {success}
          </p>
        )}

        {/* Balance hero card */}
        <div
          className="rounded-2xl px-7 py-6 mb-8"
          style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
        >
          <p className="text-xs uppercase tracking-wide text-white/70 mb-1">Current Balance</p>
          <p className="font-['Anton'] text-5xl text-white tracking-tight">
            {wallet ? `₹${wallet.balance}` : '...'}
          </p>
        </div>

        {/* Add money card */}
        <div className="bg-[#14141F] border border-[#262636] rounded-2xl px-6 py-5 mb-10 max-w-sm">
          <h3 className="font-['Anton'] text-lg tracking-tight mb-3">TOP UP</h3>
          <input
            type="number"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount"
            className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors mb-3"
          />
          <button
            onClick={handleAddMoney}
            className="w-full text-white font-semibold rounded-lg py-2.5 transition-transform hover:scale-[1.02]"
            style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
          >
            Submit Request
          </button>
          <p className="text-[#9C97B8] text-xs mt-2">Needs approval before it lands in your balance.</p>
        </div>

        {/* Transaction history */}
        <h2 className="font-['Anton'] text-2xl tracking-tight mb-4">TRANSACTION HISTORY</h2>
        {transactions.length === 0 && <p className="text-[#9C97B8]">No transactions yet.</p>}

        <div className="space-y-2">
          {transactions.map((t) => (
            <div
              key={t.transaction_id}
              className="bg-[#14141F] border border-[#262636] rounded-xl px-5 py-4 flex items-center justify-between"
            >
              <div>
                <span className="inline-block text-xs uppercase tracking-wide px-2 py-0.5 rounded-full bg-[#262636] mb-1">
                  {TYPE_LABEL[t.type] || t.type}
                </span>
                <p className="text-[#9C97B8] text-sm">{t.reason}</p>
                <p className="text-[#9C97B8]/70 text-xs">{formatDate(t.happened_at)}</p>
              </div>
              <div className="text-right">
                <p
                  className={`font-semibold ${t.type === 'payment' ? 'text-[#FF3D77]' : 'text-[#4ADE80]'}`}
                >
                  {t.type === 'payment' ? '-' : '+'}₹{t.amount}
                </p>
                <p className="text-[#9C97B8]/70 text-xs">Balance: ₹{t.balance_after}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
