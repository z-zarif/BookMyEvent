import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { checkAdmin } from '../api/api';
import { useAuth } from '../context/AuthContext';

// Admin area shell. Verifies with the server that the logged-in user is
// actually on the ADMIN_EMAILS allowlist before rendering anything - the
// frontend never decides admin status on its own.
export default function AdminLayout() {
  const [state, setState] = useState('checking'); // checking | ok | denied
  const { logoutUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkAdmin()
      .then(() => setState('ok'))
      .catch(() => setState('denied'));
  }, []);

  if (state === 'checking') {
    return (
      <div className="min-h-screen bg-[#08080F] text-[#9C97B8] font-['Manrope'] flex items-center justify-center">
        Checking access...
      </div>
    );
  }

  if (state === 'denied') {
    return (
      <div className="min-h-screen bg-[#08080F] text-[#F5F3FF] font-['Manrope'] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-['Anton'] text-3xl tracking-tight mb-3">ADMIN ONLY</h1>
        <p className="text-[#9C97B8] max-w-sm mb-6">
          This account isn't on the admin list. Ask whoever runs the server to add
          your email to ADMIN_EMAILS in the server's .env file.
        </p>
        <Link
          to="/events"
          className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
        >
          Back to Eventia
        </Link>
      </div>
    );
  }

  const linkClass = ({ isActive }) =>
    `block px-4 py-2.5 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-[#1C1C2A] text-[#F5F3FF]'
        : 'text-[#9C97B8] hover:text-[#F5F3FF] hover:bg-[#14141F]'
    }`;

  return (
    <div className="min-h-screen bg-[#08080F] text-[#F5F3FF] font-['Manrope'] flex flex-col md:flex-row">
      {/* Sidebar - visually distinct from the main app so it's obvious
          you're in the admin console, not the customer site. */}
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[#1C1C2A] px-4 py-6">
        <div className="px-2 mb-6">
          <p className="font-['Anton'] text-xl tracking-tight">EVENTIA</p>
          <p className="text-xs uppercase tracking-wide text-[#7C3AED]">Admin Console</p>
        </div>

        <nav className="space-y-1">
          <NavLink to="/admin" end className={linkClass}>Overview</NavLink>
          <NavLink to="/admin/requests" className={linkClass}>Money Requests</NavLink>
          <NavLink to="/admin/wallets" className={linkClass}>Wallets</NavLink>
          <NavLink to="/admin/audit-log" className={linkClass}>Audit Log</NavLink>
        </nav>

        <div className="mt-8 pt-6 border-t border-[#1C1C2A] space-y-1">
          <Link
            to="/events"
            className="block px-4 py-2.5 rounded-lg text-sm text-[#9C97B8] hover:text-[#F5F3FF] transition-colors"
          >
            ← Customer site
          </Link>
          <button
            onClick={() => { logoutUser(); navigate('/login'); }}
            className="block w-full text-left px-4 py-2.5 rounded-lg text-sm text-[#FF3D77] hover:bg-[#14141F] transition-colors"
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 px-6 py-8 overflow-x-auto">
        <Outlet />
      </main>
    </div>
  );
}
