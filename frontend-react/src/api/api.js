import axios from 'axios';

// Change this if your backend runs on a different port.
const BASE_URL = 'http://localhost:5000';

const client = axios.create({ baseURL: BASE_URL });

// Attach JWT to every request automatically, if present.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Unwrap axios errors into a plain message string so components can just do err.message
client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

// ---- Auth ----
// Backend returns { token, user: { user_id, user_name, email } } - nested, not flat.
export const register = (userName, email, password, gender) =>
  client.post('/auth/register/user', { userName, email, password, gender });

export const login = (email, password) =>
  client.post('/auth/login/user', { email, password });

// ---- Events ----
export const getEvents = () => client.get('/events/getevents');
export const getEvent = (id) => client.get(`/events/${id}`);

// Expects { title, date_time, venue, description, ticketTypes: [{category, quantity, price}] }
export const createEvent = (payload) => client.post('/events/postevent', payload);
export const cancelEvent = (eventId) => client.post(`/events/${eventId}/cancel`);

// ---- Organizers ----
export const registerOrganizer = (companyName, bio) =>
  client.post('/organizers/register', { companyName, bio });
export const getMyOrganizerProfile = () => client.get('/organizers/me');
export const getMyOrganizerEvents = () => client.get('/organizers/my-events');

// ---- Bookings ----
// Booking body is { typeId, qty, promoCode } - promoCode is optional and must
// be left out entirely (not empty string) when the user didn't enter one.
export const createBooking = (payload) => client.post('/bookings', payload);
export const getMyBookings = () => client.get('/bookings/mine');
export const getBooking = (id) => client.get(`/bookings/${id}`);
export const cancelBooking = (bookingId) => client.post(`/bookings/${bookingId}/cancel`);

// ---- Wallet ----
export const getWallet = () => client.get('/wallet');
export const requestAddMoney = (amount) => client.post('/wallet/add-money', { amount });
export const getMyAddMoneyRequests = () => client.get('/wallet/add-money/mine');

// ---- Wishlist ----
export const getWishlist = () => client.get('/wishlist');
export const addToWishlist = (eventId) => client.post('/wishlist', { eventId });
export const removeFromWishlist = (eventId) => client.delete(`/wishlist/${eventId}`);

// ---- Admin ----
// Admin access is controlled by the ADMIN_EMAILS list in the server's .env.
// checkAdmin() succeeding means the logged-in user is an admin.
export const checkAdmin = () => client.get('/admin/me');
export const getAdminStats = () => client.get('/admin/stats');
export const getAddMoneyRequests = (status) =>
  client.get('/admin/add-money-requests', { params: status ? { status } : {} });
export const approveAddMoneyRequest = (id) =>
  client.post(`/admin/add-money-requests/${id}/approve`);
export const rejectAddMoneyRequest = (id) =>
  client.post(`/admin/add-money-requests/${id}/reject`);
export const getAdminWallets = () => client.get('/admin/wallets');
export const getAdminTransactions = () => client.get('/admin/transactions');
export const getAuditLog = () => client.get('/admin/audit-log');

export default client;
