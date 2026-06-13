import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Gate for authenticated-only routes — redirects to /login when not signed in. */
export default function ProtectedRoute() {
  const { status } = useAuth();
  if (status !== 'authenticated') {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
