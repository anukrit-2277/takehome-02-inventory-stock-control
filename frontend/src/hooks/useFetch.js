import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data from the API and re-loads it when its inputs change.
 *
 * `deps` works like a useEffect dependency array: when any value in it changes,
 * the request runs again. `reload` re-runs it on demand, which is what screens
 * call after a mutation so the list reflects the change.
 */
export function useFetch(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    // Guards against a slow earlier request overwriting a newer result when
    // the user types quickly or changes pages.
    let current = true;

    setLoading(true);
    loader()
      .then((result) => current && (setData(result), setError(null)))
      .catch((err) => current && setError(err))
      .finally(() => current && setLoading(false));

    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  return { data, error, loading, reload };
}
