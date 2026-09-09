import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getEvent, addToWishlist } from '../api/api';
import { useAuth } from '../context/AuthContext';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    getEvent(id)
      .then((data) => {
        setEvent(data.event);
        setTicketTypes(data.ticketTypes);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  async function handleWishlist() {
    if (!isLoggedIn) return navigate('/login');
    try {
      await addToWishlist(id);
      alert('Added to wishlist!');
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope']">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/events" className="text-sm text-[#9C97B8] hover:text-white transition-colors">
          ← Back to shows
        </Link>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mt-6">
            {error}
          </p>
        )}
        {!event && !error && <p className="text-[#9C97B8] mt-6">Loading show...</p>}

        {event && (
          <>
            <div className="mt-6 mb-10">
              <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight mb-2">
                {event.title}
              </h1>
              <p className="text-[#9C97B8]">
                {formatDate(event.event_date_time)} &middot; {event.venue}
              </p>
              <p className="text-[#F5F3FF]/80 mt-4 max-w-xl">{event.describe_event}</p>

              <button
                onClick={handleWishlist}
                className="mt-5 text-sm font-semibold px-5 py-2.5 rounded-full border border-[#262636] text-[#F5F3FF] hover:border-[#7C3AED] transition-colors"
              >
                + Add to Wishlist
              </button>
            </div>

            <h2 className="font-['Anton'] text-2xl tracking-tight mb-4">CHOOSE YOUR TICKET</h2>

            {ticketTypes.length === 0 && (
              <p className="text-[#9C97B8]">No ticket types available for this show yet.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
              {ticketTypes.map((tt) => (
                <div
                  key={tt.type_id}
                  className="bg-[#14141F] border border-[#262636] rounded-xl overflow-hidden hover:border-[#7C3AED]/50 transition-colors"
                >
                  <div className="px-5 py-4 border-b border-[#262636]">
                    <span className="text-xs uppercase tracking-wide text-[#9C97B8]">
                      {tt.category}
                    </span>
                  </div>

                  <div className="px-5 py-5">
                    <p className="font-['Anton'] text-3xl tracking-tight mb-1">₹{tt.price}</p>
                    <p className="text-[#9C97B8] text-sm mb-4">{tt.quantity_available} left</p>

                    <Link
                      to={`/checkout?typeId=${tt.type_id}&price=${tt.price}&category=${tt.category}`}
                      className="inline-block w-full text-center text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
                    >
                      Book
                    </Link>
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
