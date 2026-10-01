import { useSyncExternalStore } from 'react';

/** Phone-sized screens get a different layout (list first, then a detail page). */
export const MOBILE_QUERY = '(max-width: 900px)';

function subscribe(cb: () => void) {
  const mq = window.matchMedia(MOBILE_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(MOBILE_QUERY).matches, () => false);
}
