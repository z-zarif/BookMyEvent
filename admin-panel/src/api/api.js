import axios from 'axios';

// Same backend server as the customer app - different endpoints, different auth.
const BASE_URL = 'http://localhost:5000';

const client = axios.create({ baseURL: BASE_URL });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('adminToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const message = err.response?.data?.error || err.message || 'Request failed';
    return Promise.reject(new Error(message));
  }
);

// ---- Auth ----
// Password-only login, no customer account involved at all.
export const adminLogin = (password) => client.post('/admin-auth/login', { password });

// ---- Data ----
export const getStats = () => client.get('/admin/stats');
export const getAddMoneyRequests = (status) =>
  client.get('/admin/add-money-requests', { params: status ? { status } : {} });
export const approveAddMoneyRequest = (id) =>
  client.post(`/admin/add-money-requests/${id}/approve`);
export const rejectAddMoneyRequest = (id) =>
  client.post(`/admin/add-money-requests/${id}/reject`);
export const getWallets = () => client.get('/admin/wallets');
export const getTransactions = () => client.get('/admin/transactions');
export const getAuditLog = () => client.get('/admin/audit-log');

export default client;
