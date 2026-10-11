// The Claude subscription: an AI helper you pay for every day, like rent.
// It speeds up your own building. It doesn't change how fast your team works.

export type ClaudePlan = 'none' | 'pro' | 'max' | 'enterprise';

export interface PlanInfo {
  name: string;
  /** Cost per day, weekends too. */
  price: number;
  /** Multiplies how fast you build. 1.5 means 50% faster. */
  build: number;
  /** How long one round of bug testing takes you, in minutes. */
  testMinutes: number;
  /** Charged for every seat (you and each developer on your team) instead of once. */
  perSeat?: boolean;
  /** The fewest seats you pay for, like a real company plan. */
  minSeats?: number;
  /** Multiplies how fast your developers build, on top of your own speed-up. */
  teamBuild?: number;
  icon: string;
  /** Plain-words list of what you get. */
  perks: string[];
}

/** A full round of bug testing, done by hand. */
export const TEST_MINUTES = 60;

// How the prices were picked: an average site is about 37 hours of building
// at skill level 1 and pays around $1,300, so an hour of your building time is
// worth roughly $35. Pro frees up about a third of those hours (12 hours, or
// $430 per site) and Max about 43% plus shorter bug tests (around $600 per
// site). Both are worth it once you have clients queued up. They are not free
// while you are still hunting for your first one, because the charge comes
// out every day. Max costs a lot more than Pro because it only adds a little
// speed on top (+25 points) and the shorter tests.
/** Enterprise is for a team: $40 a day for every developer, and you count as one. */
export const ENTERPRISE_SEAT_PRICE = 40;

export const CLAUDE_PLANS: Record<ClaudePlan, PlanInfo> = {
  none: {
    name: 'No subscription',
    price: 0,
    build: 1,
    testMinutes: TEST_MINUTES,
    icon: '',
    perks: ['You do all of the work yourself.'],
  },
  pro: {
    name: 'Claude Pro',
    price: 20,
    build: 1.5,
    testMinutes: TEST_MINUTES,
    icon: '⚡',
    perks: ['Claude does the building, so you build sites 50% faster.', 'You still test for bugs yourself.'],
  },
  max: {
    name: 'Claude Max',
    price: 45,
    build: 1.75,
    testMinutes: TEST_MINUTES / 2,
    icon: '✨',
    perks: ['You build sites 75% faster.', 'Claude does half of the bug testing, so a test takes 30 min instead of an hour.'],
  },
  enterprise: {
    name: 'Claude Enterprise',
    price: ENTERPRISE_SEAT_PRICE,
    perSeat: true,
    minSeats: 3,
    teamBuild: 1.5,
    build: 1.75,
    testMinutes: TEST_MINUTES / 2,
    icon: '🏢',
    perks: [
      'Everything in Max for you: 75% faster building and half-length bug tests.',
      'Every developer on your team builds 50% faster too.',
      '$40 a day for every developer, and you count as one. Minimum of 3 seats.',
    ],
  },
};

export const CLAUDE_ORDER: ClaudePlan[] = ['pro', 'max', 'enterprise'];


/** What the plan changes for you right now. */
export function claudeEffects(plan: ClaudePlan): { build: number; testMinutes: number; price: number; teamBuild: number } {
  const p = CLAUDE_PLANS[plan] ?? CLAUDE_PLANS.none;
  return { build: p.build, testMinutes: p.testMinutes, price: p.price, teamBuild: p.teamBuild ?? 1 };
}

/** How many seats you pay for: you, plus each developer on your team, with a minimum. */
export function seatsFor(plan: ClaudePlan, developers: number): number {
  const p = CLAUDE_PLANS[plan];
  return p.perSeat ? Math.max(p.minSeats ?? 1, 1 + developers) : 1;
}

/** What the plan costs per day with this many developers on your team. */
export function claudeCost(plan: ClaudePlan, developers: number): number {
  return CLAUDE_PLANS[plan].price * seatsFor(plan, developers);
}

/** Why you can't switch to a plan, or null if you can. */
export function planBlocker(plan: ClaudePlan, current: ClaudePlan, money: number, developers = 0): string | null {
  if (plan === current) return 'Your plan';
  // The first day's charge comes out tonight, so you need to be able to cover it.
  if (plan !== 'none' && money < claudeCost(plan, developers)) return `Need $${claudeCost(plan, developers)}`;
  return null;
}
