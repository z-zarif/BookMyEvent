import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isLoggedIn, isOrganizer, user, logoutUser } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();

  function handleLogout() {
    setProfileOpen(false);
    logoutUser();
    navigate('/login');
  }

  const userName = user?.user_name || 'Account';
  const initials = userName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <nav className="flex items-center justify-between px-6 md:px-8 py-4 bg-[#0B0B14] border-b border-[#262636] flex-wrap gap-3">
      <Link to="/events" className="font-['Anton'] text-xl tracking-tight text-[#F5F3FF]">
        EVENTIA
      </Link>
      <div className="flex items-center gap-4 md:gap-6 text-sm font-['Manrope'] text-[#9C97B8] flex-wrap">
        <Link to="/events" className="hover:text-[#F5F3FF] transition-colors">Events</Link>
        {isLoggedIn ? (
          <>
            <Link to="/wishlist" className="hover:text-[#F5F3FF] transition-colors">Wishlist</Link>
            <Link to="/my-bookings" className="hover:text-[#F5F3FF] transition-colors">My Bookings</Link>
            <Link to="/wallet" className="hover:text-[#F5F3FF] transition-colors">Wallet</Link>
            {isOrganizer ? (
              <Link to="/organizer/dashboard" className="hover:text-[#F5F3FF] transition-colors">
                Dashboard
              </Link>
            ) : (
              <Link to="/become-organizer" className="hover:text-[#F5F3FF] transition-colors">
                Become an Organizer
              </Link>
            )}
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                className="flex items-center gap-2 rounded-full border border-[#262636] bg-[#14141F] pl-1.5 pr-3 py-1.5 text-[#F5F3FF] hover:border-[#7C3AED]/70 transition-colors"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7C3AED] text-xs font-bold text-white">
                  {initials || '?'}
                </span>
                <span className="max-w-28 truncate">{userName}</span>
                <span className="text-[#9C97B8]" aria-hidden="true">⌄</span>
              </button>

              {profileOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-[#262636] bg-[#14141F] p-2 shadow-2xl"
                >
                  <div className="border-b border-[#262636] px-3 py-2">
                    <p className="truncate font-semibold text-[#F5F3FF]">{userName}</p>
                    <p className="truncate text-xs text-[#9C97B8]">{user?.email}</p>
                  </div>
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="mt-1 block rounded-lg px-3 py-2 text-[#F5F3FF] hover:bg-[#262636] transition-colors"
                  >
                    View profile
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="w-full rounded-lg px-3 py-2 text-left text-[#FF3D77] hover:bg-[#FF3D77]/10 transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-[#F5F3FF] transition-colors">Login</Link>
            <Link
              to="/register"
              className="font-semibold px-4 py-1.5 rounded-full bg-[#7C3AED] text-white hover:bg-[#6D2FE0] transition-colors"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
