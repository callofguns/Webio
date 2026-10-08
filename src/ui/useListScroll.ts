import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * For screens that swap a list for a detail page (a chat, a business, a project).
 * Remembers how far down the list was scrolled, and puts you back there when you
 * come back from the detail page. The detail page itself starts at the top.
 */
export function useListScroll(detailOpen: boolean) {
  const last = useRef(0);
  const open = useRef(detailOpen);
  const wasOpen = useRef(detailOpen);
  open.current = detailOpen;

  // While the list is showing, keep track of where it's scrolled to.
  useEffect(() => {
    const main = document.querySelector<HTMLElement>('.main');
    if (!main) return;
    const onScroll = () => {
      if (!open.current) last.current = main.scrollTop;
    };
    main.addEventListener('scroll', onScroll, { passive: true });
    return () => main.removeEventListener('scroll', onScroll);
  }, []);

  useLayoutEffect(() => {
    if (wasOpen.current === detailOpen) return;
    wasOpen.current = detailOpen;
    const main = document.querySelector<HTMLElement>('.main');
    if (!main) return;
    if (detailOpen) {
      main.scrollTo({ top: 0 });
      return;
    }
    // Back on the list. It may take a moment for the list to be tall enough again
    // (screens fade in and out), so keep trying for a little while.
    const target = last.current;
    const until = performance.now() + 700;
    let frame = 0;
    const restore = () => {
      main.scrollTop = target;
      if (Math.abs(main.scrollTop - target) > 1 && performance.now() < until) frame = requestAnimationFrame(restore);
    };
    restore();
    return () => cancelAnimationFrame(frame);
  }, [detailOpen]);
}
