import { beforeEach, describe, expect, it } from 'vitest';
import { GOAL_BY_ID, GOALS, newlyDone, nextGoals } from './goals';
import { useGame } from './store';
import { START_MONEY } from './balance';

describe('goals', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('there are about twenty, each with a unique id and a reward', () => {
    expect(GOALS.length).toBeGreaterThanOrEqual(18);
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
    for (const g of GOALS) expect(g.reward).toBeGreaterThan(0);
  });

  it('a new game has nothing done yet', () => {
    const s = useGame.getState();
    expect(newlyDone(s, [])).toEqual([]);
    expect(nextGoals([]).map((g) => g.id)).toEqual(['first_call', 'first_lead', 'first_client']);
  });

  it('reaching a goal pays its reward right away, once', () => {
    useGame.setState({ reputation: 15 });
    const s = useGame.getState();
    expect(s.goalsDone).toContain('rep_15');
    expect(s.goalQueue).toContain('rep_15');
    expect(s.money).toBe(START_MONEY + GOAL_BY_ID.rep_15.reward);
    useGame.setState({ reputation: 16 });
    expect(useGame.getState().money).toBe(START_MONEY + GOAL_BY_ID.rep_15.reward);
  });

  it('several at once are all paid and shown together', () => {
    useGame.setState({ office: 'small', claude: 'pro' });
    const s = useGame.getState();
    expect(s.goalQueue).toEqual(expect.arrayContaining(['office', 'claude']));
    expect(s.money).toBe(START_MONEY + GOAL_BY_ID.office.reward + GOAL_BY_ID.claude.reward);
    useGame.getState().dismissGoals();
    expect(useGame.getState().goalQueue).toEqual([]);
    expect(useGame.getState().goalsDone).toEqual(expect.arrayContaining(['office', 'claude']));
  });

  it('a call counts toward the first goal', () => {
    const biz = useGame.getState().businesses[0];
    useGame.getState().beginCall(biz.id);
    for (let i = 0; i < 20 && useGame.getState().activeCall?.phase !== 'ended'; i++) {
      const c = useGame.getState().activeCall!.choices.find((x) => !x.disabled)!;
      useGame.getState().choose(c.id);
    }
    useGame.getState().closeCall();
    expect(useGame.getState().goalsDone).toContain('first_call');
  });
});
