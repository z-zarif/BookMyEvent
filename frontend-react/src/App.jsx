import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';

import Landing from './pages/Landing';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import EventDetails from './pages/EventDetails';
import Checkout from './pages/Checkout';
import MyBookings from './pages/MyBookings';
import BookingDetails from './pages/BookingDetails';
import Wallet from './pages/Wallet';
import Wishlist from './pages/Wishlist';
import BecomeOrganizer from './pages/BecomeOrganizer';
import OrganizerDashboard from './pages/OrganizerDashboard';
import CreateEvent from './pages/CreateEvent';

export default function App() {
  const location = useLocation();
  // Landing/Login/Register/BecomeOrganizer have their own minimal headers
  const hideNavbar = ['/', '/login', '/register', '/become-organizer'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/events" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/events/:id" element={<EventDetails />} />

        {/* Protected routes: redirect to /login if not authenticated */}
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
        <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetails /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />

        {/* Organizer routes */}
        <Route path="/become-organizer" element={<ProtectedRoute><BecomeOrganizer /></ProtectedRoute>} />
        <Route path="/organizer/dashboard" element={<ProtectedRoute><OrganizerDashboard /></ProtectedRoute>} />
        <Route path="/organizer/create-event" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />
      </Routes>
    </div>
  );
}
