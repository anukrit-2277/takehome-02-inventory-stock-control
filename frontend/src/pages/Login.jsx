import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { Button, Card, ErrorMessage, Field, Input } from '../components/ui.jsx';
import { FullPageSpinner, Spinner } from '../components/Spinner.jsx';

// Shown on the sign-in screen so a reviewer can get in without hunting for
// credentials. Remove these for anything other than a demo deployment.
const DEMO_ACCOUNTS = [
  { label: 'Manager', email: 'manager@demo.test', detail: 'Full access' },
  { label: 'Staff', email: 'staff@demo.test', detail: 'Two locations' },
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
    <div className="flex min-h-full items-center justify-center bg-slate-100 px-4 py-12">
      {/* A faint grid behind the card, so the page reads as a product surface
          rather than an empty field. */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.55]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgb(148 163 184 / 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgb(148 163 184 / 0.12) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(ellipse 70% 55% at 50% 45%, black, transparent)',
        }}
      />

      <div className="relative w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-[13px] font-bold text-white shadow-lg shadow-brand-600/25">
            IS
          </span>
          <h1 className="mt-3 text-[17px] font-semibold tracking-tight text-slate-900">
            Inventory &amp; Stock Control
          </h1>
          <p className="mt-0.5 text-[13px] text-slate-500">Sign in to continue</p>
        </div>

        <Card className="p-6 shadow-lg shadow-slate-900/[0.06]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                placeholder="you@company.com"
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
                placeholder="••••••••"
                required
              />
            </Field>

            <ErrorMessage error={error} />

            <Button type="submit" className="h-10 w-full" disabled={submitting}>
              {submitting && <Spinner className="h-4 w-4 border-white/40 border-t-white" />}
              Sign in
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-200/80 pt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              Demo accounts
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => useDemoAccount(account.email)}
                  className="rounded-lg bg-slate-50 px-3 py-2 text-left ring-1 ring-inset ring-slate-200 transition hover:bg-white hover:ring-slate-300"
                >
                  <span className="block text-[13px] font-medium text-slate-900">{account.label}</span>
                  <span className="block text-[11px] text-slate-500">{account.detail}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Password for both: Passw0rd!</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
