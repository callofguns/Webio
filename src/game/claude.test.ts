import { describe, expect, it } from 'vitest';
import { CLAUDE_PLANS, claudeEffects, planBlocker, TEST_MINUTES } from './claude';

describe('claude plans', () => {
  it('Pro is 50% faster building and does not help with testing', () => {
    expect(claudeEffects('pro')).toMatchObject({ build: 1.5, testMinutes: TEST_MINUTES });
  });

  it('Max is 75% faster building and does half the bug testing', () => {
    expect(claudeEffects('max')).toMatchObject({ build: 1.75, testMinutes: TEST_MINUTES / 2 });
  });

  it('no plan changes nothing and costs nothing', () => {
    expect(claudeEffects('none')).toEqual({ build: 1, testMinutes: TEST_MINUTES, price: 0 });
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
});
