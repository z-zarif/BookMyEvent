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
export const register = (userName, email, password, gender) =>
  client.post('/auth/register', { userName, email, password, gender });

export const login = (email, password) =>
  client.post('/auth/login', { email, password });

// ---- Events ----
export const getEvents = () => client.get('/events');
export const getEvent = (id) => client.get(`/events/${id}`);
export const createEvent = (payload) => client.post('/events', payload);

// ---- Bookings ----
export const createBooking = (payload) => client.post('/bookings', payload);
export const getMyBookings = () => client.get('/bookings/mine');
export const getBooking = (id) => client.get(`/bookings/${id}`);

// ---- Wallet ----
export const getWallet = () => client.get('/wallet');
export const requestAddMoney = (amount) => client.post('/wallet/add-money', { amount });
export const getMyAddMoneyRequests = () => client.get('/wallet/add-money/mine');

// ---- Wishlist ----
export const getWishlist = () => client.get('/wishlist');
export const addToWishlist = (eventId) => client.post('/wishlist', { eventId });
export const removeFromWishlist = (eventId) => client.delete(`/wishlist/${eventId}`);

export default client;
