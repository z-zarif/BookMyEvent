import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings, cancelBooking } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_STYLE = {
  confirmed: 'text-[#4ADE80] border-[#4ADE80]/40',
  pending: 'text-[#FACC15] border-[#FACC15]/40',
  cancelled: 'text-[#FF3D77] border-[#FF3D77]/40',
};

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState(null);

  function load() {
    setLoading(true);
    getMyBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function handleCancel(bookingId) {
    if (!window.confirm('Cancel this booking? Your tickets will be released and refunded.')) return;

    setCancellingId(bookingId);
    setError('');
    try {
      await cancelBooking(bookingId);
      load(); // refetch so status and refund are reflected from the DB, not guessed
    } catch (err) {
      setError(err.message);
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope']">
      <div className="max-w-3xl mx-auto px-6 py-10">
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

        <div className="space-y-3">
          {bookings.map((b) => (
            <div
              key={b.booking_id}
              className="bg-[#14141F] border border-[#262636] rounded-xl px-6 py-5 hover:border-[#7C3AED]/50 transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <span
                    className={`inline-block text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border mb-2 ${
                      STATUS_STYLE[b.bk_status] || 'text-[#9C97B8] border-[#262636]'
                    }`}
                  >
                    {b.bk_status}
                  </span>
                  <h3 className="font-['Anton'] text-xl tracking-tight">{b.event_title}</h3>
                  <p className="text-[#9C97B8] text-sm">
                    {formatDate(b.event_date_time)}
                    {b.venue ? ` · ${b.venue}` : ''}
                  </p>
                  <p className="text-[#9C97B8]/60 text-xs mt-1">
                    Booked {formatDate(b.booking_time)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-lg font-semibold whitespace-nowrap mb-2">₹{b.total_cost}</p>
                  <div className="flex gap-2 justify-end">
                    <Link
                      to={`/bookings/${b.booking_id}`}
                      className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#262636] hover:border-[#7C3AED] transition-colors whitespace-nowrap"
                    >
                      Tickets
                    </Link>
                    {b.bk_status !== 'cancelled' && (
                      <button
                        onClick={() => handleCancel(b.booking_id)}
                        disabled={cancellingId === b.booking_id}
                        className="text-sm px-4 py-2 rounded-lg border border-[#262636] text-[#9C97B8] hover:text-[#FF3D77] hover:border-[#FF3D77]/50 transition-colors disabled:opacity-50 whitespace-nowrap"
                      >
                        {cancellingId === b.booking_id ? '...' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
