import type { Design, Vibe } from './design';
import type { FurnitureId, OfficeId } from './office';

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

/** What your employees got done in a day. */
export interface TeamDay {
  dials: number;
  leads: number;
  buildHours: number;
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
  /** When each answer actually arrives. Until then you haven't learned it. Missing = already known. */
  knownAt?: Partial<Record<'features' | 'budget' | 'deadline' | 'content', GameTime>>;
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

export type ProjectStatus = 'not_started' | 'in_progress' | 'review' | 'delivered';

export interface BuildTask {
  id: string;
  label: string;
  skill: 'design' | 'development';
  /** Hours of work at skill level 1. */
  hours: number;
  /** Hours of progress so far. */
  done: number;
  /** 0-100 once finished. */
  quality: number | null;
  /** Quality lost from sloppy late-night work on this task. */
  penalty: number;
  feature?: Feature;
}

export type ProjectEventId = 'blurry_photos' | 'tricky_bug' | 'tutorial' | 'extra_section';

export interface ProjectReview {
  /** When the client's reply arrives. */
  at: GameTime;
  approved: boolean;
  stars: number;
  satisfaction: number;
  feedback: 'bugs' | 'design' | 'sections' | 'quality' | 'content' | null;
}

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

  // --- Part 3: building ---
  design: Design;
  /** The style the client secretly likes. */
  taste: Vibe;
  /** When their answer about style arrives (null = not asked yet). */
  tasteAt: GameTime | null;
  tasks: BuildTask[];
  /** Bugs nobody has found yet. The client will. */
  hiddenBugs: number;
  /** Bugs you found by testing, waiting to be fixed. */
  foundBugs: number;
  /** Times you polished (each adds a little quality). */
  polish: number;
  /** Extra client happiness from how you handled things. */
  goodwill: number;
  /** Quality gained or lost from choices during the build. */
  qualityMod: number;
  /** How many surprise events have happened on this project. */
  eventsSeen: number;
  revisions: number;
  pendingEvent: ProjectEventId | null;
  review: ProjectReview | null;
  /** What the client complained about last time they asked for changes. */
  lastFeedback: ProjectReview['feedback'];
  stars: number | null;
  deliveredDay: number | null;
  lastNudgeDay: number | null;
}

// ---------------------------------------------------------------------------
// Part 4: hiring

export type Role = 'sales' | 'designer' | 'developer';

export type Trait = 'reliable' | 'lazy' | 'fast_learner' | 'perfectionist' | 'sloppy' | 'people_person';

export type JobBoard = 'free' | 'paid' | 'referral';

export interface JobPost {
  id: string;
  role: Role;
  board: JobBoard;
  /** Daily pay offered in the ad. */
  pay: number;
  postedDay: number;
  endsDay: number;
}

export interface Applicant {
  id: string;
  name: string;
  role: Role;
  /** Real skill, 1-5. Hidden until you give them a test task. */
  level: number;
  /** What their résumé says. Some people exaggerate. */
  claimedLevel: number;
  years: number;
  traits: Trait[];
  /** Traits you've found out about in an interview. */
  knownTraits: Trait[];
  askingPay: number;
  /** Lowest daily pay they'd take. Hidden. */
  minPay: number;
  interviewed: boolean;
  tested: boolean;
  appliedDay: number;
  /** After this day they take another job. */
  leavesDay: number;
  /** Their answer to your last offer, if they turned it down. */
  counter: number | null;
}

export interface Employee {
  id: string;
  name: string;
  role: Role;
  level: number;
  xp: number;
  /** Daily pay. */
  pay: number;
  traits: Trait[];
  knownTraits: Trait[];
  /** 0-100. Low morale means slow work, then quitting. */
  morale: number;
  hiredDay: number;
  /** Designers and developers work on this project. */
  assignedProjectId: string | null;
  /** Work time that hasn't added up to a full hour yet. */
  carryMinutes: number;
  lowMoraleDays: number;
  /** What they did today, for the Team screen. */
  today: { dials: number; leads: number; hours: number; note: string };
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
  employees: Employee[];
  jobPosts: JobPost[];
  applicants: Applicant[];
  /** Wages earned this week, paid on Friday. */
  payrollDue: number;
  /** Where you work (part 5). */
  office: OfficeId;
  /** Equipment you've bought. */
  furniture: FurnitureId[];
  log: LogEntry[];
  today: DayStats;
  lifetime: DayStats;
  /** Summary of the day that just ended, shown in a popup. */
  lastDaySummary: (DayStats & { day: number; expenses: number; payroll: number; rent: number; team: TeamDay | null }) | null;
}
