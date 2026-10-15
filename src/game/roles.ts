// The newer team roles: project managers, support techs and QA testers.
//
// Project manager: makes designers and developers work faster, and warns you
//   when a site is about to miss its deadline.
// Support tech: looks after monthly-plan clients. They fix crashed sites
//   before anyone notices, and happy monthly clients come back more often.
// QA tester: tests sites for bugs so developers can keep building.

import type { Employee, Project, Role } from './types';
import { progress } from './projects';

/** Designers and developers: the people who build the sites. */
export const isBuilder = (role: Role): role is 'designer' | 'developer' => role === 'designer' || role === 'developer';

/** Someone who's actually at work today (not off, sick at home resting, or on a course). */
export function atWork(e: Employee, day: number): boolean {
  return !e.training && e.dayOff?.day !== day && !(e.sick?.day === day && e.sick.mode === 'rest');
}

/** Extra speed per project manager: 4%, plus 2% per level. All together, at most 25%. */
export const PM_BOOST_CAP = 0.25;
export function pmBoost(employees: Employee[], day: number): number {
  const sum = employees.filter((e) => e.role === 'pm' && atWork(e, day)).reduce((n, e) => n + 0.04 + 0.02 * e.level, 0);
  return 1 + Math.min(PM_BOOST_CAP, sum);
}

/** Project managers warn you this many days before a deadline. */
export const PM_WARN_DAYS = 2;

/** A site that probably won't be ready in time: due soon and not far enough along. */
export function atRisk(p: Project, day: number): boolean {
  if (p.status !== 'not_started' && p.status !== 'in_progress') return false;
  const left = p.dueDay - day;
  return left >= 0 && left <= PM_WARN_DAYS && progress(p) < 0.85;
}

/** QA testers are better at finding bugs than developers. */
export const QA_FIND_BONUS = 1;

export function hasSupport(employees: Employee[], day: number): boolean {
  return employees.some((e) => e.role === 'support' && atWork(e, day));
}

/** How much more likely a monthly client is to come back with more work when you have a support tech. */
export const SUPPORT_COMEBACK_BONUS = 0.15;
