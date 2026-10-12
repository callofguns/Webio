// Random events: surprises at the start of a day, about once a week.
//
// Each event shows up as a popup. Most give you two choices, and what happens
// depends on what you pick. This file decides which event happens and what it
// says. The store applies the result.

import type { Business, Deal, Employee, GameState, Project } from './types';
import { chance, pick, uid, type Rand, defaultRand } from './rng';
import { isWaiting, toGameTime } from './deals';
import { WORKDAY_START } from './balance';

export type EventKind = 'viral' | 'sick' | 'rival' | 'outage';

export interface GameEvent {
  id: string;
  kind: EventKind;
  day: number;
  /** The project, employee or deal it's about. */
  targetId: string;
  /** A rival agency's name, for the rival event. */
  rival?: string;
}

export interface EventChoice {
  id: string;
  label: string;
  hint: string;
}

/** Chance of an event on any day, so about once a week. */
export const EVENT_CHANCE = 1 / 7;
/** At least this many days between events. */
export const EVENT_MIN_GAP = 4;
/** No events in your first few days. */
export const EVENT_START_DAY = 4;
/** Hours it takes you to fix a crashed site. */
export const OUTAGE_FIX_HOURS = 2;
/** Referral leads a viral site brings in. */
export const VIRAL_LEADS = 2;

const RIVALS = ['PixelPush Media', 'Bright Byte Studio', 'Cheap Sites 4 U', 'WebWave Agency', 'Nimbus Digital', 'SiteSprint', 'Copperleaf Creative', 'Blue Fern Web'];

type Candidate = { kind: EventKind; targetId: string };

/** The parts of the game state events look at. */
type EventState = Pick<GameState, 'day' | 'projects' | 'employees' | 'deals'> & { lastEventDay?: number };

/** Everything that could happen today, given the state of your agency. */
export function eligibleEvents(s: EventState): Candidate[] {
  const now = toGameTime(s.day, WORKDAY_START);
  const out: Candidate[] = [];
  for (const p of s.projects) {
    if (p.status === 'delivered' && (p.stars ?? 0) >= 4) out.push({ kind: 'viral', targetId: p.id });
    if (p.status === 'delivered' && p.retainer) out.push({ kind: 'outage', targetId: p.id });
  }
  for (const e of s.employees) {
    if (!e.training && e.dayOff?.day !== s.day && !e.sick) out.push({ kind: 'sick', targetId: e.id });
  }
  for (const d of s.deals) {
    // Only conversations you're having yourself, where nothing is on its way.
    if (d.stage === 'won' || d.stage === 'lost' || isWaiting(d, now)) continue;
    if (d.messages.some((m) => m.text.includes('is handling the texts'))) continue;
    out.push({ kind: 'rival', targetId: d.id });
  }
  return out;
}

/** Maybe an event happens today. */
export function rollEvent(s: EventState, rand: Rand = defaultRand): GameEvent | null {
  if (s.day < EVENT_START_DAY) return null;
  if (s.lastEventDay !== undefined && s.day - s.lastEventDay < EVENT_MIN_GAP) return null;
  if (!chance(EVENT_CHANCE, rand)) return null;
  const options = eligibleEvents(s);
  if (!options.length) return null;
  // Each kind of event is equally likely, whatever has the most targets.
  const kinds = [...new Set(options.map((o) => o.kind))];
  const kind = pick(kinds, rand);
  const target = pick(options.filter((o) => o.kind === kind), rand);
  return { id: uid('event'), kind, day: s.day, targetId: target.targetId, ...(kind === 'rival' ? { rival: pick(RIVALS, rand) } : {}) };
}

export interface EventView {
  title: string;
  text: string;
  icon: string;
  choices: EventChoice[];
}

/** What the popup says. */
export function describeEvent(
  ev: GameEvent,
  find: { project?: Project; employee?: Employee; deal?: Deal; biz?: Business },
): EventView {
  const biz = find.biz?.name ?? 'A client';
  const owner = find.biz?.ownerName.split(' ')[0] ?? 'They';
  switch (ev.kind) {
    case 'viral':
      return {
        icon: '🚀',
        title: `${biz} went viral!`,
        text: `${owner} shared their new site online and it blew up. People keep asking who made it. ${VIRAL_LEADS} businesses have already texted you about a website, and your reputation is up.`,
        choices: [{ id: 'ok', label: 'Awesome!', hint: `+3 reputation, ${VIRAL_LEADS} new leads in Messages` }],
      };
    case 'sick': {
      const name = find.employee?.name.split(' ')[0] ?? 'Someone';
      return {
        icon: '🤒',
        title: `${name} called in sick`,
        text: `${name} woke up feeling awful and asks if they can take today off.`,
        choices: [
          { id: 'rest', label: 'Tell them to rest', hint: 'No work from them today, but they appreciate it (morale +5)' },
          { id: 'wfh', label: 'Ask them to work from home', hint: 'They work at about half speed today, and aren’t happy about it (morale −10)' },
        ],
      };
    }
    case 'rival':
      return {
        icon: '🥊',
        title: `A rival is after ${biz}`,
        text: `${ev.rival ?? 'Another agency'} pitched ${biz} a cheaper website. ${owner} is thinking about it.`,
        choices: [
          { id: 'match', label: 'Promise a better price', hint: 'They stay keen, but now expect to pay about 15% less' },
          { id: 'hold', label: 'Hold firm on quality', hint: 'Keep your prices, but they cool off and might walk away' },
        ],
      };
    case 'outage':
      return {
        icon: '🔥',
        title: `${biz}’s site is down!`,
        text: `${owner} is texting you in a panic: their website won’t load, and they pay you every month to keep it running.`,
        choices: [
          { id: 'fix', label: 'Fix it right now', hint: `Takes ${OUTAGE_FIX_HOURS} hours of your day. They’ll be grateful (+1 reputation)` },
          { id: 'later', label: 'Deal with it later', hint: 'Saves your time, but they’re upset and might cancel their monthly plan' },
        ],
      };
  }
}

/** Half the hours, roughly: a sick person working from home. */
export function sickHourWorks(rand: Rand = defaultRand): boolean {
  return rand() < 0.5;
}

/** Whether an unhappy monthly client cancels after you leave their site down. */
export function cancelsAfterOutage(rand: Rand = defaultRand): boolean {
  return chance(0.5, rand);
}
