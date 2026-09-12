import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { FullPageSpinner } from './Spinner.jsx';

/**
 * Gates a route behind a signed-in user, and optionally a role.
 *
 * This is convenience, not security: every rule it expresses is enforced again
 * on the server, which is what actually decides.
 */
export function RequireAuth({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
