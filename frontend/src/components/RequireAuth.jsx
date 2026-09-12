import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { FullPageSpinner } from './Spinner.jsx';
import { Button, Card } from './ui.jsx';

/**
 * Gates a route behind a signed-in user, and optionally a role.
 *
 * This is convenience, not security: every rule it expresses is enforced again
 * on the server, which is what actually decides.
 */
export function RequireAuth({ role, children }) {
  const { user, loading, unreachable, retry } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  // Being unable to reach the server is not the same as being signed out, so
  // do not send the user to a login screen they cannot use anyway.
  if (unreachable) {
    return (
      <div className="flex min-h-full items-center justify-center px-4 py-16">
        <Card className="max-w-sm p-6 text-center">
          <h1 className="text-base font-semibold text-slate-900">Cannot reach the server</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your session has not ended. The application could not be contacted — it may still be
            starting up.
          </p>
          <Button className="mt-4" onClick={retry}>Try again</Button>
        </Card>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
