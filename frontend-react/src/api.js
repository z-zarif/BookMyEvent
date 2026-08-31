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
// Backend route is /events/getevents, not /events. Returns organizer's
// user_name alongside each event now (no ticket_type/price data in this list).
export const getEvents = () => client.get('/events/getevents');

// NOTE: backend has no GET /events/:id route yet. This will 404 until your
// friend adds one. Keeping this here so EventDetails.jsx just works once it exists.
export const getEvent = (id) => client.get(`/events/${id}`);

// Backend route is /events/postevent, and now expects ticketTypes as an
// array in the same request: { title, date_time, venue, description, ticketTypes: [{category, quantity, price}] }
export const createEvent = (payload) => client.post('/events/postevent', payload);

// ---- Bookings (backend routes don't exist yet - these will 404 until built) ----
export const createBooking = (payload) => client.post('/bookings', payload);
export const getMyBookings = () => client.get('/bookings/mine');
export const getBooking = (id) => client.get(`/bookings/${id}`);

// ---- Wallet (backend routes don't exist yet - these will 404 until built) ----
export const getWallet = () => client.get('/wallet');
export const requestAddMoney = (amount) => client.post('/wallet/add-money', { amount });
export const getMyAddMoneyRequests = () => client.get('/wallet/add-money/mine');

// ---- Wishlist (backend routes don't exist yet - these will 404 until built) ----
export const getWishlist = () => client.get('/wishlist');
export const addToWishlist = (eventId) => client.post('/wishlist', { eventId });
export const removeFromWishlist = (eventId) => client.delete(`/wishlist/${eventId}`);

export default client;
