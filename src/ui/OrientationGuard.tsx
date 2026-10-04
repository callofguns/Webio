import { useEffect, useSyncExternalStore } from 'react';
import { Logo } from './components/Logo';

// Phones play in portrait, tablets in landscape. Browsers can't always lock
// the screen, so when a touch device is turned the wrong way we cover the
// game with a "please turn your device" screen instead of showing a squashed,
// half-broken layout. Computers (mouse and keyboard) are never blocked.

type Needed = 'portrait' | 'landscape';

/** Is the screen currently taller than it is wide? */
function isPortrait(): boolean {
  const type = screen.orientation?.type;
  if (type) return type.startsWith('portrait');
  const legacy = (window as unknown as { orientation?: number }).orientation;
  if (typeof legacy === 'number') return legacy === 0 || Math.abs(legacy) === 180;
  return window.matchMedia('(orientation: portrait)').matches;
}

/** Which way this device must be held, or null if it can go either way. */
function neededOrientation(): Needed | null {
  const touch = window.matchMedia('(pointer: coarse)').matches;
  if (!touch) return null;
  // The short side of the screen is the same whichever way it's turned.
  const phone = Math.min(screen.width, screen.height) < 600;
  return phone ? 'portrait' : 'landscape';
}

/** 'portrait' or 'landscape' when the device is turned the wrong way, otherwise ''. */
function wrongWay(): string {
  const needed = neededOrientation();
  if (!needed) return '';
  return (needed === 'portrait') === isPortrait() ? '' : needed;
}

function subscribe(cb: () => void) {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  screen.orientation?.addEventListener?.('change', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
    screen.orientation?.removeEventListener?.('change', cb);
  };
}

export function OrientationGuard() {
  const needed = useSyncExternalStore(subscribe, wrongWay, () => '') as Needed | '';

  // Where the browser allows it (an installed app on Android), really lock it.
  useEffect(() => {
    const want = neededOrientation();
    if (!want) return;
    try {
      void (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.(want)?.catch(() => {});
    } catch {
      /* Not allowed here. The cover screen handles it. */
    }
  }, []);

  if (!needed) return null;
  const phone = needed === 'portrait';
  return (
    <div className="rotate-screen" role="alert">
      <div className="rotate-art" aria-hidden>
        <div className={`rotate-device ${phone ? 'phone' : 'tablet'}`}>
          <Logo size={28} />
        </div>
      </div>
      <h2>Webio plays in {needed}</h2>
      <p className="muted">Turn your {phone ? 'phone upright' : 'tablet sideways'} to keep playing. Your game is safe.</p>
    </div>
  );
}
