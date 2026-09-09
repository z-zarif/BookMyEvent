import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isLoggedIn, isOrganizer, logoutUser } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logoutUser();
    navigate('/login');
  }

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-[#0B0B14] border-b border-[#262636]">
      <Link to="/events" className="font-['Anton'] text-xl tracking-tight text-[#F5F3FF]">
        EVENTIA
      </Link>
      <div className="flex items-center gap-6 text-sm font-['Manrope'] text-[#9C97B8]">
        <Link to="/events" className="hover:text-[#F5F3FF] transition-colors">Events</Link>
        {isLoggedIn ? (
          <>
            <Link to="/wishlist" className="hover:text-[#F5F3FF] transition-colors">Wishlist</Link>
            <Link to="/my-bookings" className="hover:text-[#F5F3FF] transition-colors">My Bookings</Link>
            <Link to="/wallet" className="hover:text-[#F5F3FF] transition-colors">Wallet</Link>
            {isOrganizer ? (
              <Link to="/organizer/dashboard" className="hover:text-[#F5F3FF] transition-colors">Dashboard</Link>
            ) : (
              <Link to="/become-organizer" className="hover:text-[#F5F3FF] transition-colors">Become an Organizer</Link>
            )}
            <button onClick={handleLogout} className="text-[#FF3D77] hover:text-[#FF3D77]/80 transition-colors">
              Logout
            </button>
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
