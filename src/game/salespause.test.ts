import { beforeEach, describe, expect, it } from 'vitest';
import { useGame } from './store';
import type { Employee } from './types';

const caller = (): Employee => ({
  id: 's1', name: 'Leo Silva', role: 'sales', level: 3, xp: 0, pay: 600,
  traits: ['reliable'], knownTraits: [], morale: 90, hiredDay: 1, assignedProjectId: null,
  carryMinutes: 0, lowMoraleDays: 0, today: { dials: 0, leads: 0, hours: 0, note: '' },
});

describe('pausing sales', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('paused salespeople make no calls and bring in no deals, and restart when you say so', () => {
    useGame.setState({ employees: [caller()] });
    useGame.getState().setSalesPaused(true);
    useGame.getState().wait(240);
    let s = useGame.getState();
    expect(s.employees[0].today.dials).toBe(0);
    expect(s.employees[0].today.note).toContain('Paused');
    expect(s.deals).toHaveLength(0);

    useGame.getState().setSalesPaused(false);
    useGame.getState().wait(120);
    s = useGame.getState();
    expect(s.employees[0].today.dials).toBeGreaterThan(0);
  });

  it('stays paused overnight until you turn it back on', () => {
    useGame.setState({ employees: [caller()] });
    useGame.getState().setSalesPaused(true);
    useGame.getState().endDay();
    useGame.getState().wait(180);
    expect(useGame.getState().salesPaused).toBe(true);
    expect(useGame.getState().employees[0].today.dials).toBe(0);
  });
});
