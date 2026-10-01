import { useMemo, type ReactNode } from 'react';
import { motion } from 'motion/react';

const COLORS = ['var(--c-phone)', 'var(--c-texts)', 'var(--c-projects)', 'var(--c-team)', 'var(--c-skills)', 'var(--hi)'];

/** A little burst of colored confetti behind something worth celebrating. */
export function Burst({ children }: { children: ReactNode }) {
  const dots = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const angle = (i / 12) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 34 + Math.random() * 26;
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist * 0.7, color: COLORS[i % COLORS.length], rotate: Math.random() * 270 };
      }),
    [],
  );
  return (
    <span className="burst">
      {dots.map((d, i) => (
        <motion.i
          key={i}
          className="burst-dot"
          style={{ background: d.color, marginLeft: -3.5, marginTop: -3.5 }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: d.x, y: d.y, scale: [0, 1.1, 0.7], opacity: [1, 1, 0], rotate: d.rotate }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ))}
      {children}
    </span>
  );
}

/** Drops something in like a rubber stamp. */
export const stamp = {
  initial: { scale: 1.7, rotate: -14, opacity: 0 },
  animate: { scale: 1, rotate: -2, opacity: 1 },
  transition: { type: 'spring' as const, stiffness: 520, damping: 17 },
};
