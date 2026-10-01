import { useEffect, useRef, useState } from 'react';
import { motion, useMotionValue } from 'motion/react';

/**
 * A bar that drains over `seconds`, then calls onExpire. It pauses while the
 * game is in a background tab, so switching apps doesn't cost you the call.
 */
export function AnswerTimer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const progress = useMotionValue(1);
  const [left, setLeft] = useState(seconds);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    let remaining = seconds;
    let last = performance.now();
    let raf = 0;
    let fired = false;
    const tick = (now: number) => {
      // Cap each step so coming back to the tab doesn't jump the timer.
      const step = Math.min((now - last) / 1000, 0.25);
      last = now;
      if (document.visibilityState === 'visible') remaining -= step;
      progress.set(Math.max(0, remaining / seconds));
      setLeft(Math.max(0, Math.ceil(remaining)));
      if (remaining <= 0) {
        if (!fired) {
          fired = true;
          expire.current();
        }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seconds, progress]);

  const tone = left <= 5 ? 'bad' : left <= 10 ? 'warn' : '';
  return (
    <div className={`answer-timer ${tone}`} role="timer" aria-label={`${left} seconds to answer`}>
      <div className="answer-timer-bar">
        <motion.div style={{ scaleX: progress }} />
      </div>
      <span className="num">{left}s</span>
    </div>
  );
}
