import { beforeEach, describe, expect, it } from 'vitest';
import { callBlocker, useGame } from './store';
import { DAILY_LIVING_COST, RESEARCH_MINUTES, START_MONEY, WORKDAY_START } from './balance';
import { createDeal, toGameTime } from './deals';
import { allTasksDone, createProject, designFit, isDefaultDesign } from './projects';
import { CLAUDE_PLANS } from './claude';
import { COURSES } from './training';
import { pipelineCap } from './closer';

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
    // Nothing is paid until their "yes" actually arrives. (Sometimes a free
    // client answers on the spot, and then it's paid straight away.)
    const sent = useGame.getState();
    const answeredAlready = sent.deals[0].closedAt! <= toGameTime(sent.day, sent.minute);
    expect(sent.money).toBe(answeredAlready ? START_MONEY + Math.round(price / 2) : START_MONEY);

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

describe('Claude subscription', () => {
  /** A client site you've started, with nothing built yet. */
  function startedProject() {
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
    return project.id;
  }

  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('starts with no plan and can subscribe, switch and cancel', () => {
    expect(useGame.getState().claude).toBe('none');
    useGame.getState().setClaudePlan('pro');
    expect(useGame.getState().claude).toBe('pro');
    useGame.getState().setClaudePlan('max');
    expect(useGame.getState().claude).toBe('max');
    useGame.getState().setClaudePlan('none');
    expect(useGame.getState().claude).toBe('none');
  });

  it('cannot subscribe without the money for the first day', () => {
    useGame.setState({ money: 10 });
    useGame.getState().setClaudePlan('pro');
    expect(useGame.getState().claude).toBe('none');
  });

  it('is charged every evening, and shows in the day summary', () => {
    useGame.getState().setClaudePlan('max');
    useGame.getState().endDay();
    const s = useGame.getState();
    expect(s.money).toBe(START_MONEY - DAILY_LIVING_COST - CLAUDE_PLANS.max.price);
    expect(s.lastDaySummary?.claude).toBe(CLAUDE_PLANS.max.price);
    // And cancelling stops the charge.
    useGame.getState().setClaudePlan('none');
    const before = useGame.getState().money;
    useGame.getState().endDay();
    expect(useGame.getState().money).toBe(before - DAILY_LIVING_COST);
  });

  it('Pro builds 50% faster and Max 75% faster', () => {
    const progress = (plan: 'none' | 'pro' | 'max') => {
      useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' });
      const id = startedProject();
      useGame.getState().setClaudePlan(plan);
      useGame.getState().workOnProject(id, 1);
      return useGame.getState().projects[0].tasks[0].done;
    };
    expect(progress('none')).toBeCloseTo(1);
    expect(progress('pro')).toBeCloseTo(1.5);
    expect(progress('max')).toBeCloseTo(1.75);
  });

  it('Max halves the time a bug test takes, Pro does not', () => {
    const testTime = (plan: 'none' | 'pro' | 'max') => {
      useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' });
      const id = startedProject();
      useGame.getState().setClaudePlan(plan);
      const before = useGame.getState().minute;
      useGame.getState().testProject(id);
      return useGame.getState().minute - before;
    };
    expect(testTime('none')).toBe(60);
    expect(testTime('pro')).toBe(60);
    expect(testTime('max')).toBe(30);
  });
});

describe('monthly retainers', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('pay nothing up front, pay the first month when the site goes live, then every 30 days', () => {
    const s = useGame.getState();
    const biz = { ...s.businesses[0], status: 'client' as const };
    const deal = {
      ...createDeal(biz, 80, toGameTime(1, 600)),
      stage: 'won' as const,
      settled: true,
      plan: 'retainer' as const,
      agreedPrice: 1200,
      quote: { pages: 3, features: [], price: 1200, days: 14, depositPct: 50, plan: 'retainer' as const },
    };
    const project = createProject(deal, biz, 1);
    // No deposit, even though the quote said 50%.
    expect(project.plan).toBe('retainer');
    expect(project.depositPaid).toBe(0);

    // The client has looked at the finished site and loves it.
    const t = toGameTime(s.day, s.minute);
    useGame.setState({
      businesses: [biz, ...s.businesses.slice(1)],
      deals: [deal],
      projects: [{ ...project, status: 'review', review: { at: t - 1, approved: true, stars: 4, satisfaction: 85, feedback: null } }],
    });
    const before = useGame.getState().money;
    useGame.getState().wait(10);
    let p = useGame.getState().projects[0];
    expect(p.status).toBe('delivered');
    // 1,200 / 10 = 120 a month, first month paid now.
    expect(useGame.getState().money).toBe(before + 120);
    expect(p.retainer).toMatchObject({ monthly: 120, paid: 120, months: 1, nextBillDay: 1 + 30 });

    // 29 more days: nothing yet. On day 31 the next payment lands.
    for (let i = 0; i < 29; i++) useGame.getState().endDay();
    expect(useGame.getState().day).toBe(30);
    expect(useGame.getState().projects[0].retainer?.months).toBe(1);
    useGame.getState().endDay();
    expect(useGame.getState().day).toBe(31);
    p = useGame.getState().projects[0];
    expect(p.retainer).toMatchObject({ paid: 240, months: 2, nextBillDay: 61 });
    // And it keeps going, forever.
    for (let i = 0; i < 30; i++) useGame.getState().endDay();
    expect(useGame.getState().projects[0].retainer?.months).toBe(3);
  });

  it('a buyout client still pays the rest of the price on delivery', () => {
    const s = useGame.getState();
    const biz = { ...s.businesses[0], status: 'client' as const };
    const deal = {
      ...createDeal(biz, 80, toGameTime(1, 600)),
      stage: 'won' as const,
      settled: true,
      plan: 'buyout' as const,
      agreedPrice: 1000,
      quote: { pages: 3, features: [], price: 1000, days: 14, depositPct: 0, plan: 'buyout' as const },
    };
    const project = createProject(deal, biz, 1);
    const t = toGameTime(s.day, s.minute);
    useGame.setState({
      businesses: [biz, ...s.businesses.slice(1)],
      deals: [deal],
      projects: [{ ...project, status: 'review', review: { at: t - 1, approved: true, stars: 4, satisfaction: 85, feedback: null } }],
    });
    const before = useGame.getState().money;
    useGame.getState().wait(10);
    expect(useGame.getState().money).toBe(before + 1000);
    expect(useGame.getState().projects[0].retainer).toBeUndefined();
  });
});

describe('designers and developers find their own work', () => {
  const person = (id: string, role: 'designer' | 'developer', assignedProjectId: string | null = null) => ({
    id,
    name: `Person ${id}`,
    role,
    level: 2,
    xp: 0,
    pay: 100,
    traits: [],
    knownTraits: [],
    morale: 80,
    hiredDay: 1,
    assignedProjectId,
    carryMinutes: 0,
    lowMoraleDays: 0,
    today: { dials: 0, leads: 0, hours: 0, note: '' },
  });

  /** Two client sites, each with a name, ready to work on. */
  function twoProjects(started: [boolean, boolean] = [true, true]) {
    const s = useGame.getState();
    const bizList = s.businesses.slice(0, 2).map((b) => ({ ...b, status: 'client' as const }));
    const make = (i: number, started: boolean, due: number) => {
      const deal = {
        ...createDeal(bizList[i], 80, toGameTime(1, 600)),
        stage: 'won' as const,
        settled: true,
        agreedPrice: 1200,
        quote: { pages: 3, features: [], price: 1200, days: due, depositPct: 0 },
      };
      const p = createProject(deal, bizList[i], 1);
      return { deal, project: { ...p, status: started ? ('in_progress' as const) : ('not_started' as const) } };
    };
    const a = make(0, started[0], 10);
    const b = make(1, started[1], 20);
    useGame.setState({
      businesses: [...bizList, ...s.businesses.slice(2)],
      deals: [a.deal, b.deal],
      projects: [a.project, b.project],
    });
    return [a.project, b.project];
  }

  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('a designer with nothing assigned picks up design work, soonest due first', () => {
    const [a] = twoProjects();
    useGame.setState({ employees: [person('d1', 'designer')] });
    useGame.getState().wait(60);
    const s = useGame.getState();
    expect(s.employees[0].assignedProjectId).toBe(a.id);
    expect(s.projects[0].tasks.find((t) => t.label === 'Design the home page')!.done).toBeGreaterThan(0);
    expect(s.log.some((l) => l.text.includes('found design work'))).toBe(true);
  });

  it('two free designers spread over two projects', () => {
    const [a, b] = twoProjects();
    useGame.setState({ employees: [person('d1', 'designer'), person('d2', 'designer')] });
    useGame.getState().wait(60);
    const ids = useGame.getState().employees.map((e) => e.assignedProjectId);
    expect(new Set(ids)).toEqual(new Set([a.id, b.id]));
  });

  it('a designer moves on when the design work on their project is finished', () => {
    const [a, b] = twoProjects();
    const doneDesign = { ...a, tasks: a.tasks.map((t) => (t.skill === 'design' ? { ...t, done: t.hours, quality: 70 } : t)) };
    useGame.setState({ projects: [doneDesign, b], employees: [person('d1', 'designer', a.id)] });
    useGame.getState().wait(60);
    expect(useGame.getState().employees[0].assignedProjectId).toBe(b.id);
  });

  it('does not do design work on projects that have not been started, but plans them instead', () => {
    const [a] = twoProjects([false, false]);
    useGame.setState({ employees: [person('d1', 'designer')] });
    useGame.getState().wait(60);
    const e = useGame.getState().employees[0];
    expect(e.assignedProjectId).toBeNull();
    // Their hour went on asking the client about style, not on building.
    expect(e.today.note).toMatch(/style/i);
    expect(useGame.getState().projects.find((p) => p.id === a.id)!.tasks.every((t) => t.done === 0)).toBe(true);
    expect(useGame.getState().projects.find((p) => p.id === a.id)!.status).toBe('not_started');
  });

  it('a designer you assigned by hand stays on that project while it has design work', () => {
    const [, b] = twoProjects();
    useGame.setState({ employees: [person('d1', 'designer', b.id)] });
    useGame.getState().wait(60);
    expect(useGame.getState().employees[0].assignedProjectId).toBe(b.id);
  });

  it('developers find coding work on their own too', () => {
    const [a] = twoProjects();
    useGame.setState({ employees: [person('v1', 'developer')] });
    useGame.getState().wait(60);
    const s = useGame.getState();
    expect(s.employees[0].assignedProjectId).toBe(a.id);
    expect(s.projects[0].tasks.find((t) => t.label === 'Set up hosting and site structure')!.done).toBeGreaterThan(0);
    expect(s.log.some((l) => l.text.includes('found development work'))).toBe(true);
  });

  it('a designer and a developer each pick work of their own kind and do not count as each other\'s crowd', () => {
    const [a] = twoProjects();
    useGame.setState({ employees: [person('d1', 'designer'), person('v1', 'developer')] });
    useGame.getState().wait(60);
    // Both go to the soonest-due project: one design hour and one coding hour don't crowd each other.
    expect(useGame.getState().employees.map((e) => e.assignedProjectId)).toEqual([a.id, a.id]);
  });

  it('two free developers spread over two projects', () => {
    const [a, b] = twoProjects();
    useGame.setState({ employees: [person('v1', 'developer'), person('v2', 'developer')] });
    useGame.getState().wait(60);
    expect(new Set(useGame.getState().employees.map((e) => e.assignedProjectId))).toEqual(new Set([a.id, b.id]));
  });

  it('a developer moves on when the coding on their project is finished', () => {
    const [a, b] = twoProjects();
    const doneCoding = { ...a, tasks: a.tasks.map((t) => (t.skill === 'development' ? { ...t, done: t.hours, quality: 70 } : t)) };
    useGame.setState({ projects: [doneCoding, b], employees: [person('v1', 'developer', a.id)] });
    useGame.getState().wait(60);
    expect(useGame.getState().employees[0].assignedProjectId).toBe(b.id);
  });

  it('a developer with no started projects waits', () => {
    twoProjects([false, false]);
    useGame.setState({ employees: [person('v1', 'developer')] });
    useGame.getState().wait(60);
    const e = useGame.getState().employees[0];
    expect(e.assignedProjectId).toBeNull();
    expect(e.today.note).toMatch(/No development work/);
  });
});

describe('courses', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  const person = (role: 'sales' | 'designer' | 'developer', level = 2) => ({
    id: 'e1',
    name: 'Maya Haddad',
    role,
    level,
    xp: 0,
    pay: 100,
    traits: [],
    knownTraits: [],
    morale: 60,
    hiredDay: 1,
    assignedProjectId: null,
    carryMinutes: 0,
    lowMoraleDays: 0,
    today: { dials: 0, leads: 0, hours: 0, note: '' },
  });

  it('taking a course costs money and time and gives experience', () => {
    useGame.getState().takeCourse('design', 'workshop');
    const s = useGame.getState();
    expect(s.money).toBe(START_MONEY - COURSES.workshop.cost);
    expect(s.minute).toBe(WORKDAY_START + COURSES.workshop.hours * 60);
    // 70 XP is not quite enough for level 2 (100 XP).
    expect(s.skills.design.level).toBe(1);
    expect(s.skills.design.xp).toBe(COURSES.workshop.xp);
    expect(s.today.moneyOut).toBe(COURSES.workshop.cost);
  });

  it('two workshops in a row would level you up, but you only get one course a day', () => {
    useGame.getState().takeCourse('sales', 'workshop');
    useGame.getState().takeCourse('sales', 'workshop');
    expect(useGame.getState().skills.sales.xp).toBe(COURSES.workshop.xp);
    useGame.getState().endDay();
    useGame.getState().takeCourse('sales', 'workshop');
    expect(useGame.getState().skills.sales.level).toBe(2);
  });

  it('refuses courses that are too advanced or too expensive', () => {
    useGame.getState().takeCourse('design', 'masterclass');
    expect(useGame.getState().money).toBe(START_MONEY);
    useGame.setState({ money: 10 });
    useGame.getState().takeCourse('design', 'workshop');
    expect(useGame.getState().skills.design.xp).toBe(0);
  });

  it('an employee on a course stops working, then comes back with experience', () => {
    useGame.setState({ employees: [person('sales')] });
    useGame.getState().trainEmployee('e1', 'workshop');
    expect(useGame.getState().money).toBe(START_MONEY - COURSES.workshop.cost);
    expect(useGame.getState().employees[0].training).toEqual({ course: 'workshop', hoursLeft: 2 });
    expect(useGame.getState().employees[0].morale).toBe(65);
    useGame.getState().wait(60);
    let e = useGame.getState().employees[0];
    expect(e.training?.hoursLeft).toBe(1);
    expect(e.today.dials).toBe(0);
    useGame.getState().wait(60);
    e = useGame.getState().employees[0];
    expect(e.training).toBeUndefined();
    expect(e.xp).toBe(COURSES.workshop.xp * 2);
    expect(e.today.dials).toBe(0);
    // Next hour they're calling again.
    useGame.getState().wait(60);
    expect(useGame.getState().employees[0].today.dials).toBeGreaterThan(0);
  });

  it('enough course experience levels an employee up', () => {
    useGame.setState({ employees: [person('developer', 2)] });
    useGame.getState().trainEmployee('e1', 'course');
    useGame.getState().wait(4 * 60);
    // Level 2 to 3 takes 2 x 283 = 566 XP. The course teaches 220 x 2 = 440, so not yet.
    expect(useGame.getState().employees[0].level).toBe(2);
    expect(useGame.getState().employees[0].xp).toBe(440);
  });

  it('cannot send someone on a second course while they are away', () => {
    useGame.setState({ employees: [person('designer')] });
    useGame.getState().trainEmployee('e1', 'workshop');
    useGame.getState().trainEmployee('e1', 'course');
    expect(useGame.getState().money).toBe(START_MONEY - COURSES.workshop.cost);
  });
});

describe('sales people closing deals on their own', () => {
  const caller = (level: number) => ({
    id: 's1',
    name: 'Leo Silva',
    role: 'sales' as const,
    level,
    xp: 0,
    // Paid well and happy, so they don't quit while the test waits for a lead.
    pay: 600,
    traits: ['people_person' as const, 'reliable' as const],
    knownTraits: [],
    morale: 100,
    hiredDay: 1,
    assignedProjectId: null,
    carryMinutes: 0,
    lowMoraleDays: 0,
    today: { dials: 0, leads: 0, hours: 0, note: '' },
  });

  /** Lets a work day pass again and again until the caller brings in a lead. */
  function untilLead() {
    for (let i = 0; i < 400 && useGame.getState().deals.length === 0; i++) {
      const s = useGame.getState();
      if (s.minute >= 17 * 60) useGame.getState().endDay();
      else useGame.getState().wait(60);
    }
    return useGame.getState().deals[0];
  }

  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('a level 5 caller carries a lead all the way through the texts', () => {
    useGame.setState({ employees: [caller(5)] });
    const deal = untilLead();
    expect(deal).toBeDefined();
    expect(deal.messages.some((m) => m.text.includes('is handling the texts'))).toBe(true);
    expect(deal.messages.filter((m) => m.from === 'you').length).toBeGreaterThanOrEqual(3);
    expect(deal.messages.some((m) => m.quote)).toBe(true);
    expect(['won', 'lost', 'discovery', 'negotiating']).toContain(deal.stage);

    // Let the days go by. If it was won, it ends up in Projects without you lifting a finger.
    for (let i = 0; i < 12; i++) useGame.getState().endDay();
    const s = useGame.getState();
    const d = s.deals.find((x) => x.id === deal.id)!;
    if (d.stage === 'won') {
      expect(s.projects.some((p) => p.dealId === d.id)).toBe(true);
      expect(s.log.some((l) => l.text.includes('Contract signed'))).toBe(true);
    }
  });

  it('a lower level caller only hands you the lead', () => {
    useGame.setState({ employees: [caller(3)] });
    const deal = untilLead();
    expect(deal.stage).toBe('intro');
    // Nobody has texted the client for you. (They might have nudged you if the lead came in late in the day.)
    expect(deal.messages.some((m) => m.from === 'you' || m.text.includes('is handling the texts'))).toBe(false);
  });

  it('closers stop signing when you already have too many sites on the go', () => {
    const s = useGame.getState();
    const biz = { ...s.businesses[0], status: 'client' as const };
    const busy = Array.from({ length: pipelineCap(0) }, (_, i) => {
      const deal = { ...createDeal(biz, 80, toGameTime(1, 600)), stage: 'won' as const, settled: true, agreedPrice: 1000, quote: { pages: 3, features: [], price: 1000, days: 14, depositPct: 0 } };
      return { deal, project: { ...createProject(deal, biz, 1), id: `busy${i}` } };
    });
    useGame.setState({ employees: [caller(5)], deals: busy.map((b) => b.deal), projects: busy.map((b) => b.project) });
    const before = useGame.getState().deals.length;
    for (let i = 0; i < 400 && useGame.getState().deals.length === before; i++) {
      if (useGame.getState().minute >= 17 * 60) useGame.getState().endDay();
      else useGame.getState().wait(60);
    }
    const fresh = useGame.getState().deals.at(-1)!;
    expect(useGame.getState().deals.length).toBeGreaterThan(before);
    expect(fresh.stage).toBe('intro');
    expect(fresh.messages.some((m) => m.from === 'you' || m.text.includes('is handling the texts'))).toBe(false);
  });
});

describe('designers plan new projects', () => {
  const designer = (level = 3) => ({
    id: 'd1',
    name: 'Zara Chen',
    role: 'designer' as const,
    level,
    xp: 0,
    pay: 120,
    traits: [],
    knownTraits: [],
    morale: 80,
    hiredDay: 1,
    assignedProjectId: null,
    carryMinutes: 0,
    lowMoraleDays: 0,
    today: { dials: 0, leads: 0, hours: 0, note: '' },
  });

  /** A signed client whose site hasn't been planned or started. */
  function unplanned() {
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
    return { biz, deal, project };
  }

  /** Lets work hours pass until the project has been started. */
  function untilStarted() {
    for (let i = 0; i < 80 && useGame.getState().projects[0].status === 'not_started'; i++) {
      if (useGame.getState().minute >= 17 * 60) useGame.getState().endDay();
      else useGame.getState().wait(60);
    }
  }

  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('a designer asks the client about their style first', () => {
    const { deal } = unplanned();
    useGame.setState({ employees: [designer()] });
    useGame.getState().wait(60);
    const s = useGame.getState();
    expect(s.projects[0].tasteAt).not.toBeNull();
    // They don't start until the client has answered.
    expect(s.projects[0].status === 'not_started' || s.projects[0].tasteAt! <= toGameTime(s.day, s.minute)).toBe(true);
    const thread = s.deals.find((d) => d.id === deal.id)!;
    expect(thread.messages.some((m) => m.from === 'you' && m.text.includes('what kind of style'))).toBe(true);
    expect(thread.messages.some((m) => m.from === 'them' && m.t === s.projects[0].tasteAt)).toBe(true);
  });

  it('then they pick a design that suits the client and start the project', () => {
    const { biz, project } = unplanned();
    useGame.setState({ employees: [designer(4)] });
    untilStarted();
    const p = useGame.getState().projects[0];
    expect(p.status).toBe('in_progress');
    expect(isDefaultDesign(p.design)).toBe(false);
    expect(designFit(p, biz).total).toBeGreaterThanOrEqual(designFit(project, biz).total);
    expect(useGame.getState().log.some((l) => l.text.includes('planned') && l.text.includes('started the project'))).toBe(true);
  });

  it('a project you designed yourself is left alone', () => {
    const { project } = unplanned();
    const mine = { ...project, design: { ...project.design, palette: 'earth' as const } };
    useGame.setState({ projects: [mine], employees: [designer()] });
    useGame.getState().wait(8 * 60);
    expect(useGame.getState().projects[0].status).toBe('not_started');
    expect(useGame.getState().projects[0].design.palette).toBe('earth');
    expect(useGame.getState().projects[0].tasteAt).toBeNull();
  });

  it('developers wait for the designer to plan, then get to work', () => {
    unplanned();
    const dev = { ...designer(), id: 'v1', name: 'Kai Park', role: 'developer' as const };
    useGame.setState({ employees: [designer(), dev] });
    useGame.getState().wait(60);
    expect(useGame.getState().employees[1].today.note).toMatch(/planned/i);
    untilStarted();
    for (let i = 0; i < 6; i++) {
      if (useGame.getState().minute >= 17 * 60) useGame.getState().endDay();
      else useGame.getState().wait(60);
    }
    expect(useGame.getState().employees[1].assignedProjectId).toBe(useGame.getState().projects[0].id);
  });
});
