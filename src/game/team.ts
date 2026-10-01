// Hiring and running a team.
//
//   Post a job -> applicants trickle in over days -> interview / test -> offer
//   -> they work on their own during work hours -> paid every Friday
//
// Employees work in the background whenever game time passes during work
// hours (9 AM - 6 PM, Monday to Friday). Sales callers phone businesses and
// bring in leads. Designers and developers work on the project you assign.

import type { Applicant, Business, Employee, JobBoard, JobPost, Role, Trait } from './types';
import { chance, clamp, pick, randInt, shuffle, uid, weighted, type Rand, defaultRand } from './rng';
import { DAILY_LIVING_COST, NOT_INTERESTED_COOLDOWN, WORKDAY_END, WORKDAY_START, xpForLevel } from './balance';

// ---------------------------------------------------------------------------
// Roles, pay and traits

export const ROLES: Record<Role, { label: string; plural: string; does: string }> = {
  sales: { label: 'Sales caller', plural: 'Sales callers', does: 'Calls businesses for you and passes on the interested ones.' },
  designer: { label: 'Designer', plural: 'Designers', does: 'Does the design tasks on the project you assign.' },
  developer: { label: 'Developer', plural: 'Developers', does: 'Does the coding tasks on the project you assign.' },
};

/** What someone at this level usually earns per day. */
export function marketPay(role: Role, level: number): number {
  const [base, perLevel] = { sales: [50, 15], designer: [60, 20], developer: [65, 25] }[role];
  return base + perLevel * level;
}

export const TRAITS: Record<Trait, { label: string; good: boolean; text: string }> = {
  reliable: { label: 'Reliable', good: true, text: 'Shows up, stays happy, rarely quits.' },
  fast_learner: { label: 'Fast learner', good: true, text: 'Gets better twice as fast.' },
  perfectionist: { label: 'Perfectionist', good: true, text: 'Better quality, but a bit slower.' },
  people_person: { label: 'People person', good: true, text: 'Great on the phone. More leads.' },
  lazy: { label: 'Lazy', good: false, text: 'Gets less done.' },
  sloppy: { label: 'Sloppy', good: false, text: 'More bugs, lower quality.' },
};

export const MAX_LEVEL = 5;

/** Average money going out per day: living costs, rent, and wages (paid 5 days a week). */
export function dailyBurn(employees: Employee[], rent = 0): number {
  return DAILY_LIVING_COST + rent + (employees.reduce((n, e) => n + e.pay, 0) * 5) / 7;
}

// ---------------------------------------------------------------------------
// Job boards

export interface BoardInfo {
  label: string;
  description: string;
  /** Cost to post for a week. */
  cost: number;
  /** Chance of at least one applicant each day. */
  dailyChance: number;
  /** Chance of a second applicant on the same day. */
  extraChance: number;
  levels: Record<number, number>;
  /** Chance an applicant exaggerates their résumé. */
  exaggerate: number;
  /** Reputation needed to use this board. */
  reputation: number;
}

export const BOARDS: Record<JobBoard, BoardInfo> = {
  free: {
    label: 'Free job board',
    description: 'Costs nothing. Few people apply, and most are beginners.',
    cost: 0,
    dailyChance: 0.35,
    extraChance: 0.05,
    levels: { 1: 6, 2: 3, 3: 1 },
    exaggerate: 0.5,
    reputation: 0,
  },
  paid: {
    label: 'Paid job site',
    description: 'More applicants and better ones.',
    cost: 90,
    dailyChance: 0.6,
    extraChance: 0.25,
    levels: { 1: 3, 2: 4, 3: 3, 4: 1 },
    exaggerate: 0.35,
    reputation: 0,
  },
  referral: {
    label: 'Ask your network',
    description: 'Past clients recommend people. Few, but good and honest.',
    cost: 0,
    dailyChance: 0.22,
    extraChance: 0,
    levels: { 2: 2, 3: 4, 4: 3, 5: 1 },
    exaggerate: 0.05,
    reputation: 12,
  },
};

export const POST_DAYS = 7;

// ---------------------------------------------------------------------------
// Applicants

const FIRST = ['Jordan', 'Maya', 'Leo', 'Sofia', 'Ethan', 'Zara', 'Noah', 'Ava', 'Kai', 'Lena', 'Ravi', 'Chloe', 'Marcus', 'Ines', 'Theo', 'Hana', 'Diego', 'Yuki', 'Sam', 'Nora'];
const LAST = ['Walsh', 'Okafor', 'Silva', 'Chen', 'Novak', 'Haddad', 'Park', 'Larsen', 'Rossi', 'Ahmed', 'Keller', 'Duarte', 'Ito', 'Moreau'];

function rollTraits(role: Role, rand: Rand): Trait[] {
  const pool: Trait[] = ['reliable', 'fast_learner', 'lazy', 'perfectionist', 'sloppy'];
  if (role === 'sales') pool.push('people_person', 'people_person');
  const count = chance(0.45, rand) ? 2 : 1;
  const out: Trait[] = [];
  for (const t of shuffle(pool, rand)) {
    if (out.length >= count) break;
    if (out.includes(t)) continue;
    // Some traits don't go together.
    if ((t === 'lazy' && out.includes('fast_learner')) || (t === 'sloppy' && out.includes('perfectionist'))) continue;
    if ((t === 'fast_learner' && out.includes('lazy')) || (t === 'perfectionist' && out.includes('sloppy'))) continue;
    out.push(t);
  }
  return out;
}

export function generateApplicant(post: JobPost, day: number, rand: Rand = defaultRand): Applicant {
  const board = BOARDS[post.board];
  // Offering more than the going rate attracts better people.
  const payBoost = post.pay >= marketPay(post.role, 3) ? 1 : post.pay <= marketPay(post.role, 1) ? -1 : 0;
  const level = clamp(Number(weighted(board.levels as Record<string, number>, rand)) + (payBoost && chance(0.4, rand) ? payBoost : 0), 1, MAX_LEVEL);
  const claimedLevel = chance(board.exaggerate, rand) ? clamp(level + randInt(1, 2, rand), 1, MAX_LEVEL) : level;
  const market = marketPay(post.role, level);
  const minPay = Math.round((market * (0.85 + rand() * 0.2)) / 5) * 5;
  // They ask for more than their minimum, based on what they claim they're worth.
  const askingPay = Math.max(minPay, Math.round((marketPay(post.role, claimedLevel) * (1 + rand() * 0.15)) / 5) * 5);
  return {
    id: uid('app'),
    name: `${pick(FIRST, rand)} ${pick(LAST, rand)}`,
    role: post.role,
    level,
    claimedLevel,
    years: clamp(claimedLevel * 2 + randInt(-1, 2, rand), 0, 15),
    traits: rollTraits(post.role, rand),
    knownTraits: [],
    askingPay,
    minPay,
    interviewed: false,
    tested: false,
    appliedDay: day,
    // Better people get snapped up faster.
    leavesDay: day + clamp(randInt(3, 7, rand) - (level >= 4 ? 2 : 0), 2, 7),
    counter: null,
  };
}

/** New applicants for one job post on one day. */
export function dailyApplicants(post: JobPost, day: number, rand: Rand = defaultRand): Applicant[] {
  const board = BOARDS[post.board];
  const payFactor = clamp(post.pay / marketPay(post.role, 2), 0.5, 1.6);
  const out: Applicant[] = [];
  if (chance(board.dailyChance * payFactor, rand)) {
    out.push(generateApplicant(post, day, rand));
    if (chance(board.extraChance * payFactor, rand)) out.push(generateApplicant(post, day, rand));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Interviews and offers

export const INTERVIEW_MINUTES = 60;
export const TEST_MINUTES = 30;

/** An interview reveals one hidden trait. */
export function interview(a: Applicant, rand: Rand = defaultRand): Applicant {
  if (a.interviewed) return a;
  const unknown = a.traits.filter((t) => !a.knownTraits.includes(t));
  return { ...a, interviewed: true, knownTraits: unknown.length ? [...a.knownTraits, pick(unknown, rand)] : a.knownTraits };
}

/** A small paid test task shows how good they really are. */
export function testTask(a: Applicant): Applicant {
  return { ...a, tested: true };
}

export type OfferResult = { kind: 'accept' } | { kind: 'counter'; pay: number } | { kind: 'decline'; reason: string };

/**
 * Whether they take your offer. Great people are picky about working for a
 * small agency with no reputation.
 */
export function offerResult(a: Applicant, pay: number, reputation: number, rand: Rand = defaultRand): OfferResult {
  const picky = a.level >= 4 && reputation < 10 && !chance(0.35, rand);
  if (picky) return { kind: 'decline', reason: 'I’m looking for a more established company, sorry.' };
  if (pay >= a.minPay) return chance(0.92, rand) ? { kind: 'accept' } : { kind: 'decline', reason: 'I got another offer. Sorry!' };
  if (pay >= a.minPay * 0.85 && a.counter === null) return { kind: 'counter', pay: a.minPay };
  return { kind: 'decline', reason: 'That’s too low for me. Good luck!' };
}

export function hire(a: Applicant, pay: number, day: number): Employee {
  return {
    id: uid('emp'),
    name: a.name,
    role: a.role,
    level: a.level,
    xp: 0,
    pay,
    traits: a.traits,
    knownTraits: a.knownTraits,
    morale: 70,
    hiredDay: day,
    assignedProjectId: null,
    carryMinutes: 0,
    lowMoraleDays: 0,
    today: { dials: 0, leads: 0, hours: 0, note: 'Starts today' },
  };
}

// ---------------------------------------------------------------------------
// Working

/** Minutes of work time between two clock times on a day (weekdays, 9-6 only). */
export function workMinutesBetween(day: number, from: number, to: number): number {
  if ((day - 1) % 7 >= 5) return 0;
  return Math.max(0, Math.min(to, WORKDAY_END) - Math.max(from, WORKDAY_START));
}

/** How much they get done compared to normal (about 0.4 - 1.2). */
export function productivity(e: Employee, day: number): number {
  let p = 0.6 + (0.4 * e.morale) / 100;
  if (e.traits.includes('lazy')) p *= 0.75;
  if (e.traits.includes('perfectionist')) p *= 0.85;
  // New people need a couple of days to get going.
  if (day - e.hiredDay < 2) p *= 0.5;
  return p;
}

export function qualityBonus(e: Employee): number {
  return (e.traits.includes('perfectionist') ? 8 : 0) - (e.traits.includes('sloppy') ? 8 : 0);
}

export function bugMult(e: Employee): number {
  return e.traits.includes('sloppy') ? 1.8 : e.traits.includes('perfectionist') ? 0.6 : 1;
}

/** Employees level up slower than you do, up to level 5. */
export function addEmployeeXp(e: Employee, amount: number): { employee: Employee; leveled: boolean } {
  if (e.level >= MAX_LEVEL) return { employee: e, leveled: false };
  let xp = e.xp + amount * (e.traits.includes('fast_learner') ? 2 : 1);
  let level = e.level;
  let leveled = false;
  while (level < MAX_LEVEL && xp >= xpForLevel(level) * 2) {
    xp -= xpForLevel(level) * 2;
    level++;
    leveled = true;
  }
  return { employee: { ...e, xp, level }, leveled };
}

export function callableByTeam(b: Business, day: number): boolean {
  if (!['new', 'contacted', 'callback'].includes(b.status)) return false;
  if (b.cooldownUntil !== null && day < b.cooldownUntil) return false;
  return b.lastCalledDay !== day;
}

export interface SalesHour {
  businesses: Business[];
  dials: number;
  /** Businesses that became interested this hour. */
  leads: { biz: Business; warmth: number }[];
}

/** One hour of a sales caller dialing through your list of businesses. */
export function salesHour(
  e: Employee,
  businesses: Business[],
  day: number,
  reputation: number,
  rand: Rand = defaultRand,
  /** Office bonuses (headsets, a nicer office). */
  dialMult = 1,
): SalesHour {
  const dialsWanted = Math.round((3 + e.level) * productivity(e, day) * dialMult);
  const pLead = (0.012 + 0.006 * e.level + Math.min(0.01, reputation * 0.0005)) * (e.traits.includes('people_person') ? 1.3 : 1);
  const list = businesses.map((b) => ({ ...b }));
  const callable = shuffle(
    list.filter((b) => callableByTeam(b, day)),
    rand,
  ).slice(0, dialsWanted);
  const leads: SalesHour['leads'] = [];
  for (const b of callable) {
    b.attempts++;
    b.lastCalledDay = day;
    if (chance(pLead, rand)) {
      b.status = 'interested';
      b.callback = null;
      leads.push({ biz: b, warmth: randInt(40, 60, rand) + e.level * 3 });
    } else if (chance(0.1, rand)) {
      b.status = 'not_interested';
      b.cooldownUntil = day + NOT_INTERESTED_COOLDOWN;
    } else if (b.status === 'new') {
      b.status = 'contacted';
    }
  }
  return { businesses: list, dials: callable.length, leads };
}

// ---------------------------------------------------------------------------
// Morale

/** Where their morale drifts to, based on pay, personality and the office. */
export function moraleTarget(e: Employee, officeBonus = 0): number {
  const payRatio = e.pay / marketPay(e.role, e.level);
  return clamp(60 + (payRatio - 1) * 120 + (e.traits.includes('reliable') ? 15 : 0) + officeBonus, 0, 100);
}

export const QUIT_AFTER_DAYS = 3;
export const BONUS_AMOUNT = 100;

/** End-of-workday morale change. Returns quit = true if they've had enough. */
export function endOfDayMorale(e: Employee, rand: Rand = defaultRand, officeBonus = 0): { employee: Employee; quit: boolean } {
  const target = moraleTarget(e, officeBonus);
  const morale = clamp(Math.round(e.morale + (target - e.morale) * 0.2 + randInt(-3, 3, rand)), 0, 100);
  const lowMoraleDays = morale < 30 ? e.lowMoraleDays + 1 : 0;
  const quit = lowMoraleDays >= (e.traits.includes('reliable') ? QUIT_AFTER_DAYS + 2 : QUIT_AFTER_DAYS);
  return { employee: { ...e, morale, lowMoraleDays }, quit };
}
