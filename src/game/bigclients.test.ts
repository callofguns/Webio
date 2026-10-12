import { beforeEach, describe, expect, it } from 'vitest';
import { generateBusiness, generateBusinesses } from './businesses';
import { addOnOptions, BIG_CLIENT_REPUTATION, bigClientsMissing, bigClientsOpen, comebackDay, returnDeal } from './bigclients';
import { createDeal, evaluateQuote, marketPrice, OPEN_QUOTE, rollNeeds, textChoices, toGameTime } from './deals';
import { createProject } from './projects';
import { useGame } from './store';
import { WORKDAY_START } from './balance';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NOW = toGameTime(5, 10 * 60);

describe('big clients', () => {
  it('need both a good reputation and a proper office', () => {
    expect(bigClientsOpen(BIG_CLIENT_REPUTATION, 'small')).toBe(true);
    expect(bigClientsOpen(BIG_CLIENT_REPUTATION, 'loft')).toBe(true);
    expect(bigClientsOpen(BIG_CLIENT_REPUTATION, 'coworking')).toBe(false);
    expect(bigClientsOpen(BIG_CLIENT_REPUTATION - 1, 'loft')).toBe(false);
    expect(bigClientsMissing(0, 'bedroom')).toHaveLength(2);
    expect(bigClientsMissing(BIG_CLIENT_REPUTATION, 'small')).toHaveLength(0);
  });

  it('never show up before they are unlocked', () => {
    const list = generateBusinesses(300, seeded(1));
    expect(list.some((b) => b.size === 'large')).toBe(false);
  });

  it('show up once unlocked, with big budgets', () => {
    const list = generateBusinesses(200, seeded(2), [], 0.2);
    const big = list.filter((b) => b.size === 'large');
    expect(big.length).toBeGreaterThan(20);
    expect(big.length).toBeLessThan(70);
    for (const b of big) expect(b.budget).toBeGreaterThanOrEqual(4000);
  });

  it('want big sites with many locations, worth up to about $8,000', () => {
    const rand = seeded(3);
    const prices: number[] = [];
    for (let i = 0; i < 300; i++) {
      const biz = generateBusiness(rand, true);
      const n = rollNeeds(biz, rand);
      expect(n.features).toContain('locations');
      expect(n.pages).toBeGreaterThanOrEqual(10);
      expect(n.deadlineDays).toBeGreaterThanOrEqual(25);
      prices.push(marketPrice(n.pages, n.features));
    }
    expect(Math.min(...prices)).toBeGreaterThan(2000);
    expect(Math.max(...prices)).toBeLessThanOrEqual(8500);
  });

  it('restaurants and gyms ask for their own big features', () => {
    const rand = seeded(4);
    const wants = (industry: string) => {
      const out = new Set<string>();
      for (let i = 0; i < 400; i++) {
        const biz = generateBusiness(rand, true);
        if (biz.industry === industry) rollNeeds(biz, rand).features.forEach((f) => out.add(f));
      }
      return out;
    };
    expect(wants('restaurant').has('delivery')).toBe(true);
    expect(wants('fitness').has('accounts')).toBe(true);
  });
});

describe('returning clients', () => {
  it('only happy clients come back', () => {
    const rand = seeded(5);
    for (let i = 0; i < 100; i++) expect(comebackDay(3, 10, rand)).toBeNull();
    const days = Array.from({ length: 200 }, () => comebackDay(5, 10, rand)).filter((d) => d !== null) as number[];
    expect(days.length).toBeGreaterThan(100);
    for (const d of days) {
      expect(d).toBeGreaterThanOrEqual(18);
      expect(d).toBeLessThanOrEqual(30);
    }
  });

  it('text you exactly what they want, so you can quote right away', () => {
    const rand = seeded(6);
    const biz = { ...generateBusiness(rand), status: 'client' as const };
    const deal = { ...createDeal(biz, 60, NOW, rand), quote: { pages: 4, features: ['contact_form' as const], price: 900, days: 10, depositPct: 25 } };
    const project = { ...createProject(deal, biz, 1, rand), status: 'delivered' as const, stars: 5 };
    const back = returnDeal(biz, project, NOW, 1, rand);
    expect(back.stage).toBe('discovery');
    expect(back.returning).toBeDefined();
    expect(back.messages.some((m) => m.from === 'them')).toBe(true);
    expect(textChoices(back, biz).map((c) => c.id)).toEqual([OPEN_QUOTE]);
    if (back.returning === 'addon') for (const f of back.needs.features) expect(project.features).not.toContain(f);
  });

  it('usually say yes to a fair quote', () => {
    const rand = seeded(7);
    let yes = 0;
    for (let i = 0; i < 300; i++) {
      const biz = generateBusiness(rand);
      const deal = { ...createDeal(biz, 60, NOW, rand), quote: { pages: 4, features: ['gallery' as const], price: 900, days: 10, depositPct: 25 } };
      const project = { ...createProject(deal, biz, 1, rand), status: 'delivered' as const, stars: 4 };
      const back = returnDeal(biz, project, NOW, 3, rand);
      const n = back.needs;
      const quote = { pages: n.pages, features: n.features, price: marketPrice(n.pages, n.features), days: n.deadlineDays, depositPct: 25 };
      if (evaluateQuote(back, biz, quote, 10, rand).kind === 'accept') yes++;
    }
    expect(yes / 300).toBeGreaterThan(0.7);
  });

  it('add-ons never offer something the site already has', () => {
    const biz = generateBusiness(seeded(8));
    const opts = addOnOptions(biz, ['contact_form', 'reviews', 'gallery']);
    expect(opts).not.toContain('contact_form');
    expect(opts).not.toContain('copywriting');
  });

  it('only ask for add-ons you can build', () => {
    const biz = { ...generateBusiness(seeded(9)), industry: 'restaurant' as const };
    expect(addOnOptions(biz, [], 1)).not.toContain('online_store');
    expect(addOnOptions(biz, [], 3)).toContain('online_store');
  });

  describe('in the game', () => {
    beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

    it('a happy client texts you when their day comes', () => {
      const s = useGame.getState();
      const biz = s.businesses[0];
      const t = toGameTime(1, WORKDAY_START);
      const deal = { ...createDeal(biz, 60, t), stage: 'won' as const, settled: true, quote: { pages: 4, features: ['gallery' as const], price: 900, days: 10, depositPct: 25 } };
      const project = { ...createProject(deal, biz, 1), status: 'delivered' as const, stars: 5, deliveredDay: 1, comebackDay: 2 };
      useGame.setState({ deals: [deal], projects: [project] });
      useGame.getState().endDay();
      const after = useGame.getState();
      const back = after.deals.find((d) => d.returning);
      expect(back?.businessId).toBe(biz.id);
      expect(after.projects[0].comebackDay).toBeNull();
    });

    it('big companies appear once you have the reputation and office', () => {
      useGame.setState({ reputation: BIG_CLIENT_REPUTATION, office: 'small' });
      useGame.getState().endDay();
      const s = useGame.getState();
      expect(s.bigClients).toBe(true);
      expect(s.businesses.filter((b) => b.size === 'large').length).toBeGreaterThanOrEqual(3);
    });
  });
});
