import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState('');
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await register(userName, email, password, gender);
      loginUser(data.token, data.userName);
      navigate('/events');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative flex flex-col items-center justify-center px-6 py-12 overflow-hidden">
      <div className="grain-overlay" />

      <Link
        to="/"
        className="absolute top-6 left-8 font-['Anton'] text-xl tracking-tight text-[#F5F3FF]/80 hover:text-white transition-colors z-10"
      >
        EVENTIA
      </Link>

      {/* Ticket stub card */}
      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-[#14141F] border border-[#262636] rounded-2xl overflow-hidden">
          {/* Stub header strip */}
          <div
            className="px-7 py-5 relative"
            style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
          >
            <p className="text-xs uppercase tracking-wide text-white/80">First time here</p>
            <h2 className="font-['Anton'] text-2xl tracking-tight text-white">Get your pass</h2>
          </div>

          {/* Perforation notches + dashed tear line */}
          <div className="relative">
            <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
            <div className="absolute -right-3 -top-3 w-6 h-6 rounded-full bg-[#0B0B14]" />
            <div className="border-t border-dashed border-[#262636] mx-6" />
          </div>

          <form onSubmit={handleSubmit} className="px-7 py-6 space-y-4">
            {error && (
              <p className="text-[#FF3D77] text-sm bg-[#FF3D77]/10 border border-[#FF3D77]/30 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Full name</label>
              <input
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="Jordan Rivera"
              />
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] focus:outline-none focus:border-[#7C3AED] transition-colors"
              >
                <option value="">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full text-white font-semibold rounded-lg py-3 mt-2 transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
            >
              Claim my ticket
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#9C97B8] mt-6">
          Already going? <Link to="/login" className="text-[#F5F3FF] underline underline-offset-4 decoration-[#7C3AED]">Log in</Link>
        </p>
      </div>
    </div>
  );
}
