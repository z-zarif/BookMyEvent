import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function Layout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();

  const linkClass = ({ isActive }) =>
    `block px-4 py-2.5 rounded-lg text-sm transition-colors ${
      isActive
        ? 'bg-[#1C1C2A] text-[#F5F3FF]'
        : 'text-[#9C97B8] hover:text-[#F5F3FF] hover:bg-[#14141F]'
    }`;

  return (
    <div className="min-h-screen bg-[#08080F] text-[#F5F3FF] font-['Manrope'] flex flex-col md:flex-row">
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-[#1C1C2A] px-4 py-6">
        <div className="px-2 mb-6">
          <p className="font-['Anton'] text-xl tracking-tight">EVENTIA</p>
          <p className="text-xs uppercase tracking-wide text-[#7C3AED]">Admin Console</p>
        </div>

        <nav className="space-y-1">
          <NavLink to="/" end className={linkClass}>Overview</NavLink>
          <NavLink to="/requests" className={linkClass}>Money Requests</NavLink>
          <NavLink to="/wallets" className={linkClass}>Wallets</NavLink>
          <NavLink to="/audit-log" className={linkClass}>Audit Log</NavLink>
        </nav>

        <div className="mt-8 pt-6 border-t border-[#1C1C2A]">
          <button
            onClick={() => { logout(); navigate('/login'); }}
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
