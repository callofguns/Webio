import { describe, expect, it } from 'vitest';
import { generateBusiness, generateBusinesses } from './businesses';
import { chooseOption, startCall, timeoutCall, type CallContext, type CallState } from './calls';
import type { Business } from './types';

const ctx: CallContext = {
  day: 1,
  minute: 10 * 60 + 30, // 10:30, a good time to call
  playerName: 'Alex',
  agencyName: 'Pixel Co',
  salesLevel: 1,
  reputation: 0,
};

/** Seeded random numbers so tests give the same result every run. */
function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Strategy = (call: CallState, biz: Business) => string;

const randomPlayer = (rand: () => number): Strategy => (call) => {
  const options = call.choices.filter((c) => !c.disabled);
  return options[Math.floor(rand() * options.length)].id;
};

/** Knows the best move every time. */
const expertPlayer: Strategy = (call, biz) => {
  switch (call.phase) {
    case 'voicemail': return 'leave_vm';
    case 'gatekeeper': return 'gk_ask_owner';
    case 'opener': return biz.researched ? 'op_specific' : biz.temperament === 'busy' ? 'op_direct' : 'op_question';
    case 'objection': return 'obj_0';
    case 'close': return call.interest >= 72 ? 'close_meeting' : call.interest >= 45 ? 'close_text' : 'close_later';
    default: return '';
  }
};

function play(biz: Business, strategy: Strategy, rand: () => number): CallState {
  let call = startCall(biz, ctx, rand);
  let guard = 0;
  while (call.phase !== 'ended' && guard++ < 20) {
    call = chooseOption(call, biz, strategy(call, biz), ctx, rand);
  }
  return call;
}

function leadRate(strategy: Strategy, researched: boolean, n = 4000): number {
  const rand = seeded(42);
  let wins = 0;
  for (let i = 0; i < n; i++) {
    const biz = { ...generateBusiness(rand), researched };
    if (play(biz, strategy, rand).outcome === 'interested') wins++;
  }
  return wins / n;
}

describe('cold calls', () => {
  it('always finishes with an outcome', () => {
    const rand = seeded(1);
    for (const biz of generateBusinesses(200, rand)) {
      const call = play(biz, randomPlayer(rand), rand);
      expect(call.phase).toBe('ended');
      expect(call.outcome).not.toBeNull();
      expect(call.minutes).toBeGreaterThan(0);
    }
  });

  it('sounds like a person: no em dashes, no repeated lines, and varied objections', () => {
    const rand = seeded(7);
    const player = randomPlayer(rand);
    const counts: Record<string, number> = {};
    let theirLines = 0;
    let calls = 0;
    for (let i = 0; i < 2000; i++) {
      const call = play({ ...generateBusiness(rand), researched: rand() < 0.5 }, player, rand);
      calls++;
      const them = call.lines.filter((l) => l.speaker === 'them').map((l) => l.text);
      for (const l of call.lines) expect(l.text).not.toContain('\u2014');
      // Nobody says the exact same thing twice in one call.
      expect(new Set(them).size).toBe(them.length);
      for (const t of them) {
        counts[t] = (counts[t] ?? 0) + 1;
        theirLines++;
      }
    }
    expect(calls).toBeGreaterThan(1000);
    // No single line takes over the calls.
    const worst = Math.max(...Object.values(counts));
    expect(worst / theirLines).toBeLessThan(0.08);
    // The old favourites are rare now.
    const family = Object.entries(counts)
      .filter(([t]) => /nephew|son-in-law|daughter does|friend of ours/.test(t))
      .reduce((n, [, c]) => n + c, 0);
    expect(family / calls).toBeLessThan(0.06);
    expect(Object.keys(counts).length).toBeGreaterThan(80);
    expect(counts['Okay… I’m listening.']).toBeUndefined();
  });

  it('does not change the business passed in', () => {
    const rand = seeded(2);
    const biz = generateBusiness(rand);
    const copy = JSON.stringify(biz);
    play(biz, expertPlayer, rand);
    expect(JSON.stringify(biz)).toBe(copy);
  });

  it('ignores disabled choices', () => {
    const rand = seeded(3);
    const biz = { ...generateBusiness(rand), size: 'solo' as const, researched: false };
    let call = startCall(biz, ctx, rand);
    for (let i = 0; i < 50 && call.phase !== 'opener'; i++) call = startCall(biz, ctx, rand);
    expect(chooseOption(call, biz, 'op_specific', ctx, rand)).toBe(call);
  });

  it('is hard: good play wins a few percent of dials, random play wins far fewer', () => {
    const random = leadRate(randomPlayer(seeded(9)), false);
    const expert = leadRate(expertPlayer, false);
    const expertResearched = leadRate(expertPlayer, true);
    console.log(`lead rate per dial — random: ${(random * 100).toFixed(1)}%, expert: ${(expert * 100).toFixed(1)}%, expert+research: ${(expertResearched * 100).toFixed(1)}%`);
    expect(random).toBeLessThan(0.04);
    expect(expert).toBeGreaterThan(random * 1.5);
    expect(expertResearched).toBeGreaterThan(expert);
    expect(expertResearched).toBeLessThan(0.2);
  });
});

describe('answer timer', () => {
  /** Starts calls until one reaches the given phase. */
  function callIn(phase: CallState['phase'], seed: number, patch: Partial<Business> = {}) {
    const rand = seeded(seed);
    for (let i = 0; i < 500; i++) {
      const biz = { ...generateBusiness(rand), ...patch };
      const call = startCall(biz, ctx, rand);
      if (call.phase === phase) return { biz, call };
    }
    throw new Error(`never reached ${phase}`);
  }

  it('a front desk hangs up if you go quiet', () => {
    const { biz, call } = callIn('gatekeeper', 10, { size: 'medium' });
    const after = timeoutCall(call, biz);
    expect(after.phase).toBe('ended');
    expect(after.outcome).toBe('blocked');
  });

  it('a voicemail cuts off if you go quiet', () => {
    const { biz, call } = callIn('voicemail', 11);
    expect(timeoutCall(call, biz).outcome).toBe('no_answer');
  });

  it('owners lose interest when you go quiet, then hang up', () => {
    const { biz, call } = callIn('opener', 12, { size: 'solo', temperament: 'skeptical' });
    const once = timeoutCall(call, biz);
    expect(once.phase).toBe('opener');
    expect(once.interest).toBeLessThanOrEqual(call.interest);
    expect(once.patience).toBe(call.patience - 1);
    expect(once.choices).toEqual(call.choices);
    let c = once;
    for (let i = 0; i < 5 && c.phase !== 'ended'; i++) c = timeoutCall(c, biz);
    expect(c.phase).toBe('ended');
    expect(['not_interested', 'do_not_call']).toContain(c.outcome);
  });
});
