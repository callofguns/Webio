import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { spring } from '../motion';
import { useIsMobile } from '../useIsMobile';

/** A popup. On phones it slides up from the bottom as a sheet. */
export function Modal({ open, wide, children }: { open: boolean; wide?: boolean; children: ReactNode }) {
  const mobile = useIsMobile();
  const from = mobile ? { opacity: 1, y: '100%' } : { opacity: 0, scale: 0.94, y: 12 };
  const to = mobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 };
  const exit = mobile ? { opacity: 1, y: '100%' } : { opacity: 0, scale: 0.96 };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal initial={from} animate={to} exit={exit} transition={spring}>
            {mobile && <div className="sheet-handle" aria-hidden />}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
