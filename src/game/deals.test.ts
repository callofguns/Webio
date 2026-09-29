import { describe, expect, it } from 'vitest';
import { generateBusiness } from './businesses';
import {
  buildDays,
  createDeal,
  dealStatus,
  endOfDayDeal,
  isWaiting,
  marketPrice,
  OPEN_QUOTE,
  sendQuote,
  sendText,
  textChoices,
  toGameTime,
  visibleMessages,
  type TextContext,
} from './deals';
import type { Business, Deal, Quote } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const START = toGameTime(1, 10 * 60);
const ctxAt = (now: number): TextContext => ({ now, playerName: 'Alex', agencyName: 'Pixel Co.', reputation: 0, devLevel: 3 });

/** Jump to just after the last scheduled message. */
const afterReplies = (d: Deal) => Math.max(...d.messages.map((m) => m.t)) + 1;

function askEverything(deal: Deal, biz: Business, rand: () => number): Deal {
  let d = sendText(deal, biz, 'intro_pro', ctxAt(START), rand);
  for (const q of ['q_features', 'q_budget', 'q_deadline', 'q_content']) {
    d = sendText(d, biz, q, ctxAt(afterReplies(d)), rand);
  }
  return d;
}

function fairQuote(deal: Deal, priceFactor: number, biz: Business): Quote {
  return {
    pages: deal.needs.pages,
    features: deal.needs.features,
    price: Math.round((biz.budget * priceFactor) / 50) * 50,
    days: Math.min(deal.needs.deadlineDays, buildDays(deal.needs.pages, deal.needs.features)),
    depositPct: 25,
  };
}

describe('deals', () => {
  it('replies arrive later, not instantly', () => {
    const rand = seeded(1);
    const biz = generateBusiness(rand);
    const deal = createDeal(biz, 50, START, rand);
    const next = sendText(deal, biz, 'intro_pro', ctxAt(START), rand);
    expect(isWaiting(next, START)).toBe(true);
    expect(dealStatus(next, START)).toBe('waiting');
    expect(visibleMessages(next, START).at(-1)?.from).toBe('you');
    expect(dealStatus(next, afterReplies(next))).toBe('your_turn');
  });

  it('you cannot text again while waiting for a reply', () => {
    const rand = seeded(2);
    const biz = generateBusiness(rand);
    const deal = sendText(createDeal(biz, 50, START, rand), biz, 'intro_pro', ctxAt(START), rand);
    expect(sendText(deal, biz, 'q_budget', ctxAt(START + 1), rand)).toBe(deal);
  });

  it('asking questions reveals what they need', () => {
    const rand = seeded(3);
    const biz = generateBusiness(rand);
    const d = askEverything(createDeal(biz, 50, START, rand), biz, rand);
    expect(d.known).toEqual({ features: true, budget: true, deadline: true, content: true });
    expect(textChoices(d, biz).map((c) => c.id)).toEqual([OPEN_QUOTE]);
  });

  it('replies never land in the middle of the night', () => {
    const rand = seeded(4);
    for (let i = 0; i < 200; i++) {
      const biz = generateBusiness(rand);
      const late = toGameTime(1, 20 * 60 + 50);
      const d = sendText(createDeal(biz, 50, late, rand), biz, 'intro_pro', ctxAt(late), rand);
      const minute = d.messages.at(-1)!.t % (24 * 60);
      expect(minute >= 8 * 60 && minute < 21 * 60).toBe(true);
    }
  });

  it('a fair, complete quote wins far more often than an overpriced, incomplete one', () => {
    const rand = seeded(5);
    let fairWins = 0;
    let greedyWins = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const biz = generateBusiness(rand);
      const d = askEverything(createDeal(biz, 55, START, rand), biz, rand);
      const at = ctxAt(afterReplies(d));
      const fair = sendQuote(d, biz, fairQuote(d, 0.9, biz), at, rand);
      if (fair.stage === 'won') fairWins++;
      const greedy = sendQuote(d, biz, { ...fairQuote(d, 1.6, biz), features: d.needs.features.slice(1) }, at, rand);
      if (greedy.stage === 'won') greedyWins++;
    }
    console.log(`quote accepted — fair: ${((fairWins / n) * 100).toFixed(0)}%, greedy: ${((greedyWins / n) * 100).toFixed(0)}%`);
    expect(fairWins / n).toBeGreaterThan(0.3);
    expect(greedyWins / n).toBeLessThan(0.05);
  });

  it('ignoring a client cools them off, then they ghost you', () => {
    const rand = seeded(6);
    const biz = generateBusiness(rand);
    let d = createDeal(biz, 30, START, rand);
    for (let day = 1; day <= 5 && d.stage !== 'lost'; day++) {
      d = endOfDayDeal(d, biz, toGameTime(day, 23 * 60), toGameTime(day + 1, 9 * 60), rand);
      // Pretend time moves forward past any nudge message.
      d = { ...d, messages: d.messages.map((m) => ({ ...m, t: Math.min(m.t, toGameTime(day + 1, 8 * 60)) })) };
    }
    expect(d.stage).toBe('lost');
    expect(d.warmth).toBeLessThan(30);
  });

  it('prices go up with more pages and features', () => {
    expect(marketPrice(5, ['booking'])).toBeGreaterThan(marketPrice(5, []));
    expect(marketPrice(6, [])).toBeGreaterThan(marketPrice(3, []));
  });
});
