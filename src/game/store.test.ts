import { beforeEach, describe, expect, it } from 'vitest';
import { callBlocker, useGame } from './store';
import { DAILY_LIVING_COST, RESEARCH_MINUTES, START_MONEY, WORKDAY_START } from './balance';
import { createDeal, toGameTime } from './deals';
import { allTasksDone, createProject } from './projects';

describe('game store', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('starts a fresh game on day 1 at 9 AM', () => {
    const s = useGame.getState();
    expect(s.day).toBe(1);
    expect(s.minute).toBe(WORKDAY_START);
    expect(s.money).toBe(START_MONEY);
    expect(s.businesses.length).toBeGreaterThan(0);
  });

  it('research takes time and reveals the business', () => {
    const id = useGame.getState().businesses[0].id;
    useGame.getState().research(id);
    const s = useGame.getState();
    expect(s.minute).toBe(WORKDAY_START + RESEARCH_MINUTES);
    expect(s.businesses[0].researched).toBe(true);
  });

  it('ending the day charges living costs and resets the clock', () => {
    useGame.getState().research(useGame.getState().businesses[0].id);
    useGame.getState().endDay();
    const s = useGame.getState();
    expect(s.day).toBe(2);
    expect(s.minute).toBe(WORKDAY_START);
    expect(s.money).toBe(START_MONEY - DAILY_LIVING_COST);
    expect(s.lastDaySummary?.day).toBe(1);
  });

  it('a finished call is counted and the business cannot be called again today', () => {
    const biz = useGame.getState().businesses[0];
    useGame.getState().beginCall(biz.id);
    // Play the first option until the call ends.
    for (let i = 0; i < 20 && useGame.getState().activeCall?.phase !== 'ended'; i++) {
      const c = useGame.getState().activeCall!.choices.find((x) => !x.disabled)!;
      useGame.getState().choose(c.id);
    }
    useGame.getState().closeCall();
    const s = useGame.getState();
    expect(s.today.dials).toBe(1);
    expect(s.minute).toBeGreaterThan(WORKDAY_START);
    const after = s.businesses.find((b) => b.id === biz.id)!;
    expect(after.attempts).toBe(1);
    expect(callBlocker(after, s.day, s.minute)).not.toBeNull();
  });

  it('lost conversations can be deleted, but nothing else', () => {
    const { businesses } = useGame.getState();
    const t = toGameTime(1, WORKDAY_START);
    const mk = (i: number, stage: 'lost' | 'won' | 'discovery', closedAt: number | null) => ({
      ...createDeal(businesses[i], 50, t),
      stage,
      closedAt,
      settled: closedAt !== null,
    });
    const lost = mk(0, 'lost', t);
    const won = mk(1, 'won', t);
    const open = mk(2, 'discovery', null);
    // A loss whose reply hasn't arrived yet still shows as waiting.
    const pending = mk(3, 'lost', t + 600);
    pending.messages = [...pending.messages, { id: 'late', from: 'them', text: 'No thanks.', t: t + 600 }];
    useGame.setState({ deals: [lost, won, open, pending] });
    useGame.getState().deleteLostDeals([lost.id, won.id, open.id, pending.id]);
    expect(useGame.getState().deals.map((d) => d.id)).toEqual([won.id, open.id, pending.id]);
  });

  it('nobody picks up on Sunday', () => {
    const biz = useGame.getState().businesses[0];
    expect(callBlocker(biz, 7, 10 * 60)).toBe('Businesses are closed');
  });
});

describe('texting clients', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  /** Puts a warm deal into the game, as if a call just went well. */
  function addWarmDeal() {
    const s = useGame.getState();
    const biz = { ...s.businesses[0], status: 'interested' as const, temperament: 'friendly' as const };
    const deal = { ...createDeal(biz, 95, toGameTime(s.day, s.minute)), stage: 'discovery' as const };
    useGame.setState({ businesses: [biz, ...s.businesses.slice(1)], deals: [deal] });
    return { biz, deal };
  }

  it('a signed deal pays the deposit and creates a project once their reply arrives', () => {
    const { biz, deal } = addWarmDeal();
    const price = Math.round((biz.budget * 0.5) / 50) * 50;
    useGame.getState().sendQuote(deal.id, {
      pages: deal.needs.pages,
      features: deal.needs.features,
      price,
      days: 5,
      depositPct: 50,
    });
    expect(useGame.getState().deals[0].stage).toBe('won');
    // Nothing is paid until their "yes" actually arrives.
    expect(useGame.getState().money).toBe(START_MONEY);

    for (let i = 0; i < 30 && !useGame.getState().deals[0].settled; i++) {
      if (useGame.getState().minute >= 21 * 60) useGame.getState().endDay();
      else useGame.getState().wait(60);
    }
    const s = useGame.getState();
    expect(s.deals[0].settled).toBe(true);
    expect(s.projects).toHaveLength(1);
    expect(s.projects[0].price).toBe(price);
    expect(s.businesses[0].status).toBe('client');
    const expenses = (s.day - 1) * DAILY_LIVING_COST;
    expect(s.money).toBe(START_MONEY + Math.round(price / 2) - expenses);
  });

  it('texting takes a few minutes and waiting passes time', () => {
    const { deal } = addWarmDeal();
    const start = useGame.getState().minute;
    useGame.getState().sendText(deal.id, 'q_features');
    expect(useGame.getState().minute).toBe(start + 3);
    useGame.getState().wait(60);
    expect(useGame.getState().minute).toBe(start + 63);
  });
});

describe('building a site', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('build, submit and get paid (or asked for changes) once the review arrives', () => {
    const s = useGame.getState();
    const biz = { ...s.businesses[0], status: 'client' as const };
    const deal = {
      ...createDeal(biz, 80, toGameTime(1, 600)),
      stage: 'won' as const,
      settled: true,
      agreedPrice: 1200,
      quote: { pages: 3, features: [], price: 1200, days: 14, depositPct: 0 },
    };
    const project = createProject(deal, biz, 1);
    useGame.setState({ businesses: [biz, ...s.businesses.slice(1)], deals: [deal], projects: [project] });

    useGame.getState().startProject(project.id);
    for (let i = 0; i < 60 && !allTasksDone(useGame.getState().projects[0]); i++) {
      const p = useGame.getState().projects[0];
      if (p.pendingEvent) useGame.getState().resolveProjectEvent(p.id, 'skip');
      if (useGame.getState().projects[0].pendingEvent) {
        // Pick the first choice for any other event.
        const id = { blurry_photos: 'use', tricky_bug: 'note', tutorial: 'skip', extra_section: 'no' }[useGame.getState().projects[0].pendingEvent!];
        useGame.getState().resolveProjectEvent(p.id, id);
      }
      if (useGame.getState().minute >= 17 * 60) useGame.getState().endDay();
      else useGame.getState().workOnProject(p.id, 8);
    }
    expect(allTasksDone(useGame.getState().projects[0])).toBe(true);
    expect(useGame.getState().skills.design.xp + useGame.getState().skills.design.level).toBeGreaterThan(1);

    const moneyBefore = useGame.getState().money;
    useGame.getState().submitProject(project.id);
    expect(useGame.getState().projects[0].status).toBe('review');
    for (let i = 0; i < 20 && useGame.getState().projects[0].status === 'review'; i++) {
      if (useGame.getState().minute >= 21 * 60) useGame.getState().endDay();
      else useGame.getState().wait(60);
    }
    const after = useGame.getState().projects[0];
    expect(['delivered', 'in_progress']).toContain(after.status);
    if (after.status === 'delivered') {
      expect(after.stars).toBeGreaterThanOrEqual(1);
      expect(useGame.getState().money).toBeGreaterThan(moneyBefore);
    } else {
      expect(after.revisions).toBe(1);
    }
  });
});
