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
  | 'interested' // you're texting them about a deal
  | 'client'; // signed a contract

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

/** Things a website can include. Some need a higher Development skill to build. */
export type Feature =
  | 'contact_form'
  | 'gallery'
  | 'maps'
  | 'reviews'
  | 'menu'
  | 'blog'
  | 'booking'
  | 'listings'
  | 'online_store'
  | 'copywriting';

/** A point in game time: minutes since day 1, 00:00. */
export type GameTime = number;

export interface TextMessage {
  id: string;
  from: 'you' | 'them' | 'system';
  text: string;
  /** When the message shows up. Replies are scheduled in the future. */
  t: GameTime;
  quote?: Quote;
}

export interface Quote {
  pages: number;
  features: Feature[];
  price: number;
  days: number;
  /** Percent paid up front: 0, 25 or 50. */
  depositPct: number;
}

/** What the client actually wants. Hidden until you ask. */
export interface ClientNeeds {
  features: Feature[];
  pages: number;
  deadlineDays: number;
  hasContent: boolean;
}

export type DealStage = 'intro' | 'discovery' | 'negotiating' | 'won' | 'lost';

export interface Deal {
  id: string;
  businessId: string;
  stage: DealStage;
  messages: TextMessage[];
  needs: ClientNeeds;
  /** Which needs you've found out by asking. */
  known: { features: boolean; budget: boolean; deadline: boolean; content: boolean };
  /** What they told you about budget. null = they wouldn't say. */
  budgetHint: [number, number] | null;
  warmth: number;
  /** Questions they'll answer before getting annoyed. */
  patience: number;
  /** Last quote you sent. */
  quote: Quote | null;
  /** Their counter-offer price, while negotiating. */
  counter: number | null;
  /** True once they've said "that's my final offer". */
  finalOffer: boolean;
  /** Price you agreed on. */
  agreedPrice: number | null;
  /** When the deal was won or lost (the reply that decided it). */
  closedAt: GameTime | null;
  /** True after the win/loss has been applied (money paid, project created). */
  settled: boolean;
  /** When you last read this thread. */
  readAt: GameTime;
  /** Full days in a row you left them waiting. */
  idleDays: number;
}

export type ProjectStatus = 'not_started' | 'in_progress' | 'delivered';

export interface Project {
  id: string;
  businessId: string;
  dealId: string;
  pages: number;
  features: Feature[];
  price: number;
  depositPaid: number;
  signedDay: number;
  dueDay: number;
  hasContent: boolean;
  status: ProjectStatus;
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
  deals: Deal[];
  projects: Project[];
  log: LogEntry[];
  today: DayStats;
  lifetime: DayStats;
  /** Summary of the day that just ended, shown in a popup. */
  lastDaySummary: (DayStats & { day: number; expenses: number }) | null;
}
