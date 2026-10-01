import { beforeEach, describe, expect, it } from 'vitest';
import { activeFurniture, buyBlocker, moveBlocker, OFFICES, officeEffects } from './office';
import { useGame } from './store';
import { DAILY_LIVING_COST, START_MONEY } from './balance';
import { generateBusiness } from './businesses';
import { startCall, type CallContext } from './calls';
import { generateApplicant, hire, marketPay } from './team';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('offices', () => {
  it('bigger offices fit more people but cost more', () => {
    expect(OFFICES.coworking.capacity).toBeGreaterThan(OFFICES.bedroom.capacity);
    expect(OFFICES.loft.capacity).toBeGreaterThan(OFFICES.small.capacity);
    expect(OFFICES.loft.rent).toBeGreaterThan(OFFICES.small.rent);
  });

  it('equipment only works in an office big enough for it', () => {
    expect(activeFurniture('bedroom', ['laptop', 'chairs'])).toEqual(['laptop']);
    expect(officeEffects('bedroom', ['chairs']).morale).toBe(0);
    expect(officeEffects('small', ['chairs']).morale).toBe(OFFICES.small.morale + 3);
    expect(officeEffects('bedroom', ['laptop', 'monitor']).playerSpeed).toBeCloseTo(1.15 * 1.05);
  });

  it('you need reputation, money and room to move', () => {
    expect(moveBlocker('small', 'bedroom', 5000, 0, 0)).toMatch(/reputation/);
    expect(moveBlocker('small', 'bedroom', 100, 50, 0)).toMatch(/costs/);
    expect(moveBlocker('bedroom', 'small', 5000, 50, 4)).toMatch(/fits/);
    expect(moveBlocker('small', 'bedroom', 5000, 50, 0)).toBeNull();
    expect(buyBlocker('chairs', 'coworking', [], 5000)).toMatch(/small office/);
    expect(buyBlocker('laptop', 'bedroom', ['laptop'], 5000)).toBe('Owned');
  });

  it('a real office address makes cold calls go better', () => {
    const avgInterest = (presence: number) => {
      const rand = seeded(1);
      const ctx: CallContext = { day: 1, minute: 630, playerName: 'A', agencyName: 'B', salesLevel: 1, reputation: 0, presence };
      let total = 0;
      let n = 0;
      for (let i = 0; i < 3000; i++) {
        const call = startCall({ ...generateBusiness(rand), size: 'solo' }, ctx, rand);
        if (call.reachedOwner) {
          total += call.interest;
          n++;
        }
      }
      return total / n;
    };
    expect(avgInterest(10)).toBeGreaterThan(avgInterest(0) + 5);
  });
});

describe('office in the game', () => {
  beforeEach(() => useGame.getState().newGame({ playerName: 'Alex', agencyName: 'Pixel Co' }));

  it('moving costs money and rent is charged every day', () => {
    useGame.setState({ reputation: 10 });
    useGame.getState().moveOffice('coworking');
    expect(useGame.getState().office).toBe('coworking');
    expect(useGame.getState().money).toBe(START_MONEY - OFFICES.coworking.moveIn);
    useGame.getState().endDay();
    expect(useGame.getState().money).toBe(START_MONEY - OFFICES.coworking.moveIn - DAILY_LIVING_COST - OFFICES.coworking.rent);
    expect(useGame.getState().lastDaySummary?.rent).toBe(OFFICES.coworking.rent);
  });

  it('you cannot move somewhere you have no reputation for', () => {
    useGame.getState().moveOffice('loft');
    expect(useGame.getState().office).toBe('bedroom');
    expect(useGame.getState().money).toBe(START_MONEY);
  });

  it('a bigger office lets you hire more people', () => {
    const rand = seeded(2);
    const post = { id: 'p', role: 'sales' as const, board: 'paid' as const, pay: 100, postedDay: 1, endsDay: 8 };
    const team = Array.from({ length: OFFICES.bedroom.capacity }, () => hire({ ...generateApplicant(post, 1, rand), level: 1 }, 80, 1));
    const a = { ...generateApplicant(post, 1, rand), level: 2, traits: [] };
    useGame.setState({ employees: team, applicants: [a], reputation: 10, money: 5000 });
    expect(useGame.getState().makeOffer(a.id, a.askingPay)).toBeNull();
    useGame.getState().moveOffice('coworking');
    expect(useGame.getState().makeOffer(a.id, marketPay('sales', 2) * 2)).not.toBeNull();
  });

  it('buying equipment costs money and is kept', () => {
    useGame.getState().buyFurniture('laptop');
    expect(useGame.getState().furniture).toEqual(['laptop']);
    expect(useGame.getState().money).toBe(START_MONEY - 650);
    useGame.getState().buyFurniture('chairs'); // doesn't fit in a bedroom
    expect(useGame.getState().furniture).toEqual(['laptop']);
  });
});
