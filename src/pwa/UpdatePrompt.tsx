import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/components/Button';
import { spring } from '../ui/motion';

/** Small toast for "ready to play offline" and "new version available". */
export function UpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Check for a new version every hour while the game is open...
      setInterval(() => registration.update(), 60 * 60 * 1000);
      // ...and whenever you come back to it. Phones keep the app asleep in the
      // background, so a timer alone would rarely notice an update.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update().catch(() => {});
      });
    },
  });

  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  return (
    <AnimatePresence>
      {(offlineReady || needRefresh) && (
        <motion.div
          className={`toast ${needRefresh ? 'update' : ''}`}
          role="status"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={spring}
        >
          <span>{needRefresh ? 'A new version of Webio is ready.' : 'Webio can now be played offline.'}</span>
          {needRefresh ? (
            <div className="row">
              <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
                Later
              </Button>
              {/* Your game is saved automatically, so reloading is safe. */}
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  void updateServiceWorker(true);
                  // If the browser had nothing to hand over, a plain reload still picks up the new files.
                  setTimeout(() => window.location.reload(), 2500);
                }}
              >
                Reload
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setOfflineReady(false)}>
              OK
            </Button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
