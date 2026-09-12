import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAccessToken, onSessionEnd } from '../api/client.js';
import { auth } from '../api/endpoints.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // Starts true because on a page refresh we do not yet know whether the
  // browser still holds a valid refresh cookie.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    onSessionEnd(() => setUser(null));

    // The access token only lived in memory, so a reload has none. Asking for
    // the current user triggers the client's refresh-and-retry, which revives
    // the session if the cookie is still good.
    auth
      .me()
      .then(({ user: current }) => setUser(current))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

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
    () => ({ user, loading, login, logout, isManager: user?.role === 'MANAGER' }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
