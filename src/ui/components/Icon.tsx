// Simple line icons drawn with SVG, so the game needs no image files.

const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2',
  chat: 'M4 5h16v11H8l-4 4z',
  layout: 'M4 4h16v16H4zM4 9h16M9 9v11',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  building: 'M4 21V5l8-3v19M12 8l8 3v10M8 9h.01M8 13h.01M8 17h.01M16 14h.01M16 18h.01M2 21h20',
  star: 'm12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.2-.9z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M21 21l-4.3-4.3',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8',
  file: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  settings: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 7a2 2 0 1 0 0 .01M9 17a2 2 0 1 0 0 .01',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
