import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { alerts } from '../api/endpoints.js';

/**
 * The low-stock count behind the nav badge.
 *
 * It lives here rather than in the Layout because several screens change it:
 * dismissing an alert, recording a movement, importing receipts, creating an
 * item. Each calls refresh() so the badge cannot sit there stale until the next
 * full page load.
 */
const AlertsContext = createContext({ count: 0, refresh: () => {} });

export function AlertsProvider({ children }) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      // pageSize 1 because only the total is wanted.
      const { total } = await alerts.lowStock({ pageSize: 1 });
      setCount(total);
    } catch {
      // Signed out or offline. Leaving the last known number is better than
      // blanking the badge over one failed request.
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const value = useMemo(() => ({ count, refresh }), [count, refresh]);
  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>;
}

export const useAlerts = () => useContext(AlertsContext);
