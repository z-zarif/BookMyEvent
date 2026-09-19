import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function ProtectedRoute({ children }) {
  const { isLoggedIn } = useAdminAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return children;
}
