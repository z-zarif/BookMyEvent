import { useEffect, useState } from 'react';
import { getWallet, requestAddMoney } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

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
      setSuccess('Add-money request submitted, pending approval.');
      setAmount('');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">My Wallet</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <p className="text-gray-500 text-sm">Current Balance</p>
        <h2 className="text-2xl font-bold">{wallet ? `₹${wallet.balance}` : 'Loading...'}</h2>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-8 max-w-sm">
        <h3 className="font-semibold mb-3">Add Money</h3>
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
        />
        <button
          onClick={handleAddMoney}
          className="w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700"
        >
          Submit Request
        </button>
        <p className="text-gray-500 text-xs mt-2">Requests need approval before funds appear.</p>
      </div>

      <h2 className="text-lg font-bold mb-3">Transaction History</h2>
      {transactions.length === 0 && <p className="text-gray-500">No transactions yet.</p>}
      <div className="space-y-2">
        {transactions.map((t) => (
          <div key={t.transaction_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full mb-1">
              {t.type}
            </span>
            <p>₹{t.amount} &middot; {t.reason}</p>
            <p className="text-gray-500 text-sm">
              {formatDate(t.happened_at)} &middot; Balance after: ₹{t.balance_after}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
