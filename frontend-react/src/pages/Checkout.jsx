import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { createBooking } from '../api/api';

export default function Checkout() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const eventId = params.get('eventId');
  const typeId = params.get('typeId');
  const price = Number(params.get('price'));

  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('wallet');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleConfirm() {
    setError('');
    setSuccess('');
    try {
      const result = await createBooking({
        eventId,
        ticketTypeId: typeId,
        quantity,
        paymentMethod,
      });
      setSuccess(`Booking confirmed! Total charged: ₹${result.totalCost}`);
      setTimeout(() => navigate('/my-bookings'), 1500);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-12 bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-xl font-bold mb-4">Checkout</h2>
      {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
      {success && <p className="text-green-600 text-sm mb-3">{success}</p>}

      <p className="mb-3">Price per ticket: <strong>₹{price}</strong></p>

      <label className="text-xs text-gray-500 block mb-1">Quantity</label>
      <input
        type="number"
        min={1}
        value={quantity}
        onChange={(e) => setQuantity(Number(e.target.value))}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3"
      />

      <p className="mb-3">Total: <strong>₹{(price * quantity).toFixed(2)}</strong></p>

      <label className="text-xs text-gray-500 block mb-1">Payment Method</label>
      <select
        value={paymentMethod}
        onChange={(e) => setPaymentMethod(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4"
      >
        <option value="wallet">Wallet</option>
        <option value="card">Card</option>
        <option value="upi">UPI</option>
        <option value="netbanking">Netbanking</option>
      </select>

      <button
        onClick={handleConfirm}
        className="w-full bg-indigo-600 text-white rounded-lg py-2 hover:bg-indigo-700"
      >
        Confirm Booking
      </button>
    </div>
  );
}
