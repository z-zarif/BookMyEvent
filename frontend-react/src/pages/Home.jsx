import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getEvents } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope']">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <p className="text-xs uppercase tracking-wide text-[#9C97B8] mb-2">On sale now</p>
        <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight mb-8">
          UPCOMING SHOWS
        </h1>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}
        {loading && <p className="text-[#9C97B8]">Loading shows...</p>}

        {!loading && events.length === 0 && !error && (
          <p className="text-[#9C97B8]">Nothing on the calendar yet. Check back soon.</p>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {events.map((ev) => (
            <div
              key={ev.event_id}
              className="bg-[#14141F] border border-[#262636] rounded-xl overflow-hidden hover:border-[#7C3AED]/50 transition-colors"
            >
              <div className="px-5 py-4 border-b border-[#262636] flex items-center justify-between">
                <span className="text-xs uppercase tracking-wide text-[#9C97B8]">
                  {ev.status}
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF3D77]" />
              </div>

              <div className="px-5 py-5">
                <h3 className="font-['Anton'] text-xl tracking-tight mb-1">{ev.title}</h3>
                <p className="text-[#9C97B8] text-sm">{formatDate(ev.event_date_time)}</p>
                <p className="text-[#9C97B8] text-sm">{ev.venue}</p>
                <p className="text-[#9C97B8]/60 text-xs mt-1 mb-4">Hosted by {ev.user_name}</p>

                <Link
                  to={`/events/${ev.event_id}`}
                  className="inline-block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
