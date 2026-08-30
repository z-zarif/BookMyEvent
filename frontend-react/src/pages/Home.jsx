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
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold mb-6">Upcoming Events</h1>
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
      {loading && <p className="text-gray-500">Loading events...</p>}

      {!loading && events.length === 0 && (
        <p className="text-gray-500">No events scheduled right now.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {events.map((ev) => (
          <div key={ev.event_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full mb-2">
              {ev.status}
            </span>
            <h3 className="font-semibold">{ev.title}</h3>
            <p className="text-gray-500 text-sm">{formatDate(ev.event_date_time)}</p>
            <p className="text-gray-500 text-sm mb-3">{ev.venue}</p>
            <Link
              to={`/events/${ev.event_id}`}
              className="inline-block bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700"
            >
              View Details
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
