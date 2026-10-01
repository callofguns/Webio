import { useEffect, useRef } from 'react';

/**
 * Lets the number keys 1-9 pick answers (handy with the call timer).
 * Ignored while typing in a box or when a popup is open.
 */
export function useNumberKeys(count: number, onPick: (index: number) => void, enabled: boolean) {
  const pick = useRef(onPick);
  pick.current = onPick;

  useEffect(() => {
    if (!enabled || count === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('.overlay')) return;
      const n = Number(e.key);
      if (!Number.isInteger(n) || n < 1 || n > count) return;
      e.preventDefault();
      pick.current(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [count, enabled]);
}
