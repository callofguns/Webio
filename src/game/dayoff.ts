// Giving someone on your team a day off. They skip a workday and come back happier.
//
// Paid: you still pay them for the day, and they're really grateful.
// Unpaid: you save their wage, and they're a bit less grateful.

import type { Employee } from './types';
import { WORKDAY_START } from './balance';

export const PAID_DAY_OFF_MORALE = 20;
export const UNPAID_DAY_OFF_MORALE = 12;
/** Days between days off for the same person. */
export const DAY_OFF_COOLDOWN = 7;

const isWorkday = (day: number) => (day - 1) % 7 < 5;

/** The day their break would be: today if the workday hasn't started, otherwise the next workday. */
export function dayOffDate(day: number, minute: number): number {
  let d = isWorkday(day) && minute <= WORKDAY_START ? day : day + 1;
  while (!isWorkday(d)) d++;
  return d;
}

/** Why they can't have a day off right now, or null if they can. */
export function dayOffBlocker(e: Employee, day: number): string | null {
  if (e.dayOff) return 'They already have a day off coming up.';
  if (e.training) return 'They are on a course right now.';
  if (e.lastDayOff !== undefined && day - e.lastDayOff < DAY_OFF_COOLDOWN) return `They had a day off recently. Next one from Day ${e.lastDayOff + DAY_OFF_COOLDOWN}.`;
  return null;
}

export function dayOffMorale(paid: boolean): number {
  return paid ? PAID_DAY_OFF_MORALE : UNPAID_DAY_OFF_MORALE;
}
