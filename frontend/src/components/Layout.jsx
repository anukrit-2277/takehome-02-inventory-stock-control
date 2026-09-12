import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../context/AuthContext.jsx';
import { useAlerts } from '../context/AlertsContext.jsx';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import { ErrorBoundary } from './ErrorBoundary.jsx';
import {
  IconAlert, IconChevronLeft, IconChevronRight, IconClose, IconDashboard, IconLogout,
  IconMenu, IconMovements, IconPackage, IconSettings, IconTransfer,
} from './Icons.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: IconDashboard },
  { to: '/items', label: 'Items', icon: IconPackage },
  { to: '/movements', label: 'Movements', icon: IconMovements },
  { to: '/alerts', label: 'Low stock', icon: IconAlert, badge: true },
  { to: '/data', label: 'Import / export', icon: IconTransfer },
  { to: '/admin', label: 'Admin', icon: IconSettings, managerOnly: true },
];

const COLLAPSE_KEY = 'sidebar-collapsed';

export function Layout() {
  const { user, logout, isManager } = useAuth();
  const { count: alertCount } = useAlerts();
  const location = useLocation();

  // Below lg the sidebar is a drawer over the content; at lg and up it is a
  // column beside it, which is the only place the collapsed rail makes sense.
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === 'true'; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, String(collapsed)); } catch { /* private mode */ }
  }, [collapsed]);

  // Tapping a link should take you there, not leave the drawer covering it.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event) => event.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const rail = collapsed && isDesktop;
  const links = NAV.filter((link) => !link.managerOnly || isManager);

  return (
    <div className="flex h-full bg-slate-100">
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-60 shrink-0 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-out lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:transition-[width] ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        } ${rail ? 'lg:w-[68px]' : 'lg:w-60'}`}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-[11px] font-bold text-white shadow-sm">
            IS
          </span>
          {!rail && (
            <span className="truncate text-[13px] font-semibold tracking-tight text-slate-900">
              Inventory Control
            </span>
          )}
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="ml-auto rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              title={rail ? link.label : undefined}
              className={({ isActive }) =>
                `group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Active rail: a 3px mark reads instantly when collapsed. */}
                  <span
                    className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity ${
                      isActive ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                  <link.icon className={`h-[18px] w-[18px] shrink-0 ${isActive ? 'text-brand-600' : ''}`} />
                  {!rail && <span className="truncate">{link.label}</span>}

                  {link.badge && alertCount > 0 && (
                    <span
                      className={
                        rail
                          ? 'absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white'
                          : 'ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-50 px-1.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 tnum'
                      }
                    >
                      {!rail && alertCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-2.5">
          <div className={`flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 ${rail ? 'justify-center' : ''}`}>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-semibold text-white">
              {user.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}
            </span>
            {!rail && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-slate-900">{user.name}</span>
                <span className="block truncate text-[11px] text-slate-500">
                  {user.role === 'MANAGER' ? 'Inventory manager' : 'Warehouse staff'}
                </span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className={`mt-1 flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 ${
              rail ? 'justify-center px-0' : ''
            }`}
          >
            <IconLogout className="h-[18px] w-[18px] shrink-0" />
            {!rail && 'Sign out'}
          </button>

          {/* The rail only exists on desktop, so neither does its toggle. */}
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`mt-1 hidden h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 lg:flex ${
              rail ? 'justify-center px-0' : ''
            }`}
          >
            {rail ? <IconChevronRight className="h-[18px] w-[18px]" /> : <IconChevronLeft className="h-[18px] w-[18px]" />}
            {!rail && 'Collapse'}
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone and tablet get a bar to open the drawer from. */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white/95 px-3 backdrop-blur lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100"
          >
            <IconMenu className="h-5 w-5" />
          </button>
          <span className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-600 text-[10px] font-bold text-white">
              IS
            </span>
            <span className="text-[13px] font-semibold tracking-tight text-slate-900">Inventory</span>
          </span>
          {alertCount > 0 && (
            <NavLink
              to="/alerts"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200"
            >
              <IconAlert className="h-3.5 w-3.5" />
              <span className="tnum">{alertCount}</span>
            </NavLink>
          )}
        </header>

        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-[1600px] px-4 py-4 sm:px-5 sm:py-5 lg:px-7">
            {/* Keyed on the route so recovering from one page's error does not
                immediately re-throw when the user navigates elsewhere. */}
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

/** The heading every page opens with, so they all line up. */
export function PageHeader({ title, description, children }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[17px] font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
