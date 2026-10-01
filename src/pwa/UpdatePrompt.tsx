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
      // Check for a new version every hour while the game is open.
      if (registration) setInterval(() => registration.update(), 60 * 60 * 1000);
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
          className="toast"
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
              <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
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
