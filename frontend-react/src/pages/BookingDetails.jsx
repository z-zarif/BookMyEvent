import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getBooking } from '../api/api';

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
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative overflow-hidden">
      <div className="grain-overlay" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <Link to="/my-bookings" className="text-sm text-[#9C97B8] hover:text-white transition-colors">
          ← Back to My Bookings
        </Link>

        <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight my-6">YOUR TICKETS</h1>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}
        {!booking && !error && <p className="text-[#9C97B8]">Loading...</p>}

        {booking && (
          <>
            <div className="bg-[#14141F] border border-[#262636] rounded-2xl px-6 py-5 mb-8 flex items-center justify-between">
              <div>
                <span className="inline-block text-xs uppercase tracking-wide px-2.5 py-1 rounded-full bg-[#262636] mb-2">
                  {booking.bk_status}
                </span>
                <p className="text-[#9C97B8] text-sm">Booking ID: {booking.booking_id}</p>
              </div>
              <p className="text-xl font-semibold">₹{booking.total_cost}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {tickets.map((t) => (
                <div
                  key={t.ticket_id}
                  className="bg-[#14141F] border border-[#262636] rounded-2xl overflow-hidden"
                >
                  <div
                    className="px-5 py-3"
                    style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
                  >
                    <span className="text-xs uppercase tracking-wide text-white/80">
                      {t.category}
                    </span>
                  </div>

                  <div className="relative">
                    <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
                    <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
                    <div className="border-t border-dashed border-[#262636] mx-5" />
                  </div>

                  <div className="px-5 py-5">
                    <p className="font-['Anton'] text-2xl tracking-tight mb-1">{t.seat_number}</p>
                    <p className="text-[#9C97B8] text-sm">Price paid: ₹{t.price_paid}</p>
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
