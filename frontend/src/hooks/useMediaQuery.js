import { useEffect, useState } from 'react';

/**
 * Tracks a CSS media query from JavaScript.
 *
 * Needed where a breakpoint changes behaviour rather than just styling — the
 * sidebar's collapsed rail only applies on desktop, because on a phone the
 * sidebar is a drawer and a 68px rail would make no sense.
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event) => setMatches(event.matches);

    setMatches(list.matches); // in case it changed between render and effect
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
