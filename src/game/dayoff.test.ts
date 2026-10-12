import { beforeEach, describe, expect, it } from 'vitest';
import { DAY_OFF_COOLDOWN, dayOffBlocker, dayOffDate, PAID_DAY_OFF_MORALE } from './dayoff';
import { useGame } from './store';
import { WORKDAY_START } from './balance';
import type { Employee } from './types';

const worker = (role: Employee['role'] = 'designer'): Employee => ({
  id: 'e1',
  name: 'Zara Chen',
  role,
  level: 2,
  xp: 0,
  pay: 120,
  traits: [],
  knownTraits: [],
  morale: 50,
  hiredDay: 1,
  assignedProjectId: null,
  carryMinutes: 0,
  lowMoraleDays: 0,
  today: { dials: 0, leads: 0, hours: 0, note: '' },
});

describe('day off rules', () => {
  it('is today before work starts, otherwise the next workday', () => {
    expect(dayOffDate(1, WORKDAY_START)).toBe(1); // Monday morning
    expect(dayOffDate(1, WORKDAY_START + 60)).toBe(2);
    expect(dayOffDate(5, WORKDAY_START + 60)).toBe(8); // Friday afternoon -> Monday
    expect(dayOffDate(6, WORKDAY_START)).toBe(8); // Saturday -> Monday
  });

  it('once a week per person, and not while on a course', () => {
    expect(dayOffBlocker(worker(), 3)).toBeNull();
    expect(dayOffBlocker({ ...worker(), lastDayOff: 1 }, 3)).not.toBeNull();
    expect(dayOffBlocker({ ...worker(), lastDayOff: 1 }, 1 + DAY_OFF_COOLDOWN)).toBeNull();
    expect(dayOffBlocker({ ...worker(), training: { course: 'workshop', hoursLeft: 2 } }, 3)).not.toBeNull();
  });
});

describe('giving a day off', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('a paid day off: no work, still paid, much happier', () => {
    useGame.setState({ employees: [worker('sales')] });
    useGame.getState().giveDayOff('e1', true);
    expect(useGame.getState().employees[0].dayOff).toEqual({ day: 1, paid: true });
    useGame.getState().wait(180);
    expect(useGame.getState().employees[0].today.dials).toBe(0);
    useGame.getState().endDay();
    const e = useGame.getState().employees[0];
    expect(e.dayOff).toBeUndefined();
    expect(e.morale).toBeGreaterThan(50 + PAID_DAY_OFF_MORALE - 10);
    expect(useGame.getState().payrollDue).toBe(120);
  });

  it('an unpaid day off saves their wage', () => {
    useGame.setState({ employees: [worker()] });
    useGame.getState().giveDayOff('e1', false);
    useGame.getState().endDay();
    expect(useGame.getState().payrollDue).toBe(0);
    expect(useGame.getState().employees[0].morale).toBeGreaterThan(50);
  });

  it('they work again the next day, and can not get another one right away', () => {
    useGame.setState({ employees: [worker('sales')] });
    useGame.getState().giveDayOff('e1', true);
    useGame.getState().endDay();
    useGame.getState().giveDayOff('e1', true);
    expect(useGame.getState().employees[0].dayOff).toBeUndefined();
    useGame.getState().wait(120);
    expect(useGame.getState().employees[0].today.dials).toBeGreaterThan(0);
  });
});
