import type { CSSProperties } from 'react';

const HUES = ['var(--c-phone)', 'var(--c-texts)', 'var(--c-projects)', 'var(--c-team)', 'var(--c-office)', 'var(--c-skills)'];

/** Every person and business gets their own color, always the same one. */
function hueFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return HUES[Math.abs(h) % HUES.length];
}

export function Avatar({ name, text, size }: { name: string; text?: string; size?: number }) {
  const style = { '--av': hueFor(name), ...(size ? { width: size, height: size } : {}) } as CSSProperties;
  return (
    <div className="avatar" style={style} aria-hidden>
      {text ?? name[0]}
    </div>
  );
}
