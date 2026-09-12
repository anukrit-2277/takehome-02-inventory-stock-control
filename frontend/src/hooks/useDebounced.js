import { useEffect, useState } from 'react';

/**
 * Delays a fast-changing value, so typing in a search box sends one request
 * when the user pauses rather than one per keystroke.
 */
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
