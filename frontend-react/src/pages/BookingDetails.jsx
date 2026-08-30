import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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

  if (error) return <p className="text-red-600 max-w-4xl mx-auto px-6 py-8">{error}</p>;
  if (!booking) return <p className="text-gray-500 max-w-4xl mx-auto px-6 py-8">Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-4">Booking Details</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full mb-2">
          {booking.bk_status}
        </span>
        <p>Booking ID: {booking.booking_id}</p>
        <p>Total: ₹{booking.total_cost}</p>
      </div>

      <h2 className="text-lg font-bold mb-3">Tickets</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tickets.map((t) => (
          <div key={t.ticket_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full mb-2">
              {t.category}
            </span>
            <p>Seat: {t.seat_number}</p>
            <p>Price paid: ₹{t.price_paid}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
