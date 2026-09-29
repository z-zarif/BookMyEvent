import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cancelEvent, deleteEvent, getMyOrganizerEvents } from '../api/api';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function OrganizerDashboard() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  async function handleDelete(eventId) {
    if (!window.confirm('Delete this event permanently?')) return;
    try {
      await deleteEvent(eventId);
      setEvents((current) => current.filter((event) => event.event_id !== eventId));
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(eventId) {
    if (!window.confirm('Cancel this event? All eligible bookings will be refunded.')) return;
    try {
      await cancelEvent(eventId);
      setEvents((current) =>
        current.map((event) =>
          event.event_id === eventId
            ? { ...event, status: 'cancelled' }
            : event
        )
      );
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    getMyOrganizerEvents()
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope']">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between flex-wrap gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#9C97B8] mb-2">Backstage</p>
            <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight">YOUR SHOWS</h1>
          </div>
          <Link
            to="/organizer/create-event"
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
          >
            + Create Event
          </Link>
        </div>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}
        {loading && <p className="text-[#9C97B8]">Loading your events...</p>}

        {!loading && events.length === 0 && !error && (
          <p className="text-[#9C97B8]">
            You haven't created any shows yet. Hit "Create Event" to get your first one on sale.
          </p>
        )}

        <div className="space-y-3">
          {events.map((ev) => (
            <div
              key={ev.event_id}
              className="bg-[#14141F] border border-[#262636] rounded-xl px-6 py-5 flex items-center justify-between flex-wrap gap-3 hover:border-[#7C3AED]/50 transition-colors"
            >
              <div>
                <span className="inline-block text-xs uppercase tracking-wide px-2.5 py-1 rounded-full border border-[#262636] mb-2">
                  {ev.status}
                </span>
                <h3 className="font-['Anton'] text-xl tracking-tight">{ev.title}</h3>
                <p className="text-[#9C97B8] text-sm">
                  {formatDate(ev.event_date_time)} &middot; {ev.venue}
                </p>
              </div>
              <Link
                to={`/events/${ev.event_id}`}
                className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#262636] text-[#F5F3FF] hover:border-[#7C3AED] transition-colors"
              >
                View Listing
              </Link>
              {ev.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => handleCancel(ev.event_id)}
                  className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#F59E0B]/60 text-[#F59E0B] hover:bg-[#F59E0B]/10 transition-colors"
                >
                  Cancel Event
                </button>
              )}
              {ev.status !== 'cancelled' && ev.status !== 'completed' && (
                <button
                  type="button"
                  onClick={() => handleDelete(ev.event_id)}
                  className="text-sm font-semibold px-4 py-2 rounded-lg border border-[#FF3D77]/60 text-[#FF3D77] hover:bg-[#FF3D77]/10 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
