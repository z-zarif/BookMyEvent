import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/AdminLayout';

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

import AdminOverview from './pages/admin/AdminOverview';
import AdminRequests from './pages/admin/AdminRequests';
import AdminWallets from './pages/admin/AdminWallets';
import AdminAuditLog from './pages/admin/AdminAuditLog';

export default function App() {
  const location = useLocation();

  // Pages with their own self-contained header, plus the whole admin console
  // (which has its own sidebar), skip the customer navbar.
  const hideNavbar =
    ['/', '/login', '/register', '/become-organizer'].includes(location.pathname) ||
    location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-[#0B0B14]">
      {!hideNavbar && <Navbar />}
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/events" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/events/:id" element={<EventDetails />} />

        {/* Requires login */}
        <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
        <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
        <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetails /></ProtectedRoute>} />
        <Route path="/wallet" element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
        <Route path="/wishlist" element={<ProtectedRoute><Wishlist /></ProtectedRoute>} />

        {/* Organizer */}
        <Route path="/become-organizer" element={<ProtectedRoute><BecomeOrganizer /></ProtectedRoute>} />
        <Route path="/organizer/dashboard" element={<ProtectedRoute><OrganizerDashboard /></ProtectedRoute>} />
        <Route path="/organizer/create-event" element={<ProtectedRoute><CreateEvent /></ProtectedRoute>} />

        {/* Admin console - AdminLayout verifies admin status with the server */}
        <Route path="/admin" element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
          <Route index element={<AdminOverview />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="wallets" element={<AdminWallets />} />
          <Route path="audit-log" element={<AdminAuditLog />} />
        </Route>
      </Routes>
    </div>
  );
}
