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
import { pickupMultiplier } from './time';
import { priceText, type PricePlan } from './pricing';

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
  // Big jobs. Mostly big clients ask for these.
  accounts: { label: 'Member accounts', price: 1400, days: 7, devLevel: 3, phrase: 'log in to their own account' },
  locations: { label: 'Many locations', price: 900, days: 4, devLevel: 2, phrase: 'find the location nearest them' },
  delivery: { label: 'Delivery ordering', price: 1500, days: 7, devLevel: 3, phrase: 'order delivery and track it' },
  multilang: { label: 'Multi-language', price: 800, days: 4, devLevel: 1, phrase: 'read the site in their own language' },
  copywriting: { label: 'Copywriting & photos', price: 250, days: 2, devLevel: 1, phrase: '' },
};

export const FEATURE_ORDER: Feature[] = [
  'contact_form', 'gallery', 'maps', 'reviews', 'menu', 'blog', 'booking', 'listings', 'online_store',
  'accounts', 'locations', 'delivery', 'multilang', 'copywriting',
];

export const INDUSTRY_NEEDS: Record<Industry, { core: Feature[]; extra: Feature[] }> = {
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

/** Big extras that big clients in each industry often want, on top of many locations. */
export const BIG_EXTRAS: Record<Industry, Feature[]> = {
  plumbing: [],
  restaurant: ['delivery'],
  salon: ['accounts'],
  dentist: ['accounts'],
  landscaping: [],
  auto: [],
  bakery: ['delivery'],
  fitness: ['accounts'],
  law: ['accounts'],
  realestate: ['accounts'],
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

/** How likely each kind of owner is to text back right away, if they're free. */
const INSTANT_REPLY: Record<Temperament, number> = { friendly: 0.35, busy: 0.06, skeptical: 0.14, grumpy: 0.1 };

/**
 * When the client will reply. People don't text back late at night.
 * Sometimes they're free with their phone in hand and answer right away. That
 * happens less when they're busy (lunch, end of the day) and for busy owners.
 * `quick` scales that chance. Use 0 for things that always take a while.
 */
export function replyTime(now: GameTime, t: Temperament, rand: Rand, min = 10, max = 60, quick = 1): GameTime {
  if (quick > 0) {
    const { day, minute } = fromGameTime(now);
    if (minute >= 8 * 60 && minute < 21 * 60) {
      const free = INSTANT_REPLY[t] * pickupMultiplier(day, minute) * quick;
      if (chance(Math.min(0.6, free), rand)) return now;
    }
  }
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

export function textMessage(from: TextMessage['from'], text: string, t: GameTime, quote?: Quote): TextMessage {
  return { id: uid('msg'), from, text, t, ...(quote ? { quote } : {}) };
}

export function rollNeeds(biz: Business, rand: Rand = defaultRand): ClientNeeds {
  const { core, extra } = INDUSTRY_NEEDS[biz.industry];
  const hasContent = chance(0.55, rand);
  if (biz.size === 'large') {
    // A chain or company: every branch on the site, more pages and bigger features, but more time to build it.
    const features: Feature[] = [...core, ...extra.filter(() => chance(0.6, rand)), 'locations', ...BIG_EXTRAS[biz.industry].filter(() => chance(0.75, rand))];
    if (chance(0.4, rand)) features.push('multilang');
    if (!hasContent) features.push('copywriting');
    return { features, pages: randInt(10, 14, rand), deadlineDays: randInt(25, 50, rand), hasContent };
  }
  const features = [...core, ...extra.filter(() => chance(0.4, rand))];
  if (!hasContent) features.push('copywriting');
  const pages = { solo: randInt(3, 4, rand), small: randInt(4, 6, rand), medium: randInt(6, 9, rand) }[biz.size as 'solo' | 'small' | 'medium'];
  return { features, pages, deadlineDays: randInt(10, 35, rand), hasContent };
}

export function createDeal(biz: Business, warmth: number, now: GameTime, rand: Rand = defaultRand, caller?: string): Deal {
  return {
    id: uid('deal'),
    businessId: biz.id,
    stage: 'intro',
    messages: [
      textMessage('system', `${caller ? `${caller} (your sales caller)` : 'You'} spoke on the phone. ${firstName(biz.ownerName)} said to text them.`, now),
    ],
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

type NeedKey = keyof Deal['known'];

/** What you've actually learned by now. An answer only counts once their reply has arrived. */
export function knownBy(deal: Deal, now: GameTime): Deal['known'] {
  const out = { ...deal.known };
  for (const key of Object.keys(out) as NeedKey[]) {
    if (out[key] && (deal.knownAt?.[key] ?? 0) > now) out[key] = false;
  }
  return out;
}

/** Remember that you asked about something. You learn the answer when their reply arrives at `at`. */
function learn(d: Deal, key: NeedKey, at: GameTime): Deal {
  if (d.known[key]) return d;
  return { ...d, known: { ...d.known, [key]: true }, knownAt: { ...d.knownAt, [key]: at } };
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
      const fmt = (amount: number) => priceText(deal.plan, amount);
      const out: TextChoice[] = [{ id: 'neg_accept', label: `Accept their offer of ${fmt(counter)}` }];
      if (!deal.finalOffer && deal.quote) {
        const mid = round50((deal.quote.price + counter) / 2);
        out.push({ id: 'neg_middle', label: `Meet in the middle at ${fmt(mid)}` });
        out.push({ id: 'neg_firm', label: `Hold firm at ${fmt(deal.quote.price)} and explain why`, hint: 'Risky' });
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

function youText(id: string, deal: Deal, biz: Business, ctx: TextContext, rand: Rand = defaultRand): string {
  const first = firstName(biz.ownerName);
  const me = ctx.playerName;
  const typical = marketPrice(deal.needs.pages, []);
  const options: Record<string, string[]> = {
    intro_pro: [
      `Hi ${first}, it’s ${me} from ${agency(ctx)}. Great talking earlier! Mind if I ask a few quick questions so I can put a quote together?`,
      `Hi ${first}! ${me} from ${agency(ctx)} here, thanks for chatting. Could I ask a few quick questions so I can work out a quote?`,
      `Hello ${first}, this is ${me} from ${agency(ctx)}. Thanks for your time on the phone. Do you have a minute for a few questions about the site?`,
    ],
    intro_casual: [
      `hey ${first}! it’s ${me} from the call 😊 what are you hoping to get out of a new site?`,
      `hi ${first}, ${me} here from the call earlier 🙂 what would you love a new website to do for you?`,
      `hey ${first}! ${me} again 👋 got a sec to tell me what you’re after with the site?`,
    ],
    intro_price: [
      `Hi ${first}, ${me} here. Sites like yours usually start around $${typical.toLocaleString()}. Want me to send a quote?`,
      `Hi ${first}, it’s ${me}. Just so you have a number in mind, a site like yours usually starts at about $${typical.toLocaleString()}. Should I put a quote together?`,
    ],
    q_features: [
      'What would you want people to be able to do on the website?',
      'What should customers be able to do on the site? Book, order, get in touch, that kind of thing?',
      'What’s the most important thing the website needs to do for you?',
    ],
    q_budget: [
      'Do you have a rough budget in mind?',
      'Have you set aside a budget for this, even a ballpark?',
      'So I don’t send you something way off, roughly what are you hoping to spend?',
    ],
    q_deadline: [
      'When would you ideally want it live?',
      'Is there a date you’d like the site ready by?',
      'How soon do you need it? Any deadline I should know about?',
    ],
    q_content: [
      'Do you already have a logo, photos and text for the site, or would you need help with that?',
      'Do you have your logo and some good photos ready, or should I help with that too?',
      'Is the content (logo, photos, wording) sorted, or would you like me to take care of it?',
    ],
  };
  return pick(options[id] ?? [''], rand);
}

/** Picks a line to suit how the owner talks. Falls back to the plain ones. */
function byMood<T>(t: Temperament, lines: Partial<Record<Temperament, T[]>> & { any: T[] }, rand: Rand): T {
  return pick([...(lines[t] ?? []), ...lines.any], rand);
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
  const t = biz.temperament;
  if (id === 'intro_price') {
    return delta > 0
      ? pick(['Sure, send it over.', 'Okay, that sounds about right. Send me the quote.', 'Alright, go ahead and send it.'], rand)
      : pick(['That’s more than I expected. What would I actually get for that?', 'Hm, that’s a lot. What does that cover?', 'Whoa, that’s more than I was thinking. What do I get?'], rand);
  }
  if (delta >= 5) {
    return byMood(t, {
      friendly: ['Of course! Ask away 😊', 'Hi! Yes, absolutely, go ahead.', 'Great to hear from you! Ask me anything.'],
      busy: ['Yep, quickly though.', 'Sure, make it fast, I’m in the middle of something.'],
      skeptical: ['Okay, I remember you. Go on.', 'Alright. What do you need to know?'],
      any: ['Of course! Ask away.', 'Sure thing, go ahead.', 'Yep, what do you want to know?'],
    }, rand);
  }
  if (delta >= 0) return pick(['Ok.', 'Go ahead.', 'Sure.', 'Yeah, what is it?', 'Sure, what do you need?'], rand);
  return t === 'skeptical'
    ? pick(['Sorry, who is this again?', 'Who is this? I don’t have this number saved.'], rand)
    : pick(['uh, ok', 'ok... what is this about?', 'oh. okay.'], rand);
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

  const mine = textMessage('you', youText(choiceId, deal, biz, ctx, rand), ctx.now);

  // --- First text ---
  if (deal.stage === 'intro') {
    const delta = INTRO_EFFECT[choiceId][t];
    d = { ...d, stage: 'discovery', warmth: clamp(d.warmth + delta, 0, 100) };
    return { ...d, messages: [...d.messages, mine, textMessage('them', introReply(choiceId, delta, biz, rand), at)] };
  }

  // --- Discovery questions ---
  const annoyed = d.patience <= 0;
  let reply = '';
  let warmthDelta = 0;
  let budgetHint = d.budgetHint;
  let asked: NeedKey | null = null;
  const n = d.needs;

  switch (choiceId) {
    case 'q_features':
      asked = 'features';
      warmthDelta = 3;
      reply = byMood(t, {
        friendly: [`Oh, good question! Mostly we want people to ${listPhrases(n.features)}. ${pagesHint(n.pages)}`],
        busy: [`Quick version: people need to ${listPhrases(n.features)}. ${pagesHint(n.pages)}`],
        grumpy: [`Just the basics. People should be able to ${listPhrases(n.features)}. ${pagesHint(n.pages)}`],
        any: [
          `Mostly we need people to be able to ${listPhrases(n.features)}. ${pagesHint(n.pages)}`,
          `Honestly, the main thing is that people can ${listPhrases(n.features)}. ${pagesHint(n.pages)}`,
          `I’d say: ${listPhrases(n.features)}. That’s the big stuff. ${pagesHint(n.pages)}`,
        ],
      }, rand);
      break;
    case 'q_budget':
      asked = 'budget';
      if (t === 'skeptical' && chance(0.5, rand)) {
        warmthDelta = -2;
        reply = pick(['I’d rather see your price first.', 'Why don’t you tell me what it costs first?', 'I’d rather not say yet. What would you charge?'], rand);
      } else if (t === 'grumpy') {
        // Grumpy owners lowball you.
        budgetHint = [round50(biz.budget * 0.55), round50(biz.budget * 0.85)];
        const range = `$${budgetHint[0].toLocaleString()}–$${budgetHint[1].toLocaleString()}`;
        reply = pick([`As cheap as possible, honestly. Maybe ${range}?`, `Not much. Around ${range}, tops.`, `I’m not made of money. ${range}.`], rand);
      } else {
        budgetHint = [round50(biz.budget * 0.8), round50(biz.budget * 1.1)];
        const range = `$${budgetHint[0].toLocaleString()}–$${budgetHint[1].toLocaleString()}`;
        reply = pick([`We were thinking somewhere around ${range}.`, `Probably ${range}, depending on what we get.`, `I’d say about ${range}.`, `We’ve set aside roughly ${range}.`], rand);
      }
      break;
    case 'q_deadline': {
      asked = 'deadline';
      warmthDelta = 1;
      const weeks = Math.round(n.deadlineDays / 7);
      reply =
        n.deadlineDays < 14
          ? pick(['As soon as possible! Two weeks max, ideally.', 'Pretty soon, honestly. Within two weeks would be great.', 'We’re in a bit of a rush. Two weeks if you can.'], rand)
          : pick([`Ideally in the next ${weeks} weeks or so.`, `No huge rush, maybe ${weeks} weeks?`, `Within ${weeks} weeks would be nice.`, `We’d like it done in about ${weeks} weeks.`], rand);
      break;
    }
    case 'q_content':
      asked = 'content';
      warmthDelta = 1;
      reply = n.hasContent
        ? pick(['We’ve got a logo and plenty of photos. I can write some text too.', 'Yeah, we have a logo and lots of photos. I’ll send them over.', 'Logo and photos are sorted. The wording I’m happy to write myself.'], rand)
        : pick(['Not really, no. We don’t even have a proper logo. Could you handle that part too?', 'Honestly no, we’d need help with all of that. Can you do it?', 'We have a few old photos on my phone and that’s about it. Can you take care of that part?'], rand);
      break;
  }

  if (annoyed) {
    warmthDelta -= 10;
    reply = `${reply} ${pick(['Can you just send me a price? I’m pretty busy.', 'Look, can you just send a quote? I’ve got a lot on.', 'This is a lot of questions. Just send me a price.'], rand)}`;
  }

  if (asked) d = learn(d, asked, at);
  return {
    ...d,
    budgetHint,
    patience: d.patience - 1,
    warmth: clamp(d.warmth + warmthDelta, 0, 100),
    messages: [...d.messages, mine, textMessage('them', reply, at)],
  };
}

// ---------------------------------------------------------------------------
// Quotes

export type QuoteVerdict =
  | { kind: 'accept' }
  | { kind: 'counter'; counter: number }
  | { kind: 'revise'; missing: Feature[] }
  | { kind: 'reject'; reason: 'price' | 'features' | 'plan' };

/** How likely a client is to choose a monthly plan when you offer both. */
function retainerLean(biz: Business): number {
  const base = { friendly: 0.5, busy: 0.55, skeptical: 0.2, grumpy: 0.25 }[biz.temperament];
  const size = { solo: 0.1, small: 0, medium: -0.1, large: -0.15 }[biz.size];
  return clamp(base + size + (biz.website === 'none' ? 0.1 : 0), 0.05, 0.9);
}

/** Which way they'll pay: fixed if you offered one way, their pick if you offered both. */
export function choosePlan(quote: Quote, biz: Business, rand: Rand = defaultRand): PricePlan {
  if (quote.plan === 'retainer') return 'retainer';
  if (quote.plan === 'either') return chance(retainerLean(biz), rand) ? 'retainer' : 'buyout';
  return 'buyout';
}

/** How a monthly plan sits with each kind of owner. Some love not worrying about hosting, some hate subscriptions. */
const RETAINER_FIT: Record<Temperament, number> = { friendly: 3, busy: 4, skeptical: -9, grumpy: -7 };

/** How the client judges your quote. Higher score = more likely to say yes. */
export function evaluateQuote(
  deal: Deal,
  biz: Business,
  quote: Quote,
  reputation: number,
  rand: Rand = defaultRand,
  plan: PricePlan = quote.plan === 'retainer' ? 'retainer' : 'buyout',
): QuoteVerdict {
  const n = deal.needs;
  const missing = n.features.filter((f) => !quote.features.includes(f));
  let score = deal.warmth * 0.5 + Math.min(10, reputation * 0.5) + randInt(-6, 6, rand);

  score -= missing.length * 14;
  if (quote.pages < n.pages) score -= (n.pages - quote.pages) * 5;

  // A small monthly fee feels lighter than one big payment, and who doesn't like hosting taken care of.
  // But not everyone wants to be tied to a subscription.
  let planFit = 0;
  if (plan === 'retainer') planFit = RETAINER_FIT[biz.temperament] + (biz.size === 'solo' ? 2 : 0);
  if (quote.plan === 'either') planFit += 3; // they like having a choice
  score += planFit;

  // A returning client has a budget for this job, not their whole site.
  const budget = deal.budget ?? biz.budget;
  const r = (plan === 'retainer' ? quote.price * 0.85 : quote.price) / budget;
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
    const counter = round50(Math.min(quote.price * 0.88, budget * (0.85 + rand() * 0.15)));
    return { kind: 'counter', counter };
  }
  // If only the monthly plan put them off, say so.
  if (quote.plan === 'retainer' && planFit < 0 && score - planFit >= 18) return { kind: 'reject', reason: 'plan' };
  return { kind: 'reject', reason: missing.length > 1 ? 'features' : 'price' };
}

export const QUOTE_MINUTES = 20;

const REJECT_TEXT = {
  price: ['Sorry, that’s way more than we can spend right now. Thanks though.', 'That’s a lot more than we budgeted, so we’ll have to pass. Thanks for your time.', 'I appreciate it, but that’s well out of our range.'],
  features: ['Thanks, but this isn’t really what we need. We’ll pass.', 'It’s not quite what we were after, sorry. We’ll look elsewhere.', 'Thanks for the effort, but this isn’t a fit for us.'],
  plan: ['Thanks, but we’d rather not sign up for a monthly plan. We’ll pass.', 'We don’t want another monthly bill, sorry. We’ll pass.', 'A subscription isn’t for us. Thanks anyway!'],
};

/** What they say when they accept. When you offered both ways to pay, they tell you which one they want. */
function acceptText(quote: Quote, plan: PricePlan, rand: Rand): string {
  const deposit = plan === 'buyout' && quote.depositPct ? pick([' I’ll send the deposit today.', ' I’ll get the deposit over to you.'], rand) : '';
  if (quote.plan === 'either') {
    return plan === 'retainer'
      ? pick(
          [
            'This looks great. We’ll take the monthly plan, so we don’t have to worry about hosting. Let’s do it!',
            'Love it. The monthly plan sounds easiest for us, so let’s go with that!',
            'Perfect. We’ll go monthly so someone else deals with the hosting. Let’s get started!',
          ],
          rand,
        )
      : pick(
          [
            `This looks great. We’d rather just buy it outright. Let’s do it!${deposit}`,
            `Looks good! We’ll pay for it in full, no subscriptions for us. Let’s go.${deposit}`,
            `Great, we’ll take the one-time price. Let’s get started!${deposit}`,
          ],
          rand,
        );
  }
  if (plan === 'retainer') return pick(['This looks great. The monthly plan works for us. Let’s do it!', 'Sounds good. We’re happy with the monthly price. Let’s go!'], rand);
  return pick([`This looks great. Let’s do it!${deposit}`, `Perfect, that works for us. Let’s get started!${deposit}`, `Yes, this is what we were hoping for. Let’s go ahead!${deposit}`], rand);
}

export function sendQuote(deal: Deal, biz: Business, quote: Quote, ctx: TextContext, rand: Rand = defaultRand): Deal {
  if (isWaiting(deal, ctx.now) || deal.stage !== 'discovery') return deal;
  const sentAt = ctx.now;
  // Reading a quote takes a bit, so an instant answer is less likely.
  const at = replyTime(sentAt, biz.temperament, rand, 45, 200, 0.4);
  const plan = choosePlan(quote, biz, rand);
  const verdict = evaluateQuote(deal, biz, quote, ctx.reputation, rand, plan);
  const mine = textMessage('you', pick(['Here’s my quote. Let me know what you think!', 'I’ve put together a quote for you. Have a look and tell me what you think!', 'Here you go, my quote for the site. Happy to adjust anything.'], rand), sentAt, quote);
  let d: Deal = { ...deal, quote, idleDays: 0, plan };

  switch (verdict.kind) {
    case 'accept':
      return {
        ...d,
        stage: 'won',
        agreedPrice: quote.price,
        closedAt: at,
        messages: [...d.messages, mine, textMessage('them', acceptText(quote, plan, rand), at)],
      };
    case 'counter':
      return {
        ...d,
        stage: 'negotiating',
        counter: verdict.counter,
        messages: [...d.messages, mine, textMessage('them', pick(
                [
                  `Looks good, but it’s more than we wanted to spend. Could you do ${priceText(plan, verdict.counter)}?`,
                  `I like it, but that’s a bit over our budget. Would ${priceText(plan, verdict.counter)} work?`,
                  `It’s close! Could you get it down to ${priceText(plan, verdict.counter)}?`,
                ],
                rand,
              ), at)],
      };
    case 'revise': {
      const names = verdict.missing.map((f) => FEATURES[f].label.toLowerCase()).join(' and ');
      d = learn({ ...d, warmth: clamp(d.warmth - 4, 0, 100) }, 'features', at);
      return {
        ...d,
        messages: [...d.messages, mine, textMessage('them', pick(
                [
                  `Hmm, I was hoping it would include ${names}. Could you send an updated quote?`,
                  `Nice, but where’s the ${names}? We need that. Can you update it?`,
                  `It looks good, but it’s missing ${names}. Could you add that in?`,
                ],
                rand,
              ), at)],
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
          textMessage('them', pick(REJECT_TEXT[verdict.reason], rand), at),
        ],
      };
  }
}

// ---------------------------------------------------------------------------
// Negotiation

function negotiate(deal: Deal, biz: Business, choiceId: string, ctx: TextContext, rand: Rand): Deal {
  const counter = deal.counter!;
  const price = deal.quote!.price;
  const fmt = (amount: number) => priceText(deal.plan, amount);
  const at = replyTime(ctx.now, biz.temperament, rand, 10, 90, 0.6);
  const won = (agreed: number, you: string, them: string, warmthDelta = 0): Deal => ({
    ...deal,
    stage: 'won',
    agreedPrice: agreed,
    warmth: clamp(deal.warmth + warmthDelta, 0, 100),
    closedAt: at,
    messages: [...deal.messages, textMessage('you', you, ctx.now), textMessage('them', them, at)],
  });
  const lost = (you: string, them: string): Deal => ({
    ...deal,
    stage: 'lost',
    closedAt: at,
    messages: [...deal.messages, textMessage('you', you, ctx.now), textMessage('them', them, at)],
  });
  const final = (you: string, them: string): Deal => ({
    ...deal,
    finalOffer: true,
    messages: [...deal.messages, textMessage('you', you, ctx.now), textMessage('them', them, at)],
  });

  switch (choiceId) {
    case 'neg_accept':
      return won(counter, `Deal! ${fmt(counter)} works for me.`, pick(['Great, let’s get started!', 'Wonderful, thank you! Let’s do it.', 'Perfect, we’re in.'], rand));

    case 'neg_middle': {
      const mid = round50((price + counter) / 2);
      const p = clamp(0.55 + (deal.warmth - 50) / 100, 0.15, 0.9);
      const you = `How about we meet in the middle at ${fmt(mid)}?`;
      return chance(p, rand)
        ? won(mid, you, pick(['Ok, that’s fair. Deal.', 'Alright, meeting in the middle works for me.', 'Fair enough. You’ve got a deal.'], rand))
        : final(you, pick([`Sorry, ${fmt(counter)} is really the most we can do.`, `I wish I could, but ${fmt(counter)} is where we have to stop.`], rand));
    }

    case 'neg_firm': {
      const p = clamp(0.3 + (deal.warmth - 50) / 100 - (price / counter - 1) * 1.5, 0.05, 0.8);
      const you = 'I hear you. That price covers everything we talked about, and I can’t go lower without cutting corners.';
      if (chance(p, rand)) return won(price, you, pick(['Alright, fair enough. Let’s do it.', 'Okay, you’ve convinced me. Let’s go.', 'Fine, that’s reasonable. We’ll take it.'], rand), -5);
      if (chance(0.5, rand)) return lost(you, pick(['Then I think we’ll pass for now. Thanks anyway.', 'In that case we’ll have to pass. Thanks for your time.'], rand));
      return final(you, pick([`I get it, but ${fmt(counter)} is my final offer.`, `I hear you, but ${fmt(counter)} is as high as I can go.`], rand));
    }

    case 'neg_walk': {
      const you = 'Sorry, I can’t do it for that. Let me know if anything changes!';
      // Sometimes walking away makes them realize they want you.
      if (chance(0.15, rand)) return won(price, you, pick(['Wait, actually, okay. Let’s do it at your price.', 'Hold on, don’t go. Okay, your price works.'], rand));
      return lost(you, pick(['Ok, no worries. Good luck!', 'Alright, thanks anyway. Take care!'], rand));
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
      messages: [...deal.messages, textMessage('them', pick(['Hey, we’ve decided to hold off on the website for now. Thanks anyway.', 'We haven’t heard back, so we’re going to put the website on hold. Thanks anyway.', 'Hi, we’ve gone another way for now. Thanks for your time!'], rand), at)],
    };
  }
  if (idleDays === 1) {
    const at = nextDayStart + randInt(30, 150, rand);
    const text =
      biz.temperament === 'friendly'
        ? pick(['Hey! Just checking in, are we still doing this? 🙂', 'Hi! Any news on the website? 😊', 'Hey, still keen to go ahead with the site?'], rand)
        : biz.temperament === 'grumpy'
          ? pick(['Hello? Are you doing this or not?', 'Well? Still doing this?'], rand)
          : pick(['Still interested?', 'Are we still doing this?', 'Hey, any update?'], rand);
    return { ...deal, warmth, idleDays, messages: [...deal.messages, textMessage('them', text, at)] };
  }
  return { ...deal, warmth, idleDays };
}
