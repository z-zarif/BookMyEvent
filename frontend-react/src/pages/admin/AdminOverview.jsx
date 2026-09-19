import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats } from '../../api/api';

function Stat({ label, value, accent }) {
  return (
    <div className="bg-[#14141F] border border-[#1C1C2A] rounded-xl px-5 py-5">
      <p className="text-xs uppercase tracking-wide text-[#9C97B8] mb-1">{label}</p>
      <p className={`font-['Anton'] text-3xl tracking-tight ${accent || ''}`}>{value}</p>
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminStats().then(setStats).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-4xl">
      <h1 className="font-['Anton'] text-3xl tracking-tight mb-6">OVERVIEW</h1>

      {error && (
        <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
          {error}
        </p>
      )}
      {!stats && !error && <p className="text-[#9C97B8]">Loading...</p>}

      {stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <Stat label="Users" value={stats.total_users} />
            <Stat label="Events" value={stats.total_events} />
            <Stat label="Confirmed Bookings" value={stats.confirmed_bookings} />
            <Stat
              label="Pending Requests"
              value={stats.pending_requests}
              accent={Number(stats.pending_requests) > 0 ? 'text-[#FACC15]' : ''}
            />
            <Stat label="Total Wallet Balance" value={`₹${stats.total_wallet_balance}`} />
          </div>

          {Number(stats.pending_requests) > 0 && (
            <Link
              to="/admin/requests"
              className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
            >
              Review {stats.pending_requests} pending request
              {Number(stats.pending_requests) === 1 ? '' : 's'} →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
