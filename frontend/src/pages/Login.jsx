import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorMessage, Field, Input } from '../components/ui.jsx';
import { FullPageSpinner, Spinner } from '../components/Spinner.jsx';

// Shown on the sign-in screen so a reviewer can get in without hunting for
// credentials. Remove these for anything other than a demo deployment.
const DEMO_ACCOUNTS = [
  { label: 'Manager', email: 'manager@demo.test' },
  { label: 'Staff', email: 'staff@demo.test' },
];

export function Login() {
  const { user, loading, login } = useAuth();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (user) return <Navigate to={location.state?.from?.pathname ?? '/'} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function useDemoAccount(demoEmail) {
    setEmail(demoEmail);
    setPassword('Passw0rd!');
  }

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-xl font-semibold tracking-tight text-slate-900">
          Inventory &amp; Stock Control
        </h1>
        <p className="mt-1 text-center text-sm text-slate-500">Sign in to continue</p>

        <Card className="mt-6 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
                autoFocus
              />
            </Field>

            <Field label="Password">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </Field>

            <ErrorMessage error={error} />

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Spinner className="h-4 w-4 border-white/40 border-t-white" />}
              Sign in
            </Button>
          </form>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="text-xs text-slate-500">Demo accounts (password Passw0rd!)</p>
            <div className="mt-2 flex gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <Button
                  key={account.email}
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => useDemoAccount(account.email)}
                >
                  {account.label}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
