// The texting / deal engine. After a good cold call, a Deal is created and you
// text the client:
//
//   intro -> discovery (ask questions) -> quote -> (accept | counter | revise | reject)
//   counter -> negotiating -> won | lost
//
// Their replies are scheduled in the future (game time), so you have to keep
// working while you wait. Leave them waiting too long and they go cold.
//
// Like calls.ts, these functions return a new Deal instead of changing the old one.

import type { Business, ClientNeeds, Deal, Feature, GameTime, Industry, Quote, Temperament, TextMessage } from './types';
import { chance, clamp, pick, randInt, uid, type Rand, defaultRand } from './rng';
import { WORKDAY_START } from './balance';

// ---------------------------------------------------------------------------
// Features and prices

export interface FeatureInfo {
  label: string;
  /** Typical price for this feature, in dollars. */
  price: number;
  /** Extra days it takes to build. */
  days: number;
  /** Development skill level needed to offer it. */
  devLevel: number;
  /** How a client describes wanting it: "people need to be able to ___". */
  phrase: string;
}

export const FEATURES: Record<Feature, FeatureInfo> = {
  contact_form: { label: 'Contact form', price: 80, days: 0.5, devLevel: 1, phrase: 'send us a message' },
  gallery: { label: 'Photo gallery', price: 120, days: 1, devLevel: 1, phrase: 'see photos of our work' },
  maps: { label: 'Map & directions', price: 40, days: 0.5, devLevel: 1, phrase: 'find where we are' },
  reviews: { label: 'Customer reviews', price: 90, days: 1, devLevel: 1, phrase: 'see our reviews' },
  menu: { label: 'Menu / price list', price: 120, days: 1, devLevel: 1, phrase: 'check our menu and prices' },
  blog: { label: 'Blog / news', price: 200, days: 2, devLevel: 1, phrase: 'read our news and tips' },
  booking: { label: 'Online booking', price: 400, days: 3, devLevel: 2, phrase: 'book appointments online' },
  listings: { label: 'Property listings', price: 500, days: 4, devLevel: 2, phrase: 'browse the homes we’re selling' },
  online_store: { label: 'Online store', price: 900, days: 6, devLevel: 3, phrase: 'order and pay online' },
  copywriting: { label: 'Copywriting & photos', price: 250, days: 2, devLevel: 1, phrase: '' },
};

export const FEATURE_ORDER: Feature[] = [
  'contact_form', 'gallery', 'maps', 'reviews', 'menu', 'blog', 'booking', 'listings', 'online_store', 'copywriting',
];

const INDUSTRY_NEEDS: Record<Industry, { core: Feature[]; extra: Feature[] }> = {
  plumbing: { core: ['contact_form', 'reviews'], extra: ['maps'] },
  restaurant: { core: ['menu', 'maps'], extra: ['gallery', 'online_store'] },
  salon: { core: ['booking', 'gallery'], extra: ['reviews'] },
  dentist: { core: ['booking', 'contact_form'], extra: ['reviews'] },
  landscaping: { core: ['gallery', 'contact_form'], extra: ['reviews'] },
  auto: { core: ['contact_form', 'maps'], extra: ['reviews'] },
  bakery: { core: ['menu', 'gallery'], extra: ['online_store'] },
  fitness: { core: ['booking', 'gallery'], extra: ['blog'] },
  law: { core: ['contact_form', 'blog'], extra: ['reviews'] },
  realestate: { core: ['listings', 'contact_form'], extra: ['gallery'] },
};

export const BASE_PRICE = 250;
export const PRICE_PER_PAGE = 110;

const round50 = (n: number) => Math.max(50, Math.round(n / 50) * 50);

/** What a fair price would be for this much work. */
export function marketPrice(pages: number, features: Feature[]): number {
  return round50(BASE_PRICE + pages * PRICE_PER_PAGE + features.reduce((sum, f) => sum + FEATURES[f].price, 0));
}

/** Roughly how many days it takes one person to build. */
export function buildDays(pages: number, features: Feature[]): number {
  return Math.ceil(2 + pages * 0.8 + features.reduce((sum, f) => sum + FEATURES[f].days, 0));
}

// ---------------------------------------------------------------------------
// Time helpers

export const DAY_MINUTES = 24 * 60;

export function toGameTime(day: number, minute: number): GameTime {
  return (day - 1) * DAY_MINUTES + minute;
}

export function fromGameTime(t: GameTime): { day: number; minute: number } {
  return { day: Math.floor(t / DAY_MINUTES) + 1, minute: t % DAY_MINUTES };
}

const REPLY_SPEED: Record<Temperament, number> = { friendly: 1, busy: 3, skeptical: 1.5, grumpy: 2 };

/** When the client will reply. People don't text back late at night. */
function replyTime(now: GameTime, t: Temperament, rand: Rand, min = 10, max = 60): GameTime {
  let at = now + Math.round(randInt(min, max, rand) * REPLY_SPEED[t]);
  const { day, minute } = fromGameTime(at);
  if (minute >= 21 * 60 || minute < 8 * 60) {
    const nextDay = minute >= 21 * 60 ? day + 1 : day;
    at = toGameTime(nextDay, WORKDAY_START + randInt(0, 90, rand));
  }
  return at;
}

// ---------------------------------------------------------------------------
// Creating a deal

function firstName(full: string): string {
  return full.split(' ')[0];
}

function msg(from: TextMessage['from'], text: string, t: GameTime, quote?: Quote): TextMessage {
  return { id: uid('msg'), from, text, t, ...(quote ? { quote } : {}) };
}

export function rollNeeds(biz: Business, rand: Rand = defaultRand): ClientNeeds {
  const { core, extra } = INDUSTRY_NEEDS[biz.industry];
  const hasContent = chance(0.55, rand);
  const features = [...core, ...extra.filter(() => chance(0.4, rand))];
  if (!hasContent) features.push('copywriting');
  const pages = { solo: randInt(3, 4, rand), small: randInt(4, 6, rand), medium: randInt(6, 9, rand) }[biz.size];
  return { features, pages, deadlineDays: randInt(10, 35, rand), hasContent };
}

export function createDeal(biz: Business, warmth: number, now: GameTime, rand: Rand = defaultRand): Deal {
  return {
    id: uid('deal'),
    businessId: biz.id,
    stage: 'intro',
    messages: [msg('system', `You spoke on the phone. ${firstName(biz.ownerName)} said to text them.`, now)],
    needs: rollNeeds(biz, rand),
    known: { features: false, budget: false, deadline: false, content: false },
    budgetHint: null,
    warmth: clamp(warmth, 0, 100),
    patience: { friendly: 4, busy: 2, skeptical: 3, grumpy: 2 }[biz.temperament],
    quote: null,
    counter: null,
    finalOffer: false,
    agreedPrice: null,
    closedAt: null,
    settled: false,
    readAt: now,
    idleDays: 0,
  };
}

// ---------------------------------------------------------------------------
// Reading a deal's state

/** Messages that have "arrived" by now. */
export function visibleMessages(deal: Deal, now: GameTime): TextMessage[] {
  return deal.messages.filter((m) => m.t <= now);
}

export function isWaiting(deal: Deal, now: GameTime): boolean {
  return deal.messages.some((m) => m.t > now);
}

export type DealStatus = 'your_turn' | 'waiting' | 'won' | 'lost';

export function dealStatus(deal: Deal, now: GameTime): DealStatus {
  if (isWaiting(deal, now)) return 'waiting';
  if (deal.stage === 'won') return 'won';
  if (deal.stage === 'lost') return 'lost';
  return 'your_turn';
}

export function unreadCount(deal: Deal, now: GameTime): number {
  return deal.messages.filter((m) => m.from === 'them' && m.t <= now && m.t > deal.readAt).length;
}

// ---------------------------------------------------------------------------
// Text choices

export interface TextContext {
  now: GameTime;
  playerName: string;
  agencyName: string;
  reputation: number;
  devLevel: number;
}

export interface TextChoice {
  id: string;
  label: string;
  hint?: string;
}

/** The special choice id that opens the quote builder instead of sending a text. */
export const OPEN_QUOTE = 'open_quote';

const agency = (ctx: TextContext) => ctx.agencyName.replace(/\.+$/, '');

export function textChoices(deal: Deal, biz: Business): TextChoice[] {
  const first = firstName(biz.ownerName);
  switch (deal.stage) {
    case 'intro':
      return [
        { id: 'intro_pro', label: `“Hi ${first}, great talking earlier! Mind if I ask a few quick questions so I can put a quote together?”` },
        { id: 'intro_casual', label: `“hey ${first}! it’s me from the call 😊 what are you hoping to get out of a new site?”` },
        { id: 'intro_price', label: '“Hi! Sites like yours usually cost around this much. Want me to send a quote?”', hint: 'Skip the small talk' },
      ];
    case 'discovery': {
      const qs: TextChoice[] = [];
      if (!deal.known.features) qs.push({ id: 'q_features', label: 'Ask what the website needs to do' });
      if (!deal.known.budget) qs.push({ id: 'q_budget', label: 'Ask about their budget' });
      if (!deal.known.deadline) qs.push({ id: 'q_deadline', label: 'Ask when they need it by' });
      if (!deal.known.content) qs.push({ id: 'q_content', label: 'Ask if they have a logo, photos and text' });
      qs.push({ id: OPEN_QUOTE, label: deal.quote ? 'Send a new quote' : 'Write up a quote', hint: 'Takes 20 min' });
      return qs;
    }
    case 'negotiating': {
      const counter = deal.counter ?? 0;
      const out: TextChoice[] = [{ id: 'neg_accept', label: `Accept their offer of $${counter.toLocaleString()}` }];
      if (!deal.finalOffer && deal.quote) {
        const mid = round50((deal.quote.price + counter) / 2);
        out.push({ id: 'neg_middle', label: `Meet in the middle at $${mid.toLocaleString()}` });
        out.push({ id: 'neg_firm', label: `Hold firm at $${deal.quote.price.toLocaleString()} and explain why`, hint: 'Risky' });
      }
      out.push({ id: 'neg_walk', label: 'Politely walk away' });
      return out;
    }
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Sending texts

function youText(id: string, deal: Deal, biz: Business, ctx: TextContext): string {
  const first = firstName(biz.ownerName);
  const typical = marketPrice(deal.needs.pages, []);
  switch (id) {
    case 'intro_pro':
      return `Hi ${first}, it’s ${ctx.playerName} from ${agency(ctx)}. Great talking earlier! Mind if I ask a few quick questions so I can put a quote together?`;
    case 'intro_casual':
      return `hey ${first}! it’s ${ctx.playerName} from the call 😊 what are you hoping to get out of a new site?`;
    case 'intro_price':
      return `Hi ${first}, ${ctx.playerName} here. Sites like yours usually start around $${typical.toLocaleString()}. Want me to send a quote?`;
    case 'q_features':
      return 'What would you want people to be able to do on the website?';
    case 'q_budget':
      return 'Do you have a rough budget in mind?';
    case 'q_deadline':
      return 'When would you ideally want it live?';
    case 'q_content':
      return 'Do you already have a logo, photos and text for the site, or would you need help with that?';
    default:
      return '';
  }
}

function listPhrases(features: Feature[]): string {
  const phrases = features.filter((f) => FEATURES[f].phrase).map((f) => FEATURES[f].phrase);
  if (phrases.length <= 1) return phrases[0] ?? 'find us';
  return `${phrases.slice(0, -1).join(', ')} and ${phrases[phrases.length - 1]}`;
}

function pagesHint(pages: number): string {
  if (pages <= 3) return 'Nothing fancy, just a few pages.';
  if (pages <= 6) return `Maybe ${pages} pages or so?`;
  return `We offer a lot of services, so probably ${pages}-ish pages.`;
}

const INTRO_EFFECT: Record<string, Record<Temperament, number>> = {
  intro_pro: { friendly: 5, busy: 2, skeptical: 6, grumpy: 3 },
  intro_casual: { friendly: 8, busy: 0, skeptical: -6, grumpy: -4 },
  intro_price: { friendly: -3, busy: 6, skeptical: -5, grumpy: 2 },
};

function introReply(id: string, delta: number, biz: Business, rand: Rand): string {
  if (id === 'intro_price') {
    return delta > 0 ? 'Sure, send it over.' : 'Hm, that’s more than I expected. What would I actually get for that?';
  }
  if (delta >= 5) return pick(['Of course! Ask away.', 'Sure thing, go ahead.'], rand);
  if (delta >= 0) return pick(['Ok.', 'Go ahead.', 'Sure.'], rand);
  return biz.temperament === 'skeptical' ? 'Sorry, who is this again?' : 'uh, ok';
}

/** Sends a normal text (not a quote) and schedules their reply. */
export function sendText(deal: Deal, biz: Business, choiceId: string, ctx: TextContext, rand: Rand = defaultRand): Deal {
  if (isWaiting(deal, ctx.now) || choiceId === OPEN_QUOTE) return deal;
  if (!textChoices(deal, biz).some((c) => c.id === choiceId)) return deal;

  const t = biz.temperament;
  const at = replyTime(ctx.now, t, rand);
  let d: Deal = { ...deal, idleDays: 0 };

  // --- Negotiation ---
  if (deal.stage === 'negotiating') return negotiate(d, biz, choiceId, ctx, rand);

  const mine = msg('you', youText(choiceId, deal, biz, ctx), ctx.now);

  // --- First text ---
  if (deal.stage === 'intro') {
    const delta = INTRO_EFFECT[choiceId][t];
    d = { ...d, stage: 'discovery', warmth: clamp(d.warmth + delta, 0, 100) };
    return { ...d, messages: [...d.messages, mine, msg('them', introReply(choiceId, delta, biz, rand), at)] };
  }

  // --- Discovery questions ---
  const annoyed = d.patience <= 0;
  let reply = '';
  let warmthDelta = 0;
  const known = { ...d.known };
  let budgetHint = d.budgetHint;
  const n = d.needs;

  switch (choiceId) {
    case 'q_features':
      known.features = true;
      warmthDelta = 3;
      reply = `Mostly we need people to be able to ${listPhrases(n.features)}. ${pagesHint(n.pages)}`;
      break;
    case 'q_budget':
      known.budget = true;
      if (t === 'skeptical' && chance(0.5, rand)) {
        warmthDelta = -2;
        reply = 'I’d rather see your price first.';
      } else if (t === 'grumpy') {
        // Grumpy owners lowball you.
        budgetHint = [round50(biz.budget * 0.55), round50(biz.budget * 0.85)];
        reply = `As cheap as possible, honestly. Maybe $${budgetHint[0].toLocaleString()}–$${budgetHint[1].toLocaleString()}?`;
      } else {
        budgetHint = [round50(biz.budget * 0.8), round50(biz.budget * 1.1)];
        reply = `We were thinking somewhere around $${budgetHint[0].toLocaleString()}–$${budgetHint[1].toLocaleString()}.`;
      }
      break;
    case 'q_deadline': {
      known.deadline = true;
      warmthDelta = 1;
      const weeks = Math.round(n.deadlineDays / 7);
      reply = n.deadlineDays < 14 ? 'As soon as possible! Two weeks max, ideally.' : `Ideally in the next ${weeks} weeks or so.`;
      break;
    }
    case 'q_content':
      known.content = true;
      warmthDelta = 1;
      reply = n.hasContent
        ? 'We’ve got a logo and plenty of photos. I can write some text too.'
        : 'Not really, no. We don’t even have a proper logo. Could you handle that part too?';
      break;
  }

  if (annoyed) {
    warmthDelta -= 10;
    reply = `${reply} Can you just send me a price? I’m pretty busy.`;
  }

  return {
    ...d,
    known,
    budgetHint,
    patience: d.patience - 1,
    warmth: clamp(d.warmth + warmthDelta, 0, 100),
    messages: [...d.messages, mine, msg('them', reply, at)],
  };
}

// ---------------------------------------------------------------------------
// Quotes

export type QuoteVerdict =
  | { kind: 'accept' }
  | { kind: 'counter'; counter: number }
  | { kind: 'revise'; missing: Feature[] }
  | { kind: 'reject'; reason: 'price' | 'features' };

/** How the client judges your quote. Higher score = more likely to say yes. */
export function evaluateQuote(deal: Deal, biz: Business, quote: Quote, reputation: number, rand: Rand = defaultRand): QuoteVerdict {
  const n = deal.needs;
  const missing = n.features.filter((f) => !quote.features.includes(f));
  let score = deal.warmth * 0.5 + Math.min(10, reputation * 0.5) + randInt(-6, 6, rand);

  score -= missing.length * 14;
  if (quote.pages < n.pages) score -= (n.pages - quote.pages) * 5;

  const r = quote.price / biz.budget;
  if (r <= 0.6) score += 18;
  else if (r <= 0.85) score += 12;
  else if (r <= 1) score += 5;
  else if (r <= 1.2) score -= 8;
  else if (r <= 1.5) score -= 22;
  else score -= 40;
  // Suspiciously cheap makes careful people nervous.
  if (r < 0.4 && biz.temperament === 'skeptical') score -= 14;

  if (quote.days > n.deadlineDays) score -= 10;
  else if (quote.days <= n.deadlineDays * 0.7) score += 3;

  if (quote.depositPct === 50) score -= biz.temperament === 'skeptical' ? 8 : 3;
  else if (quote.depositPct === 25) score -= 1;
  else score += 2;

  // Each extra quote wears their patience.
  if (deal.quote) score -= 6;

  if (score >= 35 && missing.length === 0) return { kind: 'accept' };
  if (score >= 38) return { kind: 'accept' };
  if (missing.length > 0 && score >= 12 && !deal.quote) return { kind: 'revise', missing };
  if (score >= 18 && r > 0.7) {
    const counter = round50(Math.min(quote.price * 0.88, biz.budget * (0.85 + rand() * 0.15)));
    return { kind: 'counter', counter };
  }
  return { kind: 'reject', reason: missing.length > 1 ? 'features' : 'price' };
}

export const QUOTE_MINUTES = 20;

export function sendQuote(deal: Deal, biz: Business, quote: Quote, ctx: TextContext, rand: Rand = defaultRand): Deal {
  if (isWaiting(deal, ctx.now) || deal.stage !== 'discovery') return deal;
  const sentAt = ctx.now;
  const at = replyTime(sentAt, biz.temperament, rand, 45, 200);
  const verdict = evaluateQuote(deal, biz, quote, ctx.reputation, rand);
  const mine = msg('you', 'Here’s my quote. Let me know what you think!', sentAt, quote);
  let d: Deal = { ...deal, quote, idleDays: 0 };

  switch (verdict.kind) {
    case 'accept':
      return {
        ...d,
        stage: 'won',
        agreedPrice: quote.price,
        closedAt: at,
        messages: [...d.messages, mine, msg('them', `This looks great. Let’s do it!${quote.depositPct ? ' I’ll send the deposit today.' : ''}`, at)],
      };
    case 'counter':
      return {
        ...d,
        stage: 'negotiating',
        counter: verdict.counter,
        messages: [...d.messages, mine, msg('them', `Looks good, but it’s more than we wanted to spend. Could you do $${verdict.counter.toLocaleString()}?`, at)],
      };
    case 'revise': {
      const names = verdict.missing.map((f) => FEATURES[f].label.toLowerCase()).join(' and ');
      d = { ...d, warmth: clamp(d.warmth - 4, 0, 100), known: { ...d.known, features: true } };
      return {
        ...d,
        messages: [...d.messages, mine, msg('them', `Hmm, I was hoping it would include ${names}. Could you send an updated quote?`, at)],
      };
    }
    case 'reject':
      return {
        ...d,
        stage: 'lost',
        closedAt: at,
        messages: [
          ...d.messages,
          mine,
          msg('them', verdict.reason === 'price' ? 'Sorry, that’s way more than we can spend right now. Thanks though.' : 'Thanks, but this isn’t really what we need. We’ll pass.', at),
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Negotiation

function negotiate(deal: Deal, biz: Business, choiceId: string, ctx: TextContext, rand: Rand): Deal {
  const counter = deal.counter!;
  const price = deal.quote!.price;
  const at = replyTime(ctx.now, biz.temperament, rand, 10, 90);
  const won = (agreed: number, you: string, them: string, warmthDelta = 0): Deal => ({
    ...deal,
    stage: 'won',
    agreedPrice: agreed,
    warmth: clamp(deal.warmth + warmthDelta, 0, 100),
    closedAt: at,
    messages: [...deal.messages, msg('you', you, ctx.now), msg('them', them, at)],
  });
  const lost = (you: string, them: string): Deal => ({
    ...deal,
    stage: 'lost',
    closedAt: at,
    messages: [...deal.messages, msg('you', you, ctx.now), msg('them', them, at)],
  });
  const final = (you: string, them: string): Deal => ({
    ...deal,
    finalOffer: true,
    messages: [...deal.messages, msg('you', you, ctx.now), msg('them', them, at)],
  });

  switch (choiceId) {
    case 'neg_accept':
      return won(counter, `Deal! $${counter.toLocaleString()} works for me.`, 'Great, let’s get started!');

    case 'neg_middle': {
      const mid = round50((price + counter) / 2);
      const p = clamp(0.55 + (deal.warmth - 50) / 100, 0.15, 0.9);
      const you = `How about we meet in the middle at $${mid.toLocaleString()}?`;
      return chance(p, rand)
        ? won(mid, you, 'Ok, that’s fair. Deal.')
        : final(you, `Sorry, $${counter.toLocaleString()} is really the most we can do.`);
    }

    case 'neg_firm': {
      const p = clamp(0.3 + (deal.warmth - 50) / 100 - (price / counter - 1) * 1.5, 0.05, 0.8);
      const you = 'I hear you. That price covers everything we talked about, and I can’t go lower without cutting corners.';
      if (chance(p, rand)) return won(price, you, 'Alright, fair enough. Let’s do it.', -5);
      if (chance(0.5, rand)) return lost(you, 'Then I think we’ll pass for now. Thanks anyway.');
      return final(you, `I get it, but $${counter.toLocaleString()} is my final offer.`);
    }

    case 'neg_walk': {
      const you = 'Sorry, I can’t do it for that. Let me know if anything changes!';
      // Sometimes walking away makes them realize they want you.
      if (chance(0.15, rand)) return won(price, you, 'Wait — actually, ok. Let’s do it at your price.');
      return lost(you, 'Ok, no worries. Good luck!');
    }
  }
  return deal;
}

// ---------------------------------------------------------------------------
// End of day

/** Warmth lost for each full day you leave a client waiting. */
export const IDLE_WARMTH_LOSS = 8;
const GHOST_BELOW = 12;

/** Called at the end of each day. Clients you ignore cool off and may ghost you. */
export function endOfDayDeal(deal: Deal, biz: Business, dayEnd: GameTime, nextDayStart: GameTime, rand: Rand = defaultRand): Deal {
  if (deal.stage === 'won' || deal.stage === 'lost') return deal;
  if (isWaiting(deal, dayEnd)) return { ...deal, idleDays: 0 };

  const warmth = deal.warmth - IDLE_WARMTH_LOSS;
  const idleDays = deal.idleDays + 1;
  if (warmth < GHOST_BELOW) {
    const at = nextDayStart + randInt(0, 120, rand);
    return {
      ...deal,
      warmth,
      idleDays,
      stage: 'lost',
      closedAt: at,
      messages: [...deal.messages, msg('them', 'Hey, we’ve decided to hold off on the website for now. Thanks anyway.', at)],
    };
  }
  if (idleDays === 1) {
    const at = nextDayStart + randInt(30, 150, rand);
    const text = biz.temperament === 'friendly' ? 'Hey! Just checking in, are we still doing this? 🙂' : 'Still interested?';
    return { ...deal, warmth, idleDays, messages: [...deal.messages, msg('them', text, at)] };
  }
  return { ...deal, warmth, idleDays };
}
