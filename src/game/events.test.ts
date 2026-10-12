import { beforeEach, describe, expect, it } from 'vitest';
import { describeEvent, EVENT_MIN_GAP, EVENT_START_DAY, eligibleEvents, rollEvent, type GameEvent } from './events';
import { useGame } from './store';
import { createDeal, toGameTime } from './deals';
import { createProject } from './projects';
import { WORKDAY_START } from './balance';
import type { Employee } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const worker = (): Employee => ({
  id: 'e1', name: 'Leo Silva', role: 'sales', level: 3, xp: 0, pay: 600,
  traits: ['reliable'], knownTraits: [], morale: 60, hiredDay: 1, assignedProjectId: null,
  carryMinutes: 0, lowMoraleDays: 0, today: { dials: 0, leads: 0, hours: 0, note: '' },
});

describe('when events happen', () => {
  const state = { day: 10, projects: [], employees: [worker()], deals: [] };

  it('not in your first few days, and never two close together', () => {
    const always = () => 0;
    expect(rollEvent({ ...state, day: EVENT_START_DAY - 1 }, always)).toBeNull();
    expect(rollEvent({ ...state, lastEventDay: 10 - EVENT_MIN_GAP + 1 }, always)).toBeNull();
    expect(rollEvent({ ...state, lastEventDay: 10 - EVENT_MIN_GAP }, always)).not.toBeNull();
  });

  it('about once a week', () => {
    const rand = seeded(1);
    let n = 0;
    for (let i = 0; i < 7000; i++) if (rollEvent(state, rand)) n++;
    expect(n).toBeGreaterThan(800);
    expect(n).toBeLessThan(1200);
  });

  it('only things that can actually happen to you', () => {
    expect(eligibleEvents({ ...state, employees: [] })).toEqual([]);
    expect(eligibleEvents(state).map((c) => c.kind)).toEqual(['sick']);
  });

  it('every event has a title and at least one choice', () => {
    for (const kind of ['viral', 'sick', 'rival', 'outage'] as const) {
      const v = describeEvent({ id: 'x', kind, day: 5, targetId: 'y' }, {});
      expect(v.title.length).toBeGreaterThan(0);
      expect(v.choices.length).toBeGreaterThan(0);
    }
  });
});

describe('answering events', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));
  const ev = (kind: GameEvent['kind'], targetId: string): GameEvent => ({ id: 'ev', kind, day: 1, targetId, rival: 'WebWave Agency' });

  function delivered(withRetainer = false) {
    const biz = { ...useGame.getState().businesses[0], status: 'client' as const };
    const deal = { ...createDeal(biz, 70, toGameTime(1, WORKDAY_START)), stage: 'won' as const, settled: true, quote: { pages: 4, features: [], price: 1000, days: 10, depositPct: 25 } };
    const project = {
      ...createProject(deal, biz, 1),
      status: 'delivered' as const,
      stars: 5,
      deliveredDay: 1,
      ...(withRetainer ? { plan: 'retainer' as const, retainer: { monthly: 100, nextBillDay: 30, paid: 100, months: 1 } } : {}),
    };
    useGame.setState({ businesses: useGame.getState().businesses.map((b) => (b.id === biz.id ? biz : b)), deals: [deal], projects: [project] });
    return project;
  }

  it('a viral site brings reputation and referral leads', () => {
    const p = delivered();
    useGame.setState({ event: ev('viral', p.id) });
    useGame.getState().resolveEvent('ok');
    const s = useGame.getState();
    expect(s.event).toBeNull();
    expect(s.reputation).toBe(3);
    const referrals = s.deals.filter((d) => d.messages[0].text.startsWith('Referred by'));
    expect(referrals).toHaveLength(2);
    expect(referrals.every((d) => d.stage === 'intro')).toBe(true);
  });

  it('a sick employee who rests does no work today, and is back tomorrow', () => {
    useGame.setState({ employees: [worker()], event: ev('sick', 'e1') });
    useGame.getState().resolveEvent('rest');
    expect(useGame.getState().employees[0].morale).toBe(65);
    useGame.getState().wait(240);
    expect(useGame.getState().employees[0].today.dials).toBe(0);
    useGame.getState().endDay();
    expect(useGame.getState().employees[0].sick).toBeUndefined();
    useGame.getState().wait(120);
    expect(useGame.getState().employees[0].today.dials).toBeGreaterThan(0);
  });

  it('working from home sick makes them unhappy', () => {
    useGame.setState({ employees: [worker()], event: ev('sick', 'e1') });
    useGame.getState().resolveEvent('wfh');
    expect(useGame.getState().employees[0].morale).toBe(50);
    expect(useGame.getState().employees[0].sick?.mode).toBe('wfh');
  });

  it('promising a better price to beat a rival lowers what they expect to pay', () => {
    const biz = useGame.getState().businesses[0];
    const deal = { ...createDeal(biz, 60, toGameTime(1, WORKDAY_START)), stage: 'discovery' as const };
    useGame.setState({ deals: [deal], event: ev('rival', deal.id) });
    useGame.getState().resolveEvent('match');
    const d = useGame.getState().deals[0];
    expect(d.budget).toBeLessThan(biz.budget);
    expect(d.warmth).toBe(70);
    expect(d.messages.some((m) => m.from === 'you')).toBe(true);
  });

  it('holding firm with a lukewarm client loses them', () => {
    const biz = useGame.getState().businesses[0];
    const deal = { ...createDeal(biz, 30, toGameTime(1, WORKDAY_START)), stage: 'discovery' as const };
    useGame.setState({ deals: [deal], event: ev('rival', deal.id) });
    useGame.getState().resolveEvent('hold');
    expect(useGame.getState().deals[0].stage).toBe('lost');
  });

  it('fixing a crashed site takes two hours and earns reputation', () => {
    const p = delivered(true);
    useGame.setState({ event: ev('outage', p.id) });
    useGame.getState().resolveEvent('fix');
    const s = useGame.getState();
    expect(s.minute).toBe(WORKDAY_START + 120);
    expect(s.reputation).toBe(1);
    expect(s.projects[0].retainer).toBeDefined();
  });

  it('leaving a crashed site costs reputation, and sometimes the monthly plan', () => {
    let cancelled = 0;
    for (let i = 0; i < 40; i++) {
      useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' });
      const p = delivered(true);
      useGame.setState({ reputation: 10, event: ev('outage', p.id) });
      useGame.getState().resolveEvent('later');
      expect(useGame.getState().reputation).toBeLessThan(10);
      if (!useGame.getState().projects[0].retainer) cancelled++;
    }
    expect(cancelled).toBeGreaterThan(5);
    expect(cancelled).toBeLessThan(35);
  });
});
