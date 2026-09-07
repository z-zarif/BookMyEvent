import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createBooking } from '../api/api';

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const typeId = params.get('typeId');
  const price = Number(params.get('price'));
  const category = params.get('category');

  const [qty, setQty] = useState(1);
  const [promoCode, setPromoCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      // Backend contract: { typeId, qty, promoCode } - matches bookings.js exactly
      const result = await createBooking({
        typeId,
        qty,
        promoCode: promoCode.trim() || undefined,
      });

      const discountLine = result.discount > 0 ? ` (₹${result.discount} off)` : '';
      setSuccess(`Booked! Charged ₹${result.amountCharged}${discountLine}`);
      setTimeout(() => navigate('/my-bookings'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative flex items-center justify-center px-6 py-12 overflow-hidden">
      <div className="grain-overlay" />

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-[#14141F] border border-[#262636] rounded-2xl overflow-hidden">
          <div
            className="px-7 py-5"
            style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
          >
            <p className="text-xs uppercase tracking-wide text-white/80">{category || 'Ticket'}</p>
            <h2 className="font-['Anton'] text-2xl tracking-tight text-white">Checkout</h2>
          </div>

          <div className="relative">
            <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
            <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
            <div className="border-t border-dashed border-[#262636] mx-6" />
          </div>

          <div className="px-7 py-6 space-y-4">
            {error && (
              <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            {success && (
              <p className="text-[#4ADE80] text-sm bg-[#4ADE80]/10 border border-[#4ADE80]/30 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

            <p className="text-[#9C97B8] text-sm">
              Price per ticket: <span className="text-[#F5F3FF] font-semibold">₹{price}</span>
            </p>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Quantity</label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Promo code (optional)</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="e.g. VIP20"
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors uppercase"
              />
            </div>

            <p className="text-[#9C97B8] text-sm">
              Estimated total: <span className="text-[#F5F3FF] font-semibold">₹{(price * qty).toFixed(2)}</span>
              <span className="block text-xs text-[#9C97B8]/70 mt-0.5">
                Final amount (with any discount) is confirmed after submitting
              </span>
            </p>

            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full text-white font-semibold rounded-lg py-3 mt-2 transition-transform hover:scale-[1.02] disabled:opacity-50 disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
            >
              {submitting ? 'Processing...' : 'Confirm Booking'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
