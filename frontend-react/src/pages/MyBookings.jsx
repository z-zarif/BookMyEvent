import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  cancelled: 'Cancelled',
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative overflow-hidden">
      <div className="grain-overlay" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <p className="text-xs uppercase tracking-wide text-[#9C97B8] mb-2">Your stubs</p>
        <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight mb-8">MY BOOKINGS</h1>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}
        {loading && <p className="text-[#9C97B8]">Loading your bookings...</p>}

        {!loading && bookings.length === 0 && !error && (
          <p className="text-[#9C97B8]">
            No bookings yet.{' '}
            <Link to="/events" className="text-[#F5F3FF] underline underline-offset-4 decoration-[#7C3AED]">
              Find a show →
            </Link>
          </p>
        )}

        <div className="space-y-4">
          {bookings.map((b) => (
            <div
              key={b.booking_id}
              className="bg-[#14141F] border border-[#262636] rounded-2xl overflow-hidden flex flex-col sm:flex-row"
            >
              {/* Stub side strip */}
              <div
                className="sm:w-2.5 h-1.5 sm:h-auto"
                style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
              />

              <div className="flex-1 px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <span className="inline-block text-xs uppercase tracking-wide text-[#F5F3FF] px-2.5 py-1 rounded-full bg-[#262636] mb-2">
                    {STATUS_LABEL[b.bk_status] || b.bk_status}
                  </span>
                  <h3 className="font-['Anton'] text-xl tracking-tight">{b.event_title}</h3>
                  <p className="text-[#9C97B8] text-sm">{formatDate(b.event_date_time)}</p>
                </div>

                <div className="flex items-center gap-4">
                  <p className="text-lg font-semibold whitespace-nowrap">₹{b.total_cost}</p>
                  <Link
                    to={`/bookings/${b.booking_id}`}
                    className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#7C3AED]/60 text-[#F5F3FF] hover:bg-[#7C3AED]/10 transition-colors whitespace-nowrap"
                  >
                    View Tickets
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
