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

  if (error) return <p className="text-red-600 max-w-4xl mx-auto px-6 py-8">{error}</p>;
  if (!event) return <p className="text-gray-500 max-w-4xl mx-auto px-6 py-8">Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold">{event.title}</h1>
      <p className="text-gray-500 mb-1">
        {formatDate(event.event_date_time)} &middot; {event.venue}
      </p>
      <p className="mb-4">{event.describe_event}</p>
      <button
        onClick={handleWishlist}
        className="border border-indigo-600 text-indigo-600 rounded-lg px-4 py-1.5 mb-8 hover:bg-indigo-50"
      >
        Add to Wishlist
      </button>

      <h2 className="text-lg font-bold mb-3">Ticket Types</h2>
      {ticketTypes.length === 0 && <p className="text-gray-500">No ticket types available.</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {ticketTypes.map((tt) => (
          <div key={tt.type_id} className="bg-white border border-gray-200 rounded-xl p-4">
            <span className="inline-block bg-indigo-50 text-indigo-600 text-xs px-2 py-0.5 rounded-full mb-2">
              {tt.category}
            </span>
            <h3 className="text-lg font-bold">₹{tt.price}</h3>
            <p className="text-gray-500 text-sm mb-3">{tt.quantity_available} left</p>
            <Link
              to={`/checkout?eventId=${id}&typeId=${tt.type_id}&price=${tt.price}`}
              className="inline-block bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-indigo-700"
            >
              Book
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
