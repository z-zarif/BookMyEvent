import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerOrganizer } from '../api/api';
import { useAuth } from '../context/AuthContext';

export default function BecomeOrganizer() {
  const [companyName, setCompanyName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState('');
  const { refreshToken } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const data = await registerOrganizer(companyName, bio);
      refreshToken(data.token);
      navigate('/organizer/dashboard');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0B14] text-[#F5F3FF] font-['Manrope'] relative flex flex-col items-center justify-center px-6 overflow-hidden">
      <div className="grain-overlay" />

      <Link
        to="/events"
        className="absolute top-6 left-8 font-['Anton'] text-xl tracking-tight text-[#F5F3FF]/80 hover:text-white transition-colors z-10"
      >
        EVENTIA
      </Link>

      <div className="relative z-10 w-full max-w-sm">
        <div className="bg-[#14141F] border border-[#262636] rounded-2xl overflow-hidden">
          <div
            className="px-7 py-5"
            style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
          >
            <p className="text-xs uppercase tracking-wide text-white/80">Backstage access</p>
            <h2 className="font-['Anton'] text-2xl tracking-tight text-white">Become an Organizer</h2>
          </div>

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
              <label className="text-xs text-[#9C97B8] block mb-1.5">Company / Promoter name</label>
              <input
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Eventia Presents"
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-[#9C97B8] block mb-1.5">Bio (optional)</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Tell fans what kind of shows you run..."
                className="w-full bg-[#0B0B14] border border-[#262636] rounded-lg px-3.5 py-2.5 text-[#F5F3FF] placeholder-[#9C97B8]/50 focus:outline-none focus:border-[#7C3AED] transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full text-white font-semibold rounded-lg py-3 mt-2 transition-transform hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg, #FF3D77, #7C3AED)' }}
            >
              Start Organizing
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
