import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keeps list state in the URL rather than component state.
 *
 * That way a filtered, sorted, paged view can be bookmarked or pasted to a
 * colleague, survives a reload, and the back button steps through it.
 */
export function useQueryParams(defaults) {
  const [params, setParams] = useSearchParams();

  const values = useMemo(() => {
    const current = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = params.get(key);
      if (value !== null) current[key] = value;
    }
    return current;
  }, [params, defaults]);

  /**
   * `replace` avoids filling the back button with a history entry per
   * keystroke while someone is typing in the search box.
   */
  const update = useCallback(
    (changes, { replace = false } = {}) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(changes)) {
        // A value equal to its default is left out, so URLs stay short.
        if (value === '' || value === null || value === undefined || value === defaults[key]) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      setParams(next, { replace });
    },
    [params, setParams, defaults],
  );

  return { values, update, key: params.toString() };
}
