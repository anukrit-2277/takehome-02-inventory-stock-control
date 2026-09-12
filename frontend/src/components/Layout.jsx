import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { Button } from './ui.jsx';
import { ErrorBoundary } from './ErrorBoundary.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/items', label: 'Items' },
  { to: '/movements', label: 'Movements' },
  { to: '/alerts', label: 'Low stock', badge: true },
  { to: '/data', label: 'Import / export' },
  { to: '/admin', label: 'Admin', managerOnly: true },
];

export function Layout() {
  const { user, logout, isManager } = useAuth();
  const location = useLocation();

  // The count badge goal 10 asks for, kept current by whichever screen changed it.
  const { count: alertCount } = useAlerts();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="text-sm font-semibold tracking-tight text-slate-900">
            Inventory &amp; Stock Control
          </span>

          <nav className="flex flex-1 flex-wrap gap-1">
            {NAV.filter((link) => !link.managerOnly || isManager).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                {link.label}
                {link.badge && alertCount > 0 && (
                  <span className="ml-2 inline-flex min-w-5 justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                    {alertCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-right sm:block">
              <span className="block font-medium text-slate-900">{user.name}</span>
              <span className="block text-xs text-slate-500">
                {user.role === 'MANAGER' ? 'Inventory manager' : 'Warehouse staff'}
              </span>
            </span>
            <Button variant="secondary" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {/* Keyed on the route so recovering from one page's error does not
            immediately re-throw when the user navigates elsewhere. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
