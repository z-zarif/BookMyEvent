import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Requests from './pages/Requests';
import Wallets from './pages/Wallets';
import AuditLog from './pages/AuditLog';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Overview />} />
        <Route path="requests" element={<Requests />} />
        <Route path="wallets" element={<Wallets />} />
        <Route path="audit-log" element={<AuditLog />} />
      </Route>
    </Routes>
  );
}
