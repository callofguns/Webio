// Your best sales people don't just get a business interested on the phone.
// They carry on with the texts themselves: ask what the client needs, send a
// quote, negotiate, and sign them. A signed deal goes straight to Projects.
//
// This plays the whole conversation out in one go, using the same rules as when
// you do it by hand. Every message is stamped with a future time, so you watch
// the conversation unfold in Messages as the days go by.

import type { Business, Deal, Feature, GameTime, Quote } from './types';
import { clamp, randInt, type Rand, defaultRand } from './rng';
import { WORKDAY_END, WORKDAY_START } from './balance';
import {
  buildDays,
  FEATURES,
  fromGameTime,
  marketPrice,
  sendQuote,
  sendText,
  textMessage,
  toGameTime,
  type TextContext,
} from './deals';

/** Sales people at this level or above close deals on their own. */
export const CLOSER_LEVEL = 4;

export interface Closer {
  name: string;
  level: number;
}

/** How many sites you can have on the go before your closers stop signing new ones. */
export function pipelineCap(builders: number): number {
  return 3 + 2 * builders;
}

export type CloserOutcome = 'won' | 'lost' | 'handoff';

/** The next moment a person at work could send a text: weekdays, 9 to 6. */
function nextWorkTime(t: GameTime, rand: Rand): GameTime {
  let { day, minute } = fromGameTime(t);
  const weekday = () => (day - 1) % 7;
  if (weekday() < 5 && minute >= WORKDAY_START && minute < WORKDAY_END) return t;
  if (weekday() < 5 && minute < WORKDAY_START) return toGameTime(day, WORKDAY_START + randInt(0, 45, rand));
  do day++;
  while (weekday() >= 5);
  minute = WORKDAY_START + randInt(0, 45, rand);
  return toGameTime(day, minute);
}

/**
 * What a salesperson puts in the quote, based on what the client told them.
 * Nobody prices it perfectly. Better people guess closer to what the client
 * can afford, and are less likely to ask for too much.
 */
function buildQuote(deal: Deal, biz: Business, devLevel: number, level: number, queue: number, rand: Rand): Quote {
  const n = deal.needs;
  // They only offer what you can actually build.
  const features: Feature[] = n.features.filter((f) => FEATURES[f].devLevel <= devLevel);
  const market = marketPrice(n.pages, features);
  // Start from what the client said they could spend, or from the usual price.
  const base = deal.known.budget && deal.budgetHint ? (deal.budgetHint[0] + deal.budgetHint[1]) / 2 : market * 0.95;
  const looseness = 0.55 - 0.08 * level; // level 4: 0.23, level 5: 0.15
  // Everybody has an off day. Now and then they ask for far too much.
  const fumble = rand() < 0.9 - 0.16 * level; // level 4: 26%, level 5: 10%
  const price = base * (fumble ? 1.6 : 0.95 + rand() * looseness * 2);
  // Promise a date that allows for the sites already in the queue.
  const estimate = buildDays(n.pages, features) + 2 + queue * 4;
  const days = Math.max(3, deal.known.deadline ? Math.min(n.deadlineDays, estimate) : estimate);
  const picky = biz.temperament === 'skeptical' || biz.temperament === 'grumpy';
  return {
    pages: n.pages,
    features,
    price: Math.max(50, Math.round(price / 50) * 50),
    days,
    depositPct: 25,
    // Easygoing owners get the choice. Picky ones get a simple one-time price.
    plan: picky ? 'buyout' : 'either',
  };
}

/**
 * Plays out the whole conversation with a client who just said yes on the phone.
 * Returns the deal with every text in it, and how it ended: won (it will turn
 * into a project when the last reply arrives), lost, or handed to you.
 */
export function closeDeal(
  deal: Deal,
  biz: Business,
  closer: Closer,
  ctx: Omit<TextContext, 'now' | 'playerName'> & {
    /** Sites you are already building or about to start. */
    queue?: number;
  },
  now: GameTime,
  rand: Rand = defaultRand,
): { deal: Deal; outcome: CloserOutcome } {
  const who = closer.name.split(' ')[0];
  const at = (t: GameTime): TextContext => ({ ...ctx, now: t, playerName: who });
  // The better they are, the warmer the client is to start with.
  let d: Deal = { ...deal, warmth: clamp(deal.warmth + (closer.level - 3) * 6, 0, 100) };
  d = { ...d, messages: [...d.messages, textMessage('system', `${who} is handling the texts with them.`, now)] };

  let t = nextWorkTime(now, rand);
  /** Waits for their reply, then picks the conversation back up a little later. */
  const next = () => {
    const last = Math.max(...d.messages.map((m) => m.t));
    t = nextWorkTime(Math.max(t, last) + randInt(3, 25, rand), rand);
  };
  const hand = (): { deal: Deal; outcome: CloserOutcome } => {
    const last = Math.max(...d.messages.map((m) => m.t));
    return {
      deal: { ...d, messages: [...d.messages, textMessage('system', `${who} couldn't wrap this up and left it with you.`, last)] },
      outcome: 'handoff',
    };
  };

  // Say hello.
  const hello = sendText(d, biz, 'intro_pro', at(t), rand);
  if (hello === d) return hand();
  d = hello;

  // Find out what they need. Don't wear their patience out.
  for (const q of ['q_features', 'q_budget', 'q_deadline', 'q_content']) {
    if (q !== 'q_features' && q !== 'q_budget' && d.patience <= 1) break;
    next();
    const asked = sendText(d, biz, q, at(t), rand);
    if (asked === d) return hand();
    d = asked;
  }

  // Quote, then deal with what comes back.
  next();
  let sent = sendQuote(d, biz, buildQuote(d, biz, ctx.devLevel, closer.level, ctx.queue ?? 0, rand), at(t), rand);
  if (sent === d) return hand();
  d = sent;

  for (let round = 0; round < 4 && d.stage !== 'won' && d.stage !== 'lost'; round++) {
    next();
    if (d.stage === 'negotiating' && d.quote) {
      const counter = d.counter ?? 0;
      const price = d.quote.price;
      let choice = 'neg_middle';
      if (counter >= price * 0.8) choice = 'neg_accept';
      else if (d.finalOffer) choice = counter >= price * 0.7 ? 'neg_accept' : 'neg_walk';
      const after = sendText(d, biz, choice, at(t), rand);
      if (after === d) return hand();
      d = after;
    } else if (d.stage === 'discovery') {
      // They wanted something that was left out. Send an updated quote.
      sent = sendQuote(d, biz, buildQuote(d, biz, ctx.devLevel, closer.level, ctx.queue ?? 0, rand), at(t), rand);
      if (sent === d) return hand();
      d = sent;
    } else {
      break;
    }
  }

  if (d.stage === 'won') {
    return {
      deal: { ...d, messages: [...d.messages, textMessage('system', `${who} closed the deal for you.`, d.closedAt ?? t)] },
      outcome: 'won',
    };
  }
  if (d.stage === 'lost') return { deal: d, outcome: 'lost' };
  return hand();
}
