import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createEvent } from '../api/api';

const CATEGORIES = ['REGULAR', 'VIP', 'PLATINUM', 'EARLY_BIRD'];

function emptyTicketType() {
  return { category: 'REGULAR', quantity: 100, price: 500 };
}

export default function CreateEvent() {
  const [title, setTitle] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [venue, setVenue] = useState('');
  const [description, setDescription] = useState('');
  const [ticketTypes, setTicketTypes] = useState([emptyTicketType()]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  function updateTicketType(index, field, value) {
    setTicketTypes((prev) =>
      prev.map((tt, i) => (i === index ? { ...tt, [field]: value } : tt))
    );
  }

  function addTicketType() {
    setTicketTypes((prev) => [...prev, emptyTicketType()]);
  }

  function removeTicketType(index) {
    setTicketTypes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createEvent({
        title,
        date_time: dateTime,
        venue,
        description,
        ticketTypes: ticketTypes.map((tt) => ({
          category: tt.category,
          quantity: Number(tt.quantity),
          price: Number(tt.price),
        })),
      });
      navigate('/organizer/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope']">

      <div className="relative z-10 max-w-2xl mx-auto px-6 py-10">
        <Link to="/organizer/dashboard" className="text-sm text-[#9C97B8] hover:text-white transition-colors">
          ← Back to dashboard
        </Link>

        <h1 className="font-['Anton'] text-4xl md:text-5xl tracking-tight my-6">CREATE A SHOW</h1>

        {error && (
          <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#14141F] border border-[#262636] rounded-xl px-6 py-6 space-y-4">
            <h2 className="font-['Anton'] text-lg tracking-tight mb-2">SHOW DETAILS</h2>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Title</label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Neon Static"
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-[#9C97B8] block mb-1.5">Date &amp; Time</label>
                <input
                  type="datetime-local"
                  required
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-[#9C97B8] block mb-1.5">Venue</label>
                <input
                  required
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="e.g. Skyline Arena"
                  className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="What should fans know about this show?"
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors resize-none"
              />
            </div>
          </div>

          <div className="bg-[#14141F] border border-[#262636] rounded-xl px-6 py-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-['Anton'] text-lg tracking-tight">TICKET TYPES</h2>
              <button
                type="button"
                onClick={addTicketType}
                className="text-sm text-[#F5F3FF] border border-[#7C3AED]/60 rounded-full px-3 py-1 hover:bg-[#7C3AED]/10 transition-colors"
              >
                + Add
              </button>
            </div>

            {ticketTypes.map((tt, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end border-t border-dashed border-[#262636] pt-4 first:border-t-0 first:pt-0"
              >
                <div>
                  <label className="text-xs text-[#9C97B8] block mb-1.5">Category</label>
                  <select
                    value={tt.category}
                    onChange={(e) => updateTicketType(index, 'category', e.target.value)}
                    className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[#9C97B8] block mb-1.5">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={tt.quantity}
                    onChange={(e) => updateTicketType(index, 'quantity', e.target.value)}
                    className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-[#9C97B8] block mb-1.5">Price (₹)</label>
                  <input
                    type="number"
                    min={1}
                    value={tt.price}
                    onChange={(e) => updateTicketType(index, 'price', e.target.value)}
                    className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
                  />
                </div>
                {ticketTypes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTicketType(index)}
                    className="text-sm text-[#FF3D77] hover:text-[#FF3D77]/80 transition-colors pb-2.5"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-white font-semibold rounded-lg py-3.5 transition-colors hover:brightness-110 disabled:opacity-50 disabled:hover:brightness-100"
            style={{ background: '#5B4FE0' }}
          >
            {submitting ? 'Creating...' : 'Publish Show'}
          </button>
        </form>
      </div>
    </div>
  );
}
