import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isLoggedIn, logoutUser } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logoutUser();
    navigate('/login');
  }

  return (
    <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-200">
      <Link to="/events" className="font-bold text-lg text-indigo-600">Eventia</Link>
      <div className="flex items-center gap-5 text-sm">
        <Link to="/events" className="hover:text-indigo-600">Events</Link>
        {isLoggedIn ? (
          <>
            <Link to="/wishlist" className="hover:text-indigo-600">Wishlist</Link>
            <Link to="/my-bookings" className="hover:text-indigo-600">My Bookings</Link>
            <Link to="/wallet" className="hover:text-indigo-600">Wallet</Link>
            <button onClick={handleLogout} className="text-red-600 hover:underline">Logout</button>
          </>
        ) : (
          <>
            <Link to="/login" className="hover:text-indigo-600">Login</Link>
            <Link to="/register" className="hover:text-indigo-600">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
