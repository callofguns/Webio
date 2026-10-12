// Goals: milestones to aim for, from your first call to a big agency.
// Each one pays a cash reward the moment you reach it.

import type { GameState } from './types';

export interface Goal {
  id: string;
  title: string;
  /** What you need to do, in plain words. */
  text: string;
  reward: number;
  /** How far along you are, and the target. Done when the first reaches the second. */
  progress: (s: GoalState) => [number, number];
}

type GoalState = Pick<GameState, 'lifetime' | 'today' | 'projects' | 'employees' | 'reputation' | 'office' | 'skills' | 'claude' | 'businesses'>;

const delivered = (s: GoalState) => s.projects.filter((p) => p.status === 'delivered');
const earned = (s: GoalState) => s.lifetime.moneyIn + s.today.moneyIn;
const count = (n: number, target: number): [number, number] => [Math.min(n, target), target];

/** In the order you'll usually reach them. */
export const GOALS: Goal[] = [
  { id: 'first_call', title: 'Pick up the phone', text: 'Make your first cold call.', reward: 50, progress: (s) => count(s.lifetime.dials + s.today.dials, 1) },
  { id: 'first_lead', title: 'Someone’s interested', text: 'Get a business interested on a call.', reward: 75, progress: (s) => count(s.lifetime.leadsWon + s.today.leadsWon, 1) },
  { id: 'first_client', title: 'First client', text: 'Sign your first deal.', reward: 100, progress: (s) => count(s.projects.length, 1) },
  { id: 'first_site', title: 'Live on the internet', text: 'Deliver your first website.', reward: 150, progress: (s) => count(delivered(s).length, 1) },
  { id: 'calls_50', title: 'Dialing machine', text: 'Make 50 calls.', reward: 100, progress: (s) => count(s.lifetime.dials + s.today.dials, 50) },
  { id: 'five_star', title: 'Five stars', text: 'Get a 5-star review from a client.', reward: 150, progress: (s) => count(delivered(s).filter((p) => p.stars === 5).length, 1) },
  { id: 'monthly', title: 'Money every month', text: 'Have a client on a monthly plan.', reward: 200, progress: (s) => count(s.projects.filter((p) => p.retainer).length, 1) },
  { id: 'earn_5k', title: 'Five grand', text: 'Earn $5,000 in total.', reward: 250, progress: (s) => count(earned(s), 5000) },
  { id: 'first_hire', title: 'Not alone anymore', text: 'Hire your first employee.', reward: 150, progress: (s) => count(s.employees.length, 1) },
  { id: 'sites_5', title: 'Portfolio', text: 'Deliver 5 websites.', reward: 300, progress: (s) => count(delivered(s).length, 5) },
  { id: 'skill_3', title: 'Getting good', text: 'Reach level 3 in any skill.', reward: 200, progress: (s) => count(Math.max(s.skills.sales.level, s.skills.design.level, s.skills.development.level), 3) },
  { id: 'office', title: 'Out of the bedroom', text: 'Move into a real workspace.', reward: 200, progress: (s) => count(s.office === 'bedroom' ? 0 : 1, 1) },
  { id: 'claude', title: 'AI powered', text: 'Subscribe to a Claude plan.', reward: 100, progress: (s) => count(s.claude === 'none' ? 0 : 1, 1) },
  { id: 'rep_15', title: 'Word gets around', text: 'Reach reputation 15.', reward: 250, progress: (s) => count(s.reputation, 15) },
  { id: 'team_3', title: 'A real team', text: 'Have 3 employees.', reward: 300, progress: (s) => count(s.employees.length, 3) },
  { id: 'earn_20k', title: 'Twenty grand', text: 'Earn $20,000 in total.', reward: 500, progress: (s) => count(earned(s), 20000) },
  { id: 'sites_15', title: 'Busy studio', text: 'Deliver 15 websites.', reward: 600, progress: (s) => count(delivered(s).length, 15) },
  { id: 'rep_30', title: 'Known around town', text: 'Reach reputation 30.', reward: 600, progress: (s) => count(s.reputation, 30) },
  {
    id: 'big_client',
    title: 'The big leagues',
    text: 'Deliver a site for a big client.',
    reward: 800,
    progress: (s) => count(delivered(s).filter((p) => s.businesses.find((b) => b.id === p.businessId)?.size === 'large').length, 1),
  },
  { id: 'team_10', title: 'Agency', text: 'Have 10 employees.', reward: 1000, progress: (s) => count(s.employees.length, 10) },
  { id: 'earn_50k', title: 'Fifty grand', text: 'Earn $50,000 in total.', reward: 1500, progress: (s) => count(earned(s), 50000) },
];

export const GOAL_BY_ID: Record<string, Goal> = Object.fromEntries(GOALS.map((g) => [g.id, g]));

export function isDone(g: Goal, s: GoalState): boolean {
  const [n, target] = g.progress(s);
  return n >= target;
}

/** Goals you've just reached that haven't been paid out yet. */
export function newlyDone(s: GoalState, done: readonly string[]): Goal[] {
  return GOALS.filter((g) => !done.includes(g.id) && isDone(g, s));
}

/** The next few goals to show on the Home screen. */
export function nextGoals(done: readonly string[], n = 3): Goal[] {
  return GOALS.filter((g) => !done.includes(g.id)).slice(0, n);
}
