import { beforeEach, describe, expect, it } from 'vitest';
import { generateBusinesses } from './businesses';
import {
  dailyApplicants,
  endOfDayMorale,
  generateApplicant,
  hire,
  interview,
  marketPay,
  offerResult,
  salesHour,
  workMinutesBetween,
} from './team';
import { useGame } from './store';
import { createDeal, toGameTime } from './deals';
import { createProject } from './projects';
import type { JobPost } from './types';
import { DAILY_LIVING_COST, MAX_TEAM, START_MONEY } from './balance';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const post = (board: JobPost['board'], role: JobPost['role'] = 'developer'): JobPost => ({
  id: 'p', role, board, pay: marketPay(role, 2), postedDay: 1, endsDay: 8,
});

describe('hiring', () => {
  it('the free board brings fewer and weaker applicants than referrals', () => {
    const rand = seeded(1);
    const avg = (board: JobPost['board']) => {
      const apps = Array.from({ length: 2000 }, () => generateApplicant(post(board), 1, rand));
      return apps.reduce((s, a) => s + a.level, 0) / apps.length;
    };
    expect(avg('free')).toBeLessThan(2);
    expect(avg('referral')).toBeGreaterThan(3);
    let freeCount = 0;
    let paidCount = 0;
    for (let d = 0; d < 1000; d++) {
      freeCount += dailyApplicants(post('free'), d, rand).length;
      paidCount += dailyApplicants(post('paid'), d, rand).length;
    }
    expect(paidCount).toBeGreaterThan(freeCount * 1.5);
  });

  it('résumés can exaggerate but never undersell', () => {
    const rand = seeded(2);
    for (let i = 0; i < 500; i++) {
      const a = generateApplicant(post('free'), 1, rand);
      expect(a.claimedLevel).toBeGreaterThanOrEqual(a.level);
      expect(a.askingPay).toBeGreaterThanOrEqual(a.minPay);
    }
  });

  it('an interview reveals a trait', () => {
    const rand = seeded(3);
    const a = generateApplicant(post('paid'), 1, rand);
    const after = interview(a, rand);
    expect(after.interviewed).toBe(true);
    expect(after.knownTraits.length).toBe(1);
    expect(a.traits).toContain(after.knownTraits[0]);
  });

  it('lowball offers get a counter first, then a no', () => {
    const rand = seeded(4);
    const a = { ...generateApplicant(post('free'), 1, rand), level: 2 };
    const counter = offerResult(a, Math.floor(a.minPay * 0.9), 0, rand);
    expect(counter.kind).toBe('counter');
    const again = offerResult({ ...a, counter: a.minPay }, Math.floor(a.minPay * 0.9), 0, rand);
    expect(again.kind).toBe('decline');
    expect(offerResult(a, Math.floor(a.minPay * 0.5), 0, rand).kind).toBe('decline');
  });
});

describe('working', () => {
  it('only counts weekday work hours', () => {
    expect(workMinutesBetween(1, 8 * 60, 10 * 60)).toBe(60); // Monday 8-10 → 9-10
    expect(workMinutesBetween(1, 17 * 60, 20 * 60)).toBe(60);
    expect(workMinutesBetween(6, 9 * 60, 18 * 60)).toBe(0); // Saturday
  });

  it('sales callers dial through the list and sometimes find leads', () => {
    const rand = seeded(5);
    const a = generateApplicant(post('paid', 'sales'), 1, rand);
    const e = { ...hire({ ...a, level: 3, traits: [] }, 100, -5), morale: 80 };
    let businesses = generateBusinesses(300, rand);
    let dials = 0;
    let leads = 0;
    for (let day = 1; day <= 20; day++) {
      for (let h = 0; h < 9; h++) {
        const r = salesHour(e, businesses, day, 0, rand);
        businesses = r.businesses;
        dials += r.dials;
        leads += r.leads.length;
      }
    }
    expect(dials).toBeGreaterThan(200);
    expect(leads).toBeGreaterThan(0);
    expect(leads / dials).toBeLessThan(0.06);
  });

  it('underpaid staff lose morale and eventually quit', () => {
    const rand = seeded(6);
    const a = generateApplicant(post('paid'), 1, rand);
    let e = { ...hire({ ...a, traits: [] }, Math.round(marketPay(a.role, a.level) * 0.5), 1), morale: 50 };
    let quit = false;
    for (let d = 0; d < 30 && !quit; d++) {
      const r = endOfDayMorale(e, rand);
      e = r.employee;
      quit = r.quit;
    }
    expect(quit).toBe(true);
  });

  it('well-paid staff stay happy', () => {
    const rand = seeded(7);
    const a = generateApplicant(post('paid'), 1, rand);
    let e = hire({ ...a, traits: ['reliable'] }, Math.round(marketPay(a.role, a.level) * 1.1), 1);
    for (let d = 0; d < 30; d++) e = endOfDayMorale(e, rand).employee;
    expect(e.morale).toBeGreaterThan(70);
  });
});

describe('team in the game', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  function addEmployee(role: 'designer' | 'developer' | 'sales', pay = 100) {
    const rand = seeded(8);
    const a = { ...generateApplicant(post('paid', role), 1, rand), level: 3, traits: [] };
    const e = { ...hire(a, pay, -5), morale: 80 };
    useGame.setState({ employees: [...useGame.getState().employees, e] });
    return e;
  }

  it('employees work on their assigned project while you do other things', () => {
    const s = useGame.getState();
    const biz = { ...s.businesses[0], status: 'client' as const };
    const deal = {
      ...createDeal(biz, 80, toGameTime(1, 600)),
      stage: 'won' as const,
      settled: true,
      agreedPrice: 1200,
      quote: { pages: 3, features: [], price: 1200, days: 14, depositPct: 0 },
    };
    const project = { ...createProject(deal, biz, 1), status: 'in_progress' as const };
    useGame.setState({ businesses: [biz, ...s.businesses.slice(1)], deals: [deal], projects: [project] });
    const dev = addEmployee('designer');
    useGame.getState().assignEmployee(dev.id, project.id);

    useGame.getState().wait(180);
    const p = useGame.getState().projects[0];
    const designDone = p.tasks.filter((t) => t.skill === 'design').reduce((n, t) => n + t.done, 0);
    const devDone = p.tasks.filter((t) => t.skill === 'development').reduce((n, t) => n + t.done, 0);
    expect(designDone).toBeGreaterThan(0);
    expect(devDone).toBe(0); // designers don't code
    expect(useGame.getState().employees[0].today.hours).toBe(3);
  });

  it('wages are paid on Friday', () => {
    addEmployee('sales', 100);
    for (let i = 0; i < 4; i++) useGame.getState().endDay(); // Mon-Thu
    expect(useGame.getState().payrollDue).toBe(400);
    const before = useGame.getState().money;
    useGame.getState().endDay(); // Friday
    expect(useGame.getState().payrollDue).toBe(0);
    expect(useGame.getState().money).toBe(before - 500 - DAILY_LIVING_COST);
    expect(useGame.getState().lastDaySummary?.payroll).toBe(500);
  });

  it('you can only have a small team while working from your bedroom', () => {
    for (let i = 0; i < MAX_TEAM; i++) addEmployee('sales');
    const rand = seeded(9);
    const a = generateApplicant(post('paid', 'sales'), 1, rand);
    useGame.setState({ applicants: [a] });
    expect(useGame.getState().makeOffer(a.id, a.askingPay * 2)).toBeNull();
  });

  it('posting on the paid site costs money and applicants arrive over the next days', () => {
    useGame.getState().postJob('developer', 'paid', marketPay('developer', 3));
    expect(useGame.getState().money).toBe(START_MONEY - 90);
    for (let i = 0; i < 7; i++) useGame.getState().endDay();
    expect(useGame.getState().applicants.length + useGame.getState().log.filter((l) => l.text.includes('took another job')).length).toBeGreaterThan(0);
  });
});
