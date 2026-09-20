import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { createBooking } from '../api/api';

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const typeId = params.get('typeId');
  const price = Number(params.get('price'));
  const category = params.get('category');
  const eventTitle = params.get('title');

  const [qty, setQty] = useState(1);
  const [showPromo, setShowPromo] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setError('');
    setSubmitting(true);

    // Only send promoCode when the user actually entered one. Sending an
    // empty/unknown code makes the backend reject the whole booking with
    // "Invalid or expired promo code".
    const payload = { typeId, qty };
    const trimmed = promoCode.trim();
    if (showPromo && trimmed) payload.promoCode = trimmed.toUpperCase();

    try {
      const data = await createBooking(payload);
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Success screen - confirms the booking actually went through before
  // sending the user anywhere.
  if (result) {
    return (
      <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm bg-[#14141F] border border-[#262636] rounded-xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#262636]">
            <p className="text-xs uppercase tracking-wide text-[#4ADE80]">Confirmed</p>
            <h2 className="font-['Anton'] text-2xl tracking-tight">Booking complete</h2>
          </div>

          <div className="px-7 py-6 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[#9C97B8]">Tickets</span>
              <span>{result.quantity}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#9C97B8]">Subtotal</span>
              <span>₹{result.totalCost}</span>
            </div>
            {result.discount > 0 && (
              <div className="flex justify-between text-[#4ADE80]">
                <span>Discount</span>
                <span>-₹{result.discount}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#262636] pt-3 font-semibold">
              <span>Charged</span>
              <span>₹{result.amountCharged}</span>
            </div>

            <div className="flex gap-2 pt-3">
              <Link
                to={`/bookings/${result.bookingId}`}
                className="flex-1 text-center text-sm font-semibold px-4 py-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
              >
                View Tickets
              </Link>
              <button
                onClick={() => navigate('/my-bookings')}
                className="flex-1 text-sm font-semibold px-4 py-2.5 rounded-lg border border-[#262636] text-[#F5F3FF] hover:border-[#7C3AED] transition-colors"
              >
                My Bookings
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-[#14141F] border border-[#262636] rounded-xl overflow-hidden">
          <div className="px-7 py-5 border-b border-[#262636]">
            <p className="text-xs uppercase tracking-wide text-[#9C97B8]">{category || 'Ticket'}</p>
            <h2 className="font-['Anton'] text-2xl tracking-tight">
              {eventTitle || 'Checkout'}
            </h2>
          </div>

          <div className="px-7 py-6 space-y-4">
            {error && (
              <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex justify-between text-sm">
              <span className="text-[#9C97B8]">Price per ticket</span>
              <span className="font-semibold">₹{price}</span>
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Quantity</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
            </div>

            {!showPromo ? (
              <button
                type="button"
                onClick={() => setShowPromo(true)}
                className="text-sm text-[#9C97B8] hover:text-[#F5F3FF] transition-colors underline underline-offset-4 decoration-[#262636]"
              >
                Have a promo code?
              </button>
            ) : (
              <div>
                <label className="text-xs text-[#9C97B8] block mb-1.5">Promo code</label>
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Enter code"
                  className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors uppercase"
                />
                <button
                  type="button"
                  onClick={() => { setShowPromo(false); setPromoCode(''); }}
                  className="text-xs text-[#9C97B8] hover:text-[#F5F3FF] mt-1.5"
                >
                  Remove
                </button>
              </div>
            )}

            <div className="flex justify-between border-t border-[#262636] pt-4">
              <span className="text-[#9C97B8] text-sm">Total</span>
              <span className="font-semibold">₹{(price * qty).toFixed(2)}</span>
            </div>

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full bg-[#7C3AED] text-white font-semibold rounded-lg py-3 hover:bg-[#6D2FE0] transition-colors disabled:opacity-50"
            >
              {submitting ? 'Processing...' : 'Confirm Booking'}
            </button>

            <p className="text-[#9C97B8]/60 text-xs text-center">
              Paid from your Eventia wallet balance
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
