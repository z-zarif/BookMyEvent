import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminLogin } from '../api/api';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAdminAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await adminLogin(password);
      login(data.token);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#08080F] text-[#F5F3FF] font-['Manrope'] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="font-['Anton'] text-2xl tracking-tight text-center mb-1">EVENTIA</p>
        <p className="text-xs uppercase tracking-wide text-[#7C3AED] text-center mb-8">
          Admin Console
        </p>

        <form
          onSubmit={handleSubmit}
          className="bg-[#14141F] border border-[#1C1C2A] rounded-xl px-7 py-6"
        >
          {error && (
            <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <label className="text-xs text-[#9C97B8] block mb-1.5">Admin Password</label>
          <input
            type="password"
            required
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#08080F] border border-[#1C1C2A] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors mb-4"
            placeholder="••••••••"
          />

          <button
            type="submit"
            className="w-full bg-[#7C3AED] text-white font-semibold rounded-lg py-3 hover:bg-[#6D2FE0] transition-colors"
          >
            Enter Console
          </button>
        </form>

        <p className="text-center text-xs text-[#9C97B8]/60 mt-6">
          This is a separate password from any customer or organizer account.
        </p>
      </div>
    </div>
  );
}
