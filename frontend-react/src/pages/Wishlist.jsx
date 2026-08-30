import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWishlist, removeFromWishlist } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getWishlist().then(setItems).catch((err) => setError(err.message));
  }, []);

  async function handleRemove(eventId) {
    try {
      await removeFromWishlist(eventId);
      setItems((prev) => prev.filter((ev) => ev.event_id !== eventId));
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">My Wishlist</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {items.length === 0 && !error && <p className="text-gray-500">Your wishlist is empty.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((ev) => (
          <div key={ev.event_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <h3 className="font-semibold">{ev.title}</h3>
            <p className="text-gray-500 text-sm mb-3">
              {formatDate(ev.event_date_time)} &middot; {ev.venue}
            </p>
            <div className="flex gap-2">
              <Link
                to={`/events/${ev.event_id}`}
                className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700"
              >
                View
              </Link>
              <button
                onClick={() => handleRemove(ev.event_id)}
                className="border border-indigo-600 text-indigo-600 text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
