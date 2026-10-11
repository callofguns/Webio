import { describe, expect, it } from 'vitest';
import { generateBusiness, generateBusinesses } from './businesses';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('business names', () => {
  it('never leaves a placeholder in a name', () => {
    const rand = seeded(1);
    for (let i = 0; i < 5000; i++) {
      const { name, ownerName } = generateBusiness(rand);
      expect(name).not.toMatch(/[{}]/);
      expect(name.trim()).toBe(name);
      expect(ownerName).not.toMatch(/[{}]/);
    }
  });

  it('there are thousands of different names', () => {
    const rand = seeded(2);
    const names = new Set<string>();
    for (let i = 0; i < 20000; i++) names.add(generateBusiness(rand).name);
    expect(names.size).toBeGreaterThan(5000);
  });

  it('a batch has no duplicate names, also compared to the businesses you already have', () => {
    const rand = seeded(3);
    const first = generateBusinesses(50, rand);
    const more = generateBusinesses(200, rand, first);
    const all = [...first, ...more];
    expect(more).toHaveLength(200);
    expect(new Set(all.map((b) => b.name)).size).toBe(all.length);
  });

  it('two-person names use two different people', () => {
    const rand = seeded(4);
    for (let i = 0; i < 5000; i++) {
      const { name } = generateBusiness(rand);
      const m = name.match(/^(\w+) & (\w+) Eatery$/);
      if (m) expect(m[1]).not.toBe(m[2]);
    }
  });
});
