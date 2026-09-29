// Small helpers for randomness. Game logic takes a `rand` function so
// tests can pass in predictable numbers.

export type Rand = () => number;

export const defaultRand: Rand = Math.random;

export function pick<T>(items: readonly T[], rand: Rand = defaultRand): T {
  return items[Math.floor(rand() * items.length)];
}

export function randInt(min: number, max: number, rand: Rand = defaultRand): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function chance(p: number, rand: Rand = defaultRand): boolean {
  return rand() < p;
}

/** Picks a key from a table of weights, e.g. { a: 3, b: 1 } picks `a` 75% of the time. */
export function weighted<K extends string>(table: Record<K, number>, rand: Rand = defaultRand): K {
  const entries = Object.entries(table) as [K, number][];
  const total = entries.reduce((sum, [, w]) => sum + Math.max(0, w), 0);
  let roll = rand() * total;
  for (const [key, w] of entries) {
    roll -= Math.max(0, w);
    if (roll < 0) return key;
  }
  return entries[entries.length - 1][0];
}

export function shuffle<T>(items: readonly T[], rand: Rand = defaultRand): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

let idCounter = 0;
export function uid(prefix = 'id'): string {
  idCounter = (idCounter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
