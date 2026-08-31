import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getWishlist, removeFromWishlist } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWishlist()
      .then(setItems)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
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
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative overflow-hidden">
      <div className="grain-overlay" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-10">
        <p className="text-xs uppercase tracking-wide text-[#9C97B8] mb-2">Saved for later</p>
        <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight mb-8">MY WISHLIST</h1>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}
        {loading && <p className="text-[#9C97B8]">Loading your list...</p>}

        {!loading && items.length === 0 && !error && (
          <p className="text-[#9C97B8]">
            Nothing saved yet.{' '}
            <Link to="/events" className="text-[#F5F3FF] underline underline-offset-4 decoration-[#7C3AED]">
              Browse shows →
            </Link>
          </p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {items.map((ev) => (
            <div
              key={ev.event_id}
              className="bg-[#14141F] border border-[#262636] rounded-2xl overflow-hidden group hover:border-[#7C3AED]/60 transition-colors"
            >
              <div
                className="px-5 py-3"
                style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
              >
                <span className="text-xs uppercase tracking-wide text-white/80">Saved</span>
              </div>

              <div className="relative">
                <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
                <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
                <div className="border-t border-dashed border-[#262636] mx-5" />
              </div>

              <div className="px-5 py-5">
                <h3 className="font-['Anton'] text-xl tracking-tight mb-1">{ev.title}</h3>
                <p className="text-[#9C97B8] text-sm">{formatDate(ev.event_date_time)}</p>
                <p className="text-[#9C97B8] text-sm mb-4">{ev.venue}</p>

                <div className="flex gap-2">
                  <Link
                    to={`/events/${ev.event_id}`}
                    className="flex-1 text-center text-sm font-semibold px-3 py-2 rounded-lg text-white transition-transform group-hover:scale-[1.02]"
                    style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
                  >
                    View
                  </Link>
                  <button
                    onClick={() => handleRemove(ev.event_id)}
                    className="text-sm px-3 py-2 rounded-lg border border-[#262636] text-[#9C97B8] hover:text-[#FF3D77] hover:border-[#FF3D77]/50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
