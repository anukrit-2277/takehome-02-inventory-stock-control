import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAccessToken, onSessionEnd } from '../api/client.js';
import { auth } from '../api/endpoints.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Starts true because on a page refresh we do not yet know whether the
  // browser still holds a valid refresh cookie.
  const [loading, setLoading] = useState(true);
  // Set only when the API could not be reached at all, which is a different
  // thing from being signed out and should not be reported as one.
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setLoading(true);
    setUnreachable(false);
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    onSessionEnd(() => setUser(null));

    // The access token only lived in memory, so a reload has none. Asking for
    // the current user triggers the client's refresh-and-retry, which revives
    // the session if the cookie is still good.
    auth
      .me()
      .then(({ user: current }) => {
        setUser(current);
        setUnreachable(false);
      })
      .catch((error) => {
        setUser(null);
        // status 0 is the client's marker for "the request never arrived".
        setUnreachable(error?.status === 0);
      })
      .finally(() => setLoading(false));
  }, [attempt]);

  const login = useCallback(async (email, password) => {
    const { user: current, accessToken } = await auth.login(email, password);
    setAccessToken(accessToken);
    setUser(current);
    return current;
  }, []);

  const logout = useCallback(async () => {
    try {
      await auth.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, unreachable, retry, login, logout, isManager: user?.role === 'MANAGER' }),
    [user, loading, unreachable, retry, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
