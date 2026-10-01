/** The Webio mark: a "W" inside a design-tool selection frame. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <rect x="6" y="6" width="52" height="52" rx="14" fill="var(--accent)" />
      <path d="M18 24 L24 42 L32 29 L40 42 L46 24" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
      {[
        [2, 2],
        [54, 2],
        [2, 54],
        [54, 54],
      ].map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="8" height="8" rx="1.5" fill="var(--surface)" stroke="var(--accent)" strokeWidth="2" />
      ))}
    </svg>
  );
}
