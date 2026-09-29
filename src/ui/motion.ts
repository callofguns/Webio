// Shared spring settings so every animation in the game feels the same.
import type { Transition } from 'motion/react';

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 34, mass: 0.8 };
export const softSpring: Transition = { type: 'spring', stiffness: 260, damping: 30 };
export const tap = { scale: 0.97 };

export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: spring,
};
