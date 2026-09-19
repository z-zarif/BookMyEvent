import { useEffect, useState } from 'react';
import {
  getAddMoneyRequests,
  approveAddMoneyRequest,
  rejectAddMoneyRequest,
} from '../../api/api';

function formatDate(iso) {
  return iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

const STATUS_STYLE = {
  approved: 'text-[#4ADE80] border-[#4ADE80]/40',
  pending: 'text-[#FACC15] border-[#FACC15]/40',
  rejected: 'text-[#FF3D77] border-[#FF3D77]/40',
};

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    getAddMoneyRequests(filter === 'all' ? undefined : filter)
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [filter]);

  async function act(id, action) {
    setBusyId(id);
    setError('');
    try {
      if (action === 'approve') await approveAddMoneyRequest(id);
      else await rejectAddMoneyRequest(id);
      load(); // refetch so the balance change from the DB trigger is reflected
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="font-['Anton'] text-3xl tracking-tight mb-2">MONEY REQUESTS</h1>
      <p className="text-[#9C97B8] text-sm mb-6">
        Approving a request sets its status to approved, which fires the database
        trigger that creates the deposit and updates the user's balance.
      </p>

      <div className="flex gap-1 border-b border-[#1C1C2A] mb-5">
        {['pending', 'approved', 'rejected', 'all'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-sm px-4 py-2.5 border-b-2 capitalize transition-colors ${
              filter === f
                ? 'border-[#7C3AED] text-[#F5F3FF]'
                : 'border-transparent text-[#9C97B8] hover:text-[#F5F3FF]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}
      {loading && <p className="text-[#9C97B8]">Loading...</p>}
      {!loading && requests.length === 0 && !error && (
        <p className="text-[#9C97B8]">No {filter === 'all' ? '' : filter} requests.</p>
      )}

      <div className="space-y-2">
        {requests.map((r) => (
          <div
            key={r.request_id}
            className="bg-[#14141F] border border-[#1C1C2A] rounded-xl px-5 py-4 flex items-center justify-between flex-wrap gap-4"
          >
            <div>
              <span
                className={`inline-block text-xs uppercase tracking-wide px-2 py-0.5 rounded-full border mb-1.5 ${
                  STATUS_STYLE[r.status] || 'border-[#1C1C2A] text-[#9C97B8]'
                }`}
              >
                {r.status}
              </span>
              <p className="font-semibold">{r.user_name}</p>
              <p className="text-[#9C97B8] text-sm">{r.email}</p>
              <p className="text-[#9C97B8]/60 text-xs mt-1">
                Requested {formatDate(r.requested_at)}
                {r.processed_at ? ` · Processed ${formatDate(r.processed_at)}` : ''}
              </p>
            </div>

            <div className="flex items-center gap-4">
              <p className="font-['Anton'] text-2xl tracking-tight">₹{r.amount}</p>

              {r.status === 'pending' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => act(r.request_id, 'approve')}
                    disabled={busyId === r.request_id}
                    className="text-sm font-semibold px-4 py-2 rounded-lg bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/40 hover:bg-[#4ADE80]/25 transition-colors disabled:opacity-50"
                  >
                    {busyId === r.request_id ? '...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => act(r.request_id, 'reject')}
                    disabled={busyId === r.request_id}
                    className="text-sm px-4 py-2 rounded-lg border border-[#1C1C2A] text-[#9C97B8] hover:text-[#FF3D77] hover:border-[#FF3D77]/50 transition-colors disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
