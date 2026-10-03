import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls } from 'motion/react';
import { spring } from '../motion';
import { useIsMobile } from '../useIsMobile';

interface Props {
  open: boolean;
  wide?: boolean;
  /** Called when the player taps outside, presses Escape, or drags the sheet down. */
  onClose?: () => void;
  children: ReactNode;
}

/**
 * A popup. On phones it slides up from the bottom as a sheet that you can
 * drag down (by its handle) to close.
 */
export function Modal({ open, wide, onClose, children }: Props) {
  const mobile = useIsMobile();
  const controls = useDragControls();
  // The popup is drawn straight into <body> so no screen, scroll area or tab
  // bar can cover it. It borrows the colour of the section it was opened from.
  const anchor = useRef<HTMLSpanElement>(null);
  const [section, setSection] = useState<string | undefined>();
  useEffect(() => {
    if (open) setSection(anchor.current?.closest<HTMLElement>('[data-section]')?.dataset.section);
  }, [open]);
  const from = mobile ? { opacity: 1, y: '100%' } : { opacity: 0, scale: 0.94, y: 12 };
  const to = mobile ? { opacity: 1, y: 0 } : { opacity: 1, scale: 1, y: 0 };
  const exit = mobile ? { opacity: 1, y: '100%' } : { opacity: 0, scale: 0.96 };

  // Escape closes the popup on a keyboard.
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const popup = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="overlay"
          data-section={section}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          // Only a press on the dark area itself counts, not one that starts inside the popup.
          onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}
        >
          <motion.div
            className={`modal ${wide ? 'wide' : ''}`}
            role="dialog"
            aria-modal
            initial={from}
            animate={to}
            exit={exit}
            transition={spring}
            drag={mobile && onClose ? 'y' : false}
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.7 }}
            dragSnapToOrigin
            onDragEnd={(_, info) => {
              if (info.offset.y > 90 || info.velocity.y > 500) onClose?.();
            }}
          >
            {mobile && (
              <div className="sheet-grab" onPointerDown={(e) => onClose && controls.start(e)} aria-hidden>
                <div className="sheet-handle" />
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <span ref={anchor} hidden />
      {createPortal(popup, document.body)}
    </>
  );
}
