import { beforeEach, describe, expect, it } from 'vitest';
import { atRisk, pmBoost, PM_BOOST_CAP } from './roles';
import { useGame } from './store';
import { createDeal, toGameTime } from './deals';
import { allTasksDone, createProject } from './projects';
import { FURNITURE, moveBlocker, OFFICES, officeEffects, OFFICE_ORDER } from './office';
import { GOALS } from './goals';
import { WORKDAY_START } from './balance';
import type { Employee, Project, Role } from './types';

const person = (id: string, role: Role, level = 3): Employee => ({
  id, name: `${id} Person`, role, level, xp: 0, pay: 500, traits: ['reliable'], knownTraits: [], morale: 90, hiredDay: -5,
  assignedProjectId: null, carryMinutes: 0, lowMoraleDays: 0, today: { dials: 0, leads: 0, hours: 0, note: '' },
});

describe('project managers', () => {
  it('make builders faster, up to a limit', () => {
    expect(pmBoost([], 1)).toBe(1);
    expect(pmBoost([person('a', 'pm', 3)], 1)).toBeCloseTo(1.1);
    const many = ['a', 'b', 'c', 'd', 'e'].map((id) => person(id, 'pm', 5));
    expect(pmBoost(many, 1)).toBeCloseTo(1 + PM_BOOST_CAP);
    // Not when they're away.
    expect(pmBoost([{ ...person('a', 'pm', 3), dayOff: { day: 1, paid: true } }], 1)).toBe(1);
  });

  it('spot sites that might be late', () => {
    const p = { status: 'in_progress', dueDay: 6, tasks: [{ hours: 10, done: 0, skill: 'design' }] } as unknown as Project;
    expect(atRisk(p, 5)).toBe(true);
    expect(atRisk(p, 1)).toBe(false);
    expect(atRisk({ ...p, status: 'review' } as Project, 5)).toBe(false);
  });
});

describe('new roles in the game', () => {
  beforeEach(() => {
    useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' });
    useGame.setState({ goalsDone: GOALS.map((g) => g.id) });
  });

  function project(over: Partial<Project> = {}) {
    const biz = { ...useGame.getState().businesses[0], status: 'client' as const };
    const deal = { ...createDeal(biz, 70, toGameTime(1, WORKDAY_START)), stage: 'won' as const, settled: true, quote: { pages: 5, features: ['gallery' as const], price: 1500, days: 10, depositPct: 25 } };
    const p = { ...createProject(deal, biz, 1), status: 'in_progress' as const, ...over };
    useGame.setState({ deals: [deal], projects: [p] });
    return p;
  }
  const designDone = () => useGame.getState().projects[0].tasks.filter((t) => t.skill === 'design').reduce((n, t) => n + t.done, 0);

  it('a project manager makes the designers get more done', () => {
    project();
    useGame.setState({ employees: [person('d', 'designer')] });
    useGame.getState().wait(480);
    const alone = designDone();

    useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' });
    useGame.setState({ goalsDone: GOALS.map((g) => g.id) });
    project();
    useGame.setState({ employees: [person('d', 'designer'), person('m', 'pm')] });
    useGame.getState().wait(480);
    expect(designDone()).toBeGreaterThan(alone * 1.05);
  });

  it('a project manager warns you about a site that might be late', () => {
    project({ dueDay: 2 });
    useGame.setState({ employees: [person('m', 'pm')] });
    useGame.getState().wait(60);
    const s = useGame.getState();
    expect(s.log.some((l) => l.text.includes('project manager') && l.text.includes('due'))).toBe(true);
    expect(s.projects[0].pmWarned).toBe(true);
    // Only once.
    const before = s.log.length;
    useGame.getState().wait(60);
    expect(useGame.getState().log.filter((l) => l.text.includes('project manager')).length).toBe(s.log.filter((l) => l.text.includes('project manager')).length);
    expect(useGame.getState().log.length).toBeGreaterThanOrEqual(before);
  });

  it('a QA tester finds bugs on a built site and counts as testing it', () => {
    const p = project();
    const built = { ...p, tasks: p.tasks.map((t) => ({ ...t, done: t.hours, quality: 80 })), hiddenBugs: 6, foundBugs: 0 };
    expect(allTasksDone(built)).toBe(true);
    useGame.setState({ projects: [built], employees: [person('q', 'qa')] });
    useGame.getState().wait(120);
    const after = useGame.getState().projects[0];
    expect(after.foundBugs).toBeGreaterThan(0);
    expect(after.autoTests).toBeGreaterThanOrEqual(1);
    expect(useGame.getState().employees[0].today.note).toContain('Testing');
  });

  it('a support tech fixes crashed sites before you even get the popup', () => {
    const biz = { ...useGame.getState().businesses[0], status: 'client' as const };
    const deal = { ...createDeal(biz, 70, toGameTime(1, WORKDAY_START)), stage: 'won' as const, settled: true, quote: { pages: 4, features: [], price: 1000, days: 10, depositPct: 0 } };
    const live = { ...createProject(deal, biz, 1), status: 'delivered' as const, stars: 3, deliveredDay: 1, plan: 'retainer' as const, retainer: { monthly: 100, nextBillDay: 30, paid: 100, months: 1 } };
    useGame.setState({ money: 1e6, deals: [deal], projects: [live], employees: [{ ...person('t', 'support'), pay: 100 }] });
    let outagePopups = 0;
    for (let i = 0; i < 120; i++) {
      useGame.getState().endDay();
      const ev = useGame.getState().event;
      if (ev?.kind === 'outage') outagePopups++;
      if (ev) useGame.getState().resolveEvent(ev.kind === 'sick' ? 'rest' : 'ok');
      // Keep the support tech happy and on the team.
      useGame.setState({ employees: useGame.getState().employees.map((e) => ({ ...e, morale: 95 })) });
    }
    expect(outagePopups).toBe(0);
    expect(useGame.getState().log.some((l) => l.text.includes('support tech'))).toBe(true);
  });
});

describe('bigger offices and new upgrades', () => {
  it('two new offices come after the loft, bigger and pricier', () => {
    expect(OFFICE_ORDER.slice(-3)).toEqual(['loft', 'floor', 'building']);
    expect(OFFICES.floor.capacity).toBe(20);
    expect(OFFICES.building.capacity).toBe(30);
    expect(OFFICES.building.rent).toBeGreaterThan(OFFICES.floor.rent);
    expect(moveBlocker('floor', 'loft', 99999, 10, 5)).toContain('reputation');
    expect(moveBlocker('floor', 'loft', 99999, 60, 5)).toBeNull();
  });

  it('upgrades do what they say, once you have the office for them', () => {
    const base = officeEffects('floor', []);
    const all = officeEffects('floor', ['standing_desks', 'meeting_room', 'game_room', 'server_room']);
    expect(all.buildSpeed).toBeCloseTo(1.05);
    expect(all.leadWarmth).toBe(base.leadWarmth + 6);
    expect(all.morale).toBe(base.morale + 5);
    expect(all.outageGuard).toBe(true);
    // A server room needs the full floor.
    expect(FURNITURE.server_room.minOffice).toBe('floor');
    expect(officeEffects('loft', ['server_room']).outageGuard).toBe(false);
  });
});
