import { useEffect, useState } from 'react';
import { animate } from 'motion/react';

/** A number that smoothly counts up or down when it changes. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString() }: { value: number; format?: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const controls = animate(shown, value, { type: 'spring', stiffness: 120, damping: 22, onUpdate: setShown });
    return () => controls.stop();
  }, [value]);
  return <span className="num">{format(shown)}</span>;
}

export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;
