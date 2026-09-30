// All the numbers that control difficulty live here, so the game can be
// tuned in one place.

export const START_MONEY = 1800;
export const START_BUSINESSES = 18;

/** Rent + food + phone bill while you work from your bedroom. */
export const DAILY_LIVING_COST = 42;

export const WORKDAY_START = 9 * 60; // 9:00
export const WORKDAY_END = 18 * 60; // 18:00
/** After this time you're too tired to keep working. */
export const DAY_HARD_END = 22 * 60;
/** Work after this time is sloppier. */
export const LATE_NIGHT = 20 * 60;

export const RESEARCH_MINUTES = 15;
export const DIRECTORY_SEARCH_MINUTES = 40;
export const DIRECTORY_SEARCH_RESULTS = 6;
export const LEAD_LIST_COST = 60;
export const LEAD_LIST_SIZE = 20;

/** Days a business won't take your call after saying no. */
export const NOT_INTERESTED_COOLDOWN = 21;
/** Chance a voicemail gets returned the next day. */
export const VOICEMAIL_RETURN_CHANCE = 0.06;

export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}
