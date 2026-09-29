// Core data shapes for the whole game. Everything saved to the player's
// browser is built out of these types.

export type Industry =
  | 'plumbing'
  | 'restaurant'
  | 'salon'
  | 'dentist'
  | 'landscaping'
  | 'auto'
  | 'bakery'
  | 'fitness'
  | 'law'
  | 'realestate';

export type BusinessSize = 'solo' | 'small' | 'medium';

/** How good the business's current website is. */
export type WebsiteState = 'none' | 'outdated' | 'basic' | 'good';

/** Hidden personality of the owner. The player has to read it from how they answer. */
export type Temperament = 'friendly' | 'busy' | 'skeptical' | 'grumpy';

/** The main problem with their online presence (revealed by research). */
export type PainPoint =
  | 'no_presence'
  | 'not_mobile'
  | 'looks_dated'
  | 'no_booking'
  | 'hard_to_find';

export type LeadStatus =
  | 'new'
  | 'contacted' // called at least once, no decision yet
  | 'callback' // someone asked you to call back
  | 'not_interested'
  | 'do_not_call'
  | 'interested'; // becomes a client conversation (Part 2)

export interface Business {
  id: string;
  name: string;
  industry: Industry;
  ownerName: string;
  phone: string;
  size: BusinessSize;
  website: WebsiteState;
  temperament: Temperament;
  painPoint: PainPoint;
  /** Rough budget in dollars. Hidden from the player. */
  budget: number;

  // --- What the player knows / has done ---
  researched: boolean;
  status: LeadStatus;
  attempts: number;
  lastCalledDay: number | null;
  /** Day the lead can be called again after saying no. */
  cooldownUntil: number | null;
  callback: { day: number; hour: number } | null;
  /** How warm they are once interested (0-100). Used by the texting part. */
  warmth: number;
  notes: string[];
}

export interface Skill {
  level: number;
  xp: number;
}

export type SkillId = 'sales' | 'design' | 'development';

export interface LogEntry {
  id: string;
  day: number;
  minute: number;
  text: string;
  tone: 'neutral' | 'good' | 'bad';
}

export interface DayStats {
  dials: number;
  conversations: number;
  leadsWon: number;
  moneyIn: number;
  moneyOut: number;
}

export interface GameState {
  version: number;
  /** Day 1 is a Monday. */
  day: number;
  /** Minutes since midnight. The workday is 9:00 (540) to 18:00 (1080). */
  minute: number;
  money: number;
  reputation: number;
  skills: Record<SkillId, Skill>;
  businesses: Business[];
  log: LogEntry[];
  today: DayStats;
  lifetime: DayStats;
  /** Summary of the day that just ended, shown in a popup. */
  lastDaySummary: (DayStats & { day: number; expenses: number }) | null;
}
