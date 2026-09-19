import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBooking } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

const STATUS_STYLE = {
  confirmed: 'text-[#4ADE80] border-[#4ADE80]/40',
  pending: 'text-[#FACC15] border-[#FACC15]/40',
  cancelled: 'text-[#FF3D77] border-[#FF3D77]/40',
};

export default function BookingDetails() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getBooking(id)
      .then((data) => {
        setBooking(data.booking);
        setTickets(data.tickets);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope']">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/my-bookings" className="text-sm text-[#9C97B8] hover:text-white transition-colors">
          ← Back to My Bookings
        </Link>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mt-6">
            {error}
          </p>
        )}
        {!booking && !error && <p className="text-[#9C97B8] mt-6">Loading...</p>}

        {booking && (
          <>
            <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight mt-6 mb-2">
              {booking.event_title}
            </h1>
            <p className="text-[#9C97B8] mb-6">
              {formatDate(booking.event_date_time)}
              {booking.venue ? ` · ${booking.venue}` : ''}
            </p>

            <div className="bg-[#14141F] border border-[#262636] rounded-xl px-6 py-5 mb-8 flex items-center justify-between flex-wrap gap-3">
              <div>
                <span
                  className={`inline-block text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border mb-2 ${
                    STATUS_STYLE[booking.bk_status] || 'text-[#9C97B8] border-[#262636]'
                  }`}
                >
                  {booking.bk_status}
                </span>
                <p className="text-[#9C97B8] text-sm">Booking ID: {booking.booking_id}</p>
                <p className="text-[#9C97B8]/60 text-xs">
                  Booked {formatDate(booking.booking_time)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#9C97B8] text-xs uppercase tracking-wide">Total</p>
                <p className="text-2xl font-semibold">₹{booking.total_cost}</p>
              </div>
            </div>

            <h2 className="font-['Anton'] text-2xl tracking-tight mb-4">
              TICKETS ({tickets.length})
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {tickets.map((t) => (
                <div
                  key={t.ticket_id}
                  className="bg-[#14141F] border border-[#262636] rounded-xl overflow-hidden"
                >
                  <div className="px-5 py-4 border-b border-[#262636] flex justify-between items-center">
                    <span className="text-xs uppercase tracking-wide text-[#9C97B8]">
                      {t.category}
                    </span>
                    <span className="text-xs text-[#9C97B8]">₹{t.price_paid}</span>
                  </div>

                  <div className="px-5 py-5">
                    <p className="text-[#9C97B8] text-xs uppercase tracking-wide mb-1">Seat</p>
                    <p className="font-['Anton'] text-2xl tracking-tight">{t.seat_number}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
