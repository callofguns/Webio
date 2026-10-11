import { describe, expect, it } from 'vitest';
import { CLAUDE_PLANS, claudeCost, claudeEffects, planBlocker, seatsFor, TEST_MINUTES } from './claude';

describe('claude plans', () => {
  it('Pro is 50% faster building and does not help with testing', () => {
    expect(claudeEffects('pro')).toMatchObject({ build: 1.5, testMinutes: TEST_MINUTES });
  });

  it('Max is 75% faster building and does half the bug testing', () => {
    expect(claudeEffects('max')).toMatchObject({ build: 1.75, testMinutes: TEST_MINUTES / 2 });
  });

  it('no plan changes nothing and costs nothing', () => {
    expect(claudeEffects('none')).toEqual({ build: 1, testMinutes: TEST_MINUTES, price: 0, teamBuild: 1 });
  });

  it('better plans cost more', () => {
    expect(CLAUDE_PLANS.pro.price).toBeGreaterThan(0);
    expect(CLAUDE_PLANS.max.price).toBeGreaterThan(CLAUDE_PLANS.pro.price);
  });

  it('you cannot pick your current plan or one you cannot pay for', () => {
    expect(planBlocker('pro', 'pro', 1000)).not.toBeNull();
    expect(planBlocker('max', 'none', 5)).not.toBeNull();
    expect(planBlocker('max', 'pro', 1000)).toBeNull();
    expect(planBlocker('none', 'max', 0)).toBeNull();
  });

  it('Enterprise costs $40 a day for every developer, and you count as one', () => {
    expect(CLAUDE_PLANS.enterprise.price).toBe(40);
    // You plus 2 developers is 3 seats.
    expect(seatsFor('enterprise', 2)).toBe(3);
    expect(claudeCost('enterprise', 2)).toBe(120);
    expect(claudeCost('enterprise', 5)).toBe(240);
  });

  it('Enterprise has a minimum of 3 seats, so a solo player pays for 3', () => {
    expect(seatsFor('enterprise', 0)).toBe(3);
    expect(claudeCost('enterprise', 0)).toBe(120);
    expect(claudeCost('enterprise', 1)).toBe(120);
  });

  it('other plans cost the same however big the team is', () => {
    expect(claudeCost('pro', 0)).toBe(20);
    expect(claudeCost('pro', 6)).toBe(20);
    expect(claudeCost('max', 6)).toBe(45);
    expect(claudeCost('none', 6)).toBe(0);
  });

  it('Enterprise gives you Max-level help and speeds up your developers', () => {
    expect(claudeEffects('enterprise')).toMatchObject({ build: 1.75, testMinutes: TEST_MINUTES / 2, teamBuild: 1.5 });
    expect(claudeEffects('max').teamBuild).toBe(1);
  });

  it('you need the money for the first day of all the seats', () => {
    expect(planBlocker('enterprise', 'none', 100, 2)).toMatch(/\$120/);
    expect(planBlocker('enterprise', 'none', 120, 2)).toBeNull();
  });
});
