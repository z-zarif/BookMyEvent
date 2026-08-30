import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyBookings } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getMyBookings().then(setBookings).catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">My Bookings</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {bookings.length === 0 && !error && <p className="text-gray-500">No bookings yet.</p>}

      <div className="space-y-3">
        {bookings.map((b) => (
          <div key={b.booking_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full mb-2">
              {b.bk_status}
            </span>
            <h3 className="font-semibold">{b.event_title}</h3>
            <p className="text-gray-500 text-sm">{formatDate(b.event_date_time)}</p>
            <p className="mb-2">Total paid: ₹{b.total_cost}</p>
            <Link
              to={`/bookings/${b.booking_id}`}
              className="text-indigo-600 border border-indigo-600 rounded-lg px-3 py-1.5 text-sm inline-block hover:bg-indigo-50"
            >
              View Tickets
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
