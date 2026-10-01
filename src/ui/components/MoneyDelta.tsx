import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { money } from './AnimatedNumber';

/** Little "+$700" / "-$42" chips that float up whenever the balance changes. */
export function MoneyDelta({ value }: { value: number }) {
  const prev = useRef(value);
  const [chips, setChips] = useState<{ id: number; amount: number }[]>([]);

  useEffect(() => {
    const amount = value - prev.current;
    prev.current = value;
    if (!amount) return;
    const id = Date.now() + Math.random();
    setChips((c) => [...c.slice(-2), { id, amount }]);
    const t = setTimeout(() => setChips((c) => c.filter((x) => x.id !== id)), 1600);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <AnimatePresence>
      {chips.map((c) => (
        <motion.span
          key={c.id}
          className={`money-delta ${c.amount > 0 ? 'up' : 'down'}`}
          initial={{ opacity: 0, x: 14, scale: 0.6, rotate: -6 }}
          animate={{ opacity: 1, x: 0, scale: 1, rotate: -2 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        >
          {c.amount > 0 ? '+' : '−'}
          {money(Math.abs(c.amount))}
        </motion.span>
      ))}
    </AnimatePresence>
  );
}
