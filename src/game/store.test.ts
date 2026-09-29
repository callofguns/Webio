import { beforeEach, describe, expect, it } from 'vitest';
import { callBlocker, useGame } from './store';
import { DAILY_LIVING_COST, RESEARCH_MINUTES, START_MONEY, WORKDAY_START } from './balance';

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

  it('nobody picks up on Sunday', () => {
    const biz = useGame.getState().businesses[0];
    expect(callBlocker(biz, 7, 10 * 60)).toBe('Businesses are closed');
  });
});
