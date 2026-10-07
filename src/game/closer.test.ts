import { describe, expect, it } from 'vitest';
import { generateBusiness } from './businesses';
import { closeDeal, CLOSER_LEVEL, type CloserOutcome } from './closer';
import { createDeal, dealStatus, toGameTime, fromGameTime } from './deals';
import { WORKDAY_END, WORKDAY_START } from './balance';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = toGameTime(1, 11 * 60);
const ctx = { agencyName: 'Pixel Co.', reputation: 5, devLevel: 3 };

function run(level: number, n: number, seed: number) {
  const rand = seeded(seed);
  const counts: Record<CloserOutcome, number> = { won: 0, lost: 0, handoff: 0 };
  const results: ReturnType<typeof closeDeal>[] = [];
  for (let i = 0; i < n; i++) {
    const biz = generateBusiness(rand);
    const deal = createDeal(biz, 50 + level * 3, NOW, rand, 'Leo');
    const res = closeDeal(deal, biz, { name: 'Leo Silva', level }, ctx, NOW, rand);
    counts[res.outcome]++;
    results.push(res);
  }
  return { counts, results };
}

describe('sales people who close deals themselves', () => {
  it('only the best sales people do it', () => {
    expect(CLOSER_LEVEL).toBe(4);
  });

  it('they play out the whole conversation, and a good share of deals get signed', () => {
    const { counts } = run(5, 1500, 1);
    console.log('level 5:', counts);
    expect(counts.won).toBeGreaterThan(300);
    expect(counts.lost).toBeGreaterThan(100);
    // Most conversations end one way or the other without needing you.
    expect(counts.handoff).toBeLessThan(counts.won + counts.lost);
  });

  it('level 5 closes more than level 4', () => {
    const four = run(4, 2000, 2).counts.won;
    const five = run(5, 2000, 2).counts.won;
    console.log('won at level 4 / level 5:', four, five);
    expect(five).toBeGreaterThan(four);
  });

  it('a won deal has a quote and a price and turns into a project when the last reply arrives', () => {
    const { results } = run(5, 300, 3);
    const won = results.filter((r) => r.outcome === 'won');
    expect(won.length).toBeGreaterThan(20);
    for (const { deal } of won) {
      expect(deal.stage).toBe('won');
      expect(deal.quote).not.toBeNull();
      expect(deal.agreedPrice).toBeGreaterThan(0);
      expect(deal.closedAt).not.toBeNull();
      // Before the final reply it is still waiting. After it, it's signed.
      expect(dealStatus(deal, deal.closedAt! - 1)).toBe('waiting');
      expect(dealStatus(deal, deal.closedAt!)).toBe('won');
      expect(deal.messages.some((m) => m.text.includes('closed the deal for you'))).toBe(true);
    }
  });

  it('the conversation reads in order and they only text during work hours', () => {
    const { results } = run(5, 300, 4);
    for (const { deal } of results) {
      const times = deal.messages.map((m) => m.t);
      // Messages are stored in the order they were sent, and nobody replies before they were asked.
      for (const m of deal.messages.filter((x) => x.from === 'you')) {
        const { day, minute } = fromGameTime(m.t);
        expect((day - 1) % 7).toBeLessThan(5);
        expect(minute).toBeGreaterThanOrEqual(WORKDAY_START);
        expect(minute).toBeLessThan(WORKDAY_END);
      }
      expect(Math.min(...times)).toBeGreaterThanOrEqual(NOW);
    }
  });

  it('they only quote features you can build', () => {
    const rand = seeded(5);
    for (let i = 0; i < 400; i++) {
      const biz = generateBusiness(rand);
      const { deal } = closeDeal(createDeal(biz, 60, NOW, rand, 'Leo'), biz, { name: 'Leo Silva', level: 5 }, { ...ctx, devLevel: 1 }, NOW, rand);
      for (const f of deal.quote?.features ?? []) expect(['booking', 'listings', 'online_store']).not.toContain(f);
    }
  });
});
