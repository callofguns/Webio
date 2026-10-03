// The cold call engine. A call is a small state machine:
//
//   ringing -> (no answer | voicemail | gatekeeper | owner)
//   gatekeeper -> owner | ended
//   owner: opener -> objection (1-2 times) -> close -> ended
//
// Every choice changes the owner's hidden `interest` (0-100) and can use up
// their `patience`. When patience runs out they hang up.
//
// These functions never change their inputs. They return a new CallState,
// which keeps the logic easy to test.

import type { Business, Temperament } from './types';
import { chance, clamp, pick, randInt, shuffle, uid, weighted, type Rand, defaultRand } from './rng';
import { pickupMultiplier } from './time';
import { SILENCE_INTEREST_LOSS } from './balance';

export type Speaker = 'you' | 'them' | 'system';

export interface Line {
  id: string;
  speaker: Speaker;
  text: string;
}

export interface CallChoice {
  id: string;
  label: string;
  /** Short note under the button, e.g. "Needs research". */
  hint?: string;
  disabled?: boolean;
}

export type CallPhase = 'voicemail' | 'gatekeeper' | 'opener' | 'objection' | 'close' | 'ended';

export type CallOutcome =
  | 'no_answer'
  | 'voicemail_left'
  | 'blocked' // gatekeeper wouldn't put you through
  | 'callback'
  | 'not_interested'
  | 'do_not_call'
  | 'interested';

export interface CallContext {
  day: number;
  minute: number;
  playerName: string;
  agencyName: string;
  salesLevel: number;
  reputation: number;
  /** Extra interest from having a real office address. */
  presence?: number;
}

export interface CallState {
  id: string;
  businessId: string;
  phase: CallPhase;
  lines: Line[];
  choices: CallChoice[];
  /** Hidden 0-100 score of how into it the owner is. */
  interest: number;
  /** Bad replies use this up. At 0 they hang up. */
  patience: number;
  objectionsLeft: number;
  usedObjections: ObjectionId[];
  currentObjection: ObjectionId | null;
  /** In-game minutes this call has taken so far. */
  minutes: number;
  xp: number;
  reachedOwner: boolean;
  outcome: CallOutcome | null;
  callback: { day: number; hour: number } | null;
}

// ---------------------------------------------------------------------------
// Helpers

function firstName(full: string): string {
  return full.split(' ')[0];
}

/** Agency name without a trailing period, so "Web Co." doesn't become "Web Co.." mid-sentence. */
function agency(ctx: CallContext): string {
  return ctx.agencyName.replace(/\.+$/, '');
}

function line(speaker: Speaker, text: string): Line {
  return { id: uid('ln'), speaker, text };
}

/** Picks a line nobody has said on this call yet, so people don't repeat themselves. */
function pickFresh(options: readonly string[], call: CallState, rand: Rand): string {
  const said = new Set(call.lines.map((l) => l.text));
  const fresh = options.filter((o) => !said.has(o));
  return pick(fresh.length ? fresh : options, rand);
}

/** Fills in {biz}, {first} and {gk} in a line. */
function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

function niceHour(hour: number): string {
  return `${hour > 12 ? hour - 12 : hour}${hour >= 12 ? 'pm' : 'am'}`;
}

function withLines(call: CallState, ...lines: Line[]): CallState {
  return { ...call, lines: [...call.lines, ...lines] };
}

function end(call: CallState, outcome: CallOutcome, extra: Partial<CallState> = {}): CallState {
  return { ...call, ...extra, phase: 'ended', choices: [], outcome };
}

export function vibe(interest: number): { label: string; step: number } {
  if (interest < 20) return { label: 'Cold', step: 1 };
  if (interest < 40) return { label: 'Cool', step: 2 };
  if (interest < 60) return { label: 'Lukewarm', step: 3 };
  if (interest < 78) return { label: 'Warm', step: 4 };
  return { label: 'Hot', step: 5 };
}

// ---------------------------------------------------------------------------
// Starting a call

const GREETINGS: Record<Temperament, string[]> = {
  friendly: [
    'Hi there, {biz}, {first} speaking. What can I do for you?',
    '{biz}, this is {first}. How can I help you today?',
    'Hello! {biz}, {first} speaking.',
    'Hey, thanks for calling {biz}. This is {first}.',
    '{biz}, {first} here! What can I do for you?',
    'Hi, {biz}, this is {first}. How can I help?',
  ],
  busy: [
    '{biz}, {first} speaking. Make it quick, we’re slammed.',
    'Yeah, {first} here. What’s up? (lots of noise in the background)',
    '{biz}. Hang on one sec... okay, go ahead.',
    '{first} here, I’ve got about a minute. What do you need?',
    'Yep, {biz}. (someone is shouting in the background) Sorry, go ahead.',
    '{biz}, {first}. Can you make it fast?',
  ],
  skeptical: [
    'Hello, {biz}. Who’s calling, please?',
    '{biz}. Who is this?',
    'Yes? Who’s this and what’s it about?',
    '{biz}, {first} speaking. Do I know you?',
    'Hello? I don’t recognize this number. Who’s this?',
    '{biz}. Is this a sales call?',
  ],
  grumpy: [
    'Yeah? Who is this?',
    'What.',
    '{biz}. What do you want?',
    'Yeah, what is it?',
    'If you’re selling something, I’m not buying.',
    '(sighs) {biz}. Go ahead.',
  ],
};

const CALLBACK_GREETINGS = [
  '{first} here. Oh, you’re the web person, right? Go ahead.',
  'Hey, {first} here. You said you’d call back. What have you got?',
  'Oh good, I was hoping that was you. Go ahead.',
];

const VOICEMAIL_GREETINGS = [
  'You’ve reached {biz}. Please leave a message after the tone.',
  'Hi, you’ve reached {biz}. We can’t come to the phone right now. Leave your name and number and we’ll call you back.',
  'Thanks for calling {biz}. Nobody’s available at the moment, so leave a message and we’ll get back to you.',
];

const NO_ANSWER_LINES = ['It rings out. Nobody picks up.', 'It just keeps ringing. Nobody picks up.', 'Ring, ring, ring. Nobody answers.'];

const GATEKEEPER_NAMES = ['Jess', 'Marco', 'Tina', 'Kyle', 'Brenda', 'Sam'];

const GATEKEEPER_GREETINGS = [
  '{biz}, this is {gk}. How can I help?',
  'Hi, {biz}, {gk} speaking.',
  '{biz}, {gk} here. What can I do for you?',
  'Thanks for calling {biz}, this is {gk}.',
];

function baseInterest(biz: Business, ctx: CallContext, rand: Rand): number {
  const fromWebsite = { none: 22, outdated: 20, basic: 12, good: 2 }[biz.website];
  const fromTemper = { friendly: 10, busy: 0, skeptical: -5, grumpy: -10 }[biz.temperament];
  const fromRep = Math.min(15, ctx.reputation * 0.5);
  // Most people aren't looking to buy anything today.
  const mood = randInt(-25, 5, rand);
  return clamp(fromWebsite + fromTemper + fromRep + ctx.salesLevel * 2 + (ctx.presence ?? 0) + mood, 0, 100);
}

function basePatience(t: Temperament): number {
  return { friendly: 3, busy: 2, skeptical: 3, grumpy: 1 }[t];
}

function ownerPicksUp(call: CallState, biz: Business, ctx: CallContext, rand: Rand, greetingOverride?: string): CallState {
  const greeting =
    greetingOverride ??
    fill(pick(GREETINGS[biz.temperament], rand), { biz: biz.name, first: firstName(biz.ownerName) });
  return withLines(
    {
      ...call,
      phase: 'opener',
      reachedOwner: true,
      interest: baseInterest(biz, ctx, rand),
      patience: basePatience(biz.temperament),
      choices: openerChoices(biz),
    },
    line('them', greeting),
  );
}

export function startCall(biz: Business, ctx: CallContext, rand: Rand = defaultRand): CallState {
  let call: CallState = {
    id: uid('call'),
    businessId: biz.id,
    phase: 'opener',
    lines: [line('system', `Calling ${biz.name}…`)],
    choices: [],
    interest: 0,
    patience: 0,
    objectionsLeft: 2,
    usedObjections: [],
    currentObjection: null,
    minutes: 1,
    xp: 1,
    reachedOwner: false,
    outcome: null,
    callback: null,
  };

  // A scheduled callback at the right time almost always reaches the owner.
  const cb = biz.callback;
  const hour = Math.floor(ctx.minute / 60);
  if (cb && cb.day === ctx.day && hour >= cb.hour && hour <= cb.hour + 1 && chance(0.85, rand)) {
    const first = firstName(biz.ownerName);
    const warm = biz.temperament === 'grumpy' ? 'Yeah, I remember. Go ahead.' : fill(pick(CALLBACK_GREETINGS, rand), { first });
    call = ownerPicksUp(call, biz, ctx, rand, warm);
    return { ...call, interest: clamp(call.interest + 8, 0, 100), patience: call.patience + 1 };
  }

  const answerChance = clamp(0.36 * pickupMultiplier(ctx.day, ctx.minute), 0.05, 0.75);
  if (!chance(answerChance, rand)) {
    if (chance(0.55, rand)) {
      return withLines(
        { ...call, phase: 'voicemail', choices: [
          { id: 'leave_vm', label: 'Leave a short voicemail', hint: '+1 min' },
          { id: 'hang_up', label: 'Hang up' },
        ] },
        line('system', fill(pick(VOICEMAIL_GREETINGS, rand), { biz: biz.name })),
      );
    }
    return end(withLines(call, line('system', pick(NO_ANSWER_LINES, rand))), 'no_answer');
  }

  const gatekeeperChance = { solo: 0.1, small: 0.45, medium: 0.8 }[biz.size];
  if (chance(gatekeeperChance, rand)) {
    const gk = pick(GATEKEEPER_NAMES, rand);
    return withLines(
      {
        ...call,
        phase: 'gatekeeper',
        minutes: call.minutes + 1,
        choices: [
          {
            id: 'gk_ask_owner',
            label: biz.researched ? `“Hi! Is ${firstName(biz.ownerName)} available?”` : '“Hi! Can I speak to the owner?”',
            hint: biz.researched ? 'Using their name helps' : 'Research to learn their name',
          },
          { id: 'gk_honest', label: '“I’m a local web designer with an idea for your site. Is the owner in?”' },
          { id: 'gk_best_time', label: '“When’s the best time to catch the owner?”' },
        ],
      },
      line('them', fill(pick(GATEKEEPER_GREETINGS, rand), { biz: biz.name, gk })),
    );
  }

  return ownerPicksUp({ ...call, minutes: call.minutes + 1 }, biz, ctx, rand);
}

// ---------------------------------------------------------------------------
// Openers

const PAIN_PITCH: Record<Business['painPoint'], string> = {
  no_presence: 'you don’t seem to have a website at all',
  not_mobile: 'your website is really hard to use on a phone',
  looks_dated: 'your website looks a bit older than your business deserves',
  no_booking: 'customers can’t book or order from your website',
  hard_to_find: 'you barely show up when I search for your kind of business nearby',
};

function openerChoices(biz: Business): CallChoice[] {
  return [
    {
      id: 'op_specific',
      label: 'Point out a real problem with their online presence',
      hint: biz.researched ? 'You researched them' : 'Needs research first',
      disabled: !biz.researched,
    },
    { id: 'op_question', label: 'Ask how new customers usually find them' },
    { id: 'op_direct', label: 'Get straight to it: “Do you want a new website?”' },
    { id: 'op_hype', label: 'Sound big: “We help businesses 10x their revenue!”' },
  ];
}

/** How much each opener changes interest, by owner temperament. */
const OPENER_EFFECT: Record<string, Record<Temperament, number>> = {
  op_specific: { friendly: 16, busy: 12, skeptical: 20, grumpy: 8 },
  op_question: { friendly: 18, busy: -8, skeptical: 8, grumpy: -5 },
  op_direct: { friendly: 5, busy: 10, skeptical: -5, grumpy: -6 },
  op_hype: { friendly: 2, busy: -10, skeptical: -14, grumpy: -14 },
};

function openerYouLine(id: string, biz: Business, ctx: CallContext, rand: Rand): string {
  const who = biz.researched ? firstName(biz.ownerName) : 'there';
  const intro = pick(
    [`Hi ${who}, I’m ${ctx.playerName} from ${agency(ctx)}.`, `Hey ${who}, ${ctx.playerName} here from ${agency(ctx)}.`, `Hi ${who}, this is ${ctx.playerName} with ${agency(ctx)}.`],
    rand,
  );
  const pain = PAIN_PITCH[biz.painPoint];
  const options: Record<string, string[]> = {
    op_specific: [
      `${intro} I was looking at your business online and noticed ${pain}. I had a couple of ideas that could help.`,
      `${intro} I hope I’m not catching you at a bad time. I noticed ${pain}, and I think it’s an easy fix.`,
      `${intro} The reason I’m calling is that I noticed ${pain}, and I’d love to help with that.`,
    ],
    op_question: [
      `${intro} Quick question, how do most of your new customers find you right now?`,
      `${intro} Can I ask you something real quick? Where do most of your new customers come from?`,
      `${intro} I’m curious, when someone new needs what you do, how do they usually find you?`,
    ],
    op_direct: [
      `${intro} I build websites for local businesses. Would you be interested in a new one?`,
      `${intro} I’ll be quick. I design websites for small businesses around here. Is that something you’d want?`,
      `${intro} I make websites for local businesses. Any chance you’re looking for one?`,
    ],
    op_hype: [
      `${intro} We help businesses like yours 10x their revenue online!`,
      `${intro} We’re a full-service digital growth agency and we can explode your sales!`,
      `${intro} I can seriously double or triple your customers with the right website!`,
    ],
  };
  return pick(options[id] ?? options.op_hype, rand);
}

// ---------------------------------------------------------------------------
// Objections

export type ObjectionId =
  | 'have_site'
  | 'word_of_mouth'
  | 'too_expensive'
  | 'too_busy'
  | 'helper'
  | 'bad_experience'
  | 'facebook'
  | 'diy'
  | 'send_info'
  | 'slow_season'
  | 'partner'
  | 'does_it_work'
  | 'marketing_company'
  | 'who_are_you';

interface Objection {
  /** Different ways of saying the same thing. One is picked each call. */
  texts: string[];
  applies: (biz: Business) => boolean;
  /** How often this comes up compared to the others. */
  weight: number;
  /** [best, okay, bad] replies. Order is shuffled when shown. */
  replies: [string, string, string];
}

const OBJECTIONS: Record<ObjectionId, Objection> = {
  have_site: {
    texts: ['We already have a website.', 'We’ve already got a site, thanks.', 'Yeah, we have a website already.'],
    applies: (b) => b.website !== 'none',
    weight: 3,
    replies: [
      'That’s great. Is it bringing you new customers, or is it more of an online business card?',
      'Sure, but I could make it look a lot better.',
      'Yeah, but honestly, most sites like yours are pretty bad.',
    ],
  },
  word_of_mouth: {
    texts: [
      'Honestly, we get all our work from word of mouth.',
      'Most of our customers come from referrals, so we’re good.',
      'We don’t really need it. People just recommend us.',
    ],
    applies: (b) => b.website === 'none' || b.website === 'outdated',
    weight: 3,
    replies: [
      'That’s the best kind of customer. A website gives those referrals somewhere to land when they look you up.',
      'Word of mouth is great, but a website would get you even more.',
      'Word of mouth is kind of old-school though.',
    ],
  },
  too_expensive: {
    texts: [
      'Websites cost a fortune. We can’t afford that right now.',
      'How much is this going to cost? We don’t have much to spend.',
      'We’re on a tight budget this year.',
    ],
    applies: () => true,
    weight: 3,
    replies: [
      'Fair. I can start simple, one page that gets you calls, and grow it when it pays off.',
      'It’s an investment. It pays for itself.',
      'I’m the cheapest around, seriously. Like, really cheap.',
    ],
  },
  too_busy: {
    texts: [
      'Look, I’m really busy right now.',
      'I’ve got customers waiting, I don’t have time for this.',
      'Can we not do this now? It’s a bad time.',
    ],
    applies: (b) => b.temperament === 'busy' || b.temperament === 'grumpy',
    weight: 3,
    replies: [
      'No problem. Can I text you two quick ideas to look at when you’re free?',
      'It’ll only take two minutes, I promise.',
      'This is really important, you should make time for it.',
    ],
  },
  helper: {
    texts: [
      'My nephew handles all that computer stuff for us.',
      'My son-in-law set up our site, he looks after it.',
      'My daughter does our online stuff. She’s pretty good with it.',
      'A friend of ours built it for free, so we’re covered.',
    ],
    applies: (b) => b.size !== 'medium' && b.website !== 'good',
    // This one used to come up all the time. Keep it rare.
    weight: 0.8,
    replies: [
      'Nice, having someone to help is great. If it ever gets to be too much, I’d be happy to take it off their plate.',
      'Are they a professional designer?',
      'No offense, but that usually doesn’t turn out well.',
    ],
  },
  bad_experience: {
    texts: [
      'We paid someone before and they just disappeared.',
      'We got burned by a web company a couple of years ago. Never again.',
      'The last guy took our money and never finished the site.',
    ],
    applies: (b) => b.temperament === 'skeptical' && b.website !== 'none',
    weight: 3,
    replies: [
      'That’s awful, I’m sorry. I work in stages, so you only pay once you’ve seen each part finished.',
      'Don’t worry, I’m not like those other guys.',
      'Well, that’s kind of what happens when you go cheap.',
    ],
  },
  facebook: {
    texts: [
      'We’ve got a Facebook page. That’s pretty much all we need.',
      'Isn’t Facebook enough these days?',
      'We post on Instagram all the time, and that works fine for us.',
    ],
    applies: (b) => b.website !== 'good',
    weight: 2.5,
    replies: [
      'Social is great for staying in touch. A website is what people find when they search for you, though.',
      'A website looks a lot more professional than a Facebook page.',
      'Facebook is basically dead, nobody uses it anymore.',
    ],
  },
  diy: {
    texts: [
      'I was thinking of just making one myself on Wix or Squarespace.',
      'Can’t I just build one myself online for free?',
      'People keep telling me I can do it myself with one of those drag and drop things.',
    ],
    applies: (b) => b.size !== 'medium',
    weight: 2,
    replies: [
      'You could, and some people do a nice job. Most of my clients just don’t want to spend their evenings on it.',
      'It takes way longer than people think, and it usually looks homemade.',
      'Those never look good, trust me.',
    ],
  },
  send_info: {
    texts: ['Can you just email me something? I’ll look at it later.', 'Just send me some info and I’ll take a look.', 'Send me something in writing and I’ll think about it.'],
    applies: (b) => b.temperament !== 'friendly',
    weight: 2.5,
    replies: [
      'Sure thing. I’ll make it about your business so it’s actually worth your time. What’s the best way to reach you?',
      'Sure, I’ll send over my brochure.',
      'Okay, but I can tell you everything right now in a minute.',
    ],
  },
  slow_season: {
    texts: ['It’s our slow season, so we’re not spending on anything right now.', 'Maybe in the spring. Things are quiet at the moment.', 'Not a good time of year for us. Money’s tight until things pick up.'],
    applies: () => true,
    weight: 2,
    replies: [
      'Quiet times are actually a good time to get it done, so you’re ready when things pick back up.',
      'Okay, but you could be losing customers in the meantime.',
      'Slow season is exactly when you need more business!',
    ],
  },
  partner: {
    texts: ['I’d have to run it by my business partner first.', 'That’s not just my call. I’d need to talk it over with the others here.', 'I don’t decide that stuff on my own.'],
    applies: (b) => b.size !== 'solo',
    weight: 2,
    replies: [
      'Of course. Want me to put a couple of ideas in a text you can pass along to them?',
      'Can you ask them now? It’ll only take a second.',
      'You’re the owner, you should be able to decide.',
    ],
  },
  does_it_work: {
    texts: ['Does a website really bring in customers? I’ve never seen it make a difference.', 'We’ve never needed one. Does it actually help?', 'I’m not convinced a website would change much for us.'],
    applies: (b) => b.website === 'none' || b.website === 'outdated',
    weight: 2.5,
    replies: [
      'Fair question. Think about the last time you looked a place up before going there. Your customers do the same thing.',
      'Yeah, most people check online first these days.',
      'Obviously it works, everyone has one.',
    ],
  },
  marketing_company: {
    texts: ['We already pay a marketing company to handle that.', 'Our marketing person takes care of all of that.'],
    applies: (b) => b.size !== 'solo' && b.website !== 'none',
    weight: 1.5,
    replies: [
      'Good to hear. Are you happy with the results so far? I’m happy to take a quick look and give you an honest opinion.',
      'I can work alongside them if you like.',
      'Marketing companies mostly just take your money.',
    ],
  },
  who_are_you: {
    texts: ['How did you get this number?', 'Who gave you this number?'],
    applies: (b) => b.temperament === 'skeptical' || b.temperament === 'grumpy',
    weight: 2,
    replies: [
      'It’s listed publicly for your business. I only called because I thought I could actually help.',
      'It was online. Can I tell you why I called?',
      'Oh, I just have a big list of businesses.',
    ],
  },
};

const REPLY_EFFECT = [14, 3, -14]; // best, okay, bad

function nextObjection(call: CallState, biz: Business, rand: Rand): ObjectionId | null {
  const options = (Object.keys(OBJECTIONS) as ObjectionId[]).filter(
    (id) => !call.usedObjections.includes(id) && OBJECTIONS[id].applies(biz),
  );
  if (!options.length) return null;
  return weighted(Object.fromEntries(options.map((id) => [id, OBJECTIONS[id].weight])) as Record<ObjectionId, number>, rand);
}

function askObjection(call: CallState, biz: Business, rand: Rand): CallState {
  const id = nextObjection(call, biz, rand);
  if (!id) return goToClose(call);
  const obj = OBJECTIONS[id];
  const order = shuffle([0, 1, 2], rand);
  return withLines(
    {
      ...call,
      phase: 'objection',
      currentObjection: id,
      usedObjections: [...call.usedObjections, id],
      objectionsLeft: call.objectionsLeft - 1,
      choices: order.map((i) => ({ id: `obj_${i}`, label: `“${obj.replies[i]}”` })),
    },
    line('them', pickFresh(obj.texts, call, rand)),
  );
}

// ---------------------------------------------------------------------------
// Closing

const CLOSE_THRESHOLD: Record<string, number> = {
  close_text: 50,
  close_meeting: 70,
  close_later: 12,
};

function goToClose(call: CallState): CallState {
  return {
    ...call,
    phase: 'close',
    currentObjection: null,
    choices: [
      { id: 'close_meeting', label: 'Ask for a quick 15-minute meeting this week', hint: 'Hardest ask, best lead' },
      { id: 'close_text', label: 'Ask if you can text them some ideas and a rough quote' },
      { id: 'close_later', label: 'Ask if you can check back in a couple of weeks', hint: 'Safe, but slow' },
    ],
  };
}

const REACTIONS = {
  great: {
    friendly: [
      'Oh, interesting! Go on.',
      'Huh, I’ve actually been thinking about that.',
      'Oh yeah? Tell me more.',
      'You know, that’s a good point.',
      'Ha, okay, you’ve got my attention.',
    ],
    other: [
      'Okay, that actually makes sense.',
      'Yeah, that’s fair. Keep going.',
      'Alright, I hadn’t thought of it like that.',
      'Okay, you’ve got my attention. What else?',
      'Huh. Fair enough.',
      'Okay, go on then.',
    ],
  },
  fine: ['Yeah.', 'Okay.', 'Right.', 'Sure, I get that.', 'Yeah, I can see that.', 'Okay, go on.', 'Mhm, okay.', 'Alright.'],
  meh: ['I guess.', 'Okay, sure.', 'Yeah, maybe.', 'If you say so.', 'I mean, maybe.', 'Uh-huh.', 'Sure, whatever you say.'],
  bad: {
    rough: [
      '(sighs) Yeah, I’ve heard that one before.',
      'Look, I don’t have time for a sales pitch.',
      'I get ten of these calls a week.',
      'Yeah, everybody says that.',
      'Right. And what are you really selling?',
    ],
    polite: [
      'I don’t know, that sounds like a sales line.',
      'I’m not so sure about that.',
      'Eh, I don’t really buy that.',
      'That feels a bit pushy, honestly.',
      'I’m not sure that’s true.',
    ],
  },
};

function reaction(delta: number, t: Temperament, call: CallState, rand: Rand): string {
  if (delta >= 15) return pickFresh(t === 'friendly' ? REACTIONS.great.friendly : REACTIONS.great.other, call, rand);
  if (delta >= 3) return pickFresh(REACTIONS.fine, call, rand);
  if (delta >= -6) return pickFresh(REACTIONS.meh, call, rand);
  return pickFresh(t === 'grumpy' || t === 'busy' ? REACTIONS.bad.rough : REACTIONS.bad.polite, call, rand);
}

const HANG_UP_ANGRY = ['Don’t call here again.', 'Take us off your list. Don’t call again.', 'Stop calling this number.'];
const HANG_UP_POLITE = [
  'Sorry, I’ve got to go. Not interested.',
  'I’ve got to get back to work. Not interested, thanks.',
  'Yeah, I’m going to stop you there. Not interested. Bye.',
  'Okay, thanks, but we’re good. Bye.',
];

function hangUp(call: CallState, biz: Business, rand: Rand = defaultRand): CallState {
  const angry = biz.temperament === 'grumpy' && call.interest < 20;
  return end(
    withLines(call, line('them', pick(angry ? HANG_UP_ANGRY : HANG_UP_POLITE, rand)), line('system', 'They hung up.')),
    angry ? 'do_not_call' : 'not_interested',
  );
}

// ---------------------------------------------------------------------------
// Taking too long to answer

/**
 * What happens when the answer timer runs out. Front desks and voicemails
 * just hang up. Owners get annoyed, and hang up if they run out of patience.
 */
export function timeoutCall(call: CallState, biz: Business, rand: Rand = defaultRand): CallState {
  if (call.phase === 'ended') return call;
  const silent = line('system', 'You go quiet for too long\u2026');
  if (call.phase === 'voicemail') {
    return end(withLines(call, silent, line('system', 'The voicemail beeps and cuts off.')), 'no_answer');
  }
  if (call.phase === 'gatekeeper') {
    return end(withLines(call, silent, line('them', pick(['Hello? \u2026Okay, bye.', 'Hello? Anyone there? Okay, bye.'], rand)), line('system', 'They hung up.')), 'blocked', {
      minutes: call.minutes + 1,
    });
  }
  const c: CallState = {
    ...withLines(call, silent),
    interest: clamp(call.interest - SILENCE_INTEREST_LOSS, 0, 100),
    patience: call.patience - 1,
    minutes: call.minutes + 1,
  };
  if (c.patience <= 0) return hangUp(c, biz, rand);
  const nudge =
    biz.temperament === 'friendly'
      ? ['Hello? Are you still there?', 'Hi, did I lose you?', 'Hello? You still there?']
      : ['Hello?? I don\u2019t have all day.', 'Are you there? I’ve got stuff to do.', 'Hello? Hello?'];
  return withLines(c, line('them', pickFresh(nudge, c, rand)));
}

// ---------------------------------------------------------------------------
// Main step function

export function chooseOption(
  call: CallState,
  biz: Business,
  choiceId: string,
  ctx: CallContext,
  rand: Rand = defaultRand,
): CallState {
  if (call.phase === 'ended') return call;
  const choice = call.choices.find((c) => c.id === choiceId);
  if (!choice || choice.disabled) return call;
  const first = firstName(biz.ownerName);

  switch (call.phase) {
    case 'voicemail': {
      if (choiceId === 'leave_vm') {
        return end(
          withLines(
            call,
            line(
              'you',
              pick(
                [
                  `Hi, this is ${ctx.playerName} from ${agency(ctx)}. I had a quick idea for your website. Call me back when you get a sec!`,
                  `Hey, ${ctx.playerName} here from ${agency(ctx)}. I came across your business and had an idea or two for your website. Call me back when you can, thanks!`,
                  `Hi there, it’s ${ctx.playerName} from ${agency(ctx)}. Nothing urgent. I’ve got a couple of ideas that could bring in more customers online. Call me back whenever. Thanks!`,
                ],
                rand,
              ),
            ),
          ),
          'voicemail_left',
          { minutes: call.minutes + 1 },
        );
      }
      return end(withLines(call, line('system', 'You hang up.')), 'no_answer');
    }

    case 'gatekeeper': {
      const youText = choice.label.replace(/[“”]/g, '');
      const c = { ...withLines(call, line('you', youText)), minutes: call.minutes + 1, xp: call.xp + 2 };
      if (choiceId === 'gk_best_time') {
        if (chance(0.7, rand)) {
          const cbHour = pick([9, 10, 14, 15], rand);
          const cb = { day: ctx.day + 1, hour: cbHour };
          return end(
            withLines(
              c,
              line(
                'them',
                pick(
                  [
                    `${biz.researched ? first : 'The owner'} is usually free around ${niceHour(cbHour)}. Try tomorrow.`,
                    `Your best bet is tomorrow around ${niceHour(cbHour)}.`,
                    `Try tomorrow around ${niceHour(cbHour)}.`,
                  ],
                  rand,
                ),
              ),
            ),
            'callback',
            { callback: cb },
          );
        }
        return end(withLines(c, line('them', pick(['Sorry, I can’t give that out. Bye now.', 'I’m not able to share that, sorry.', 'We don’t really do that. Thanks for calling.'], rand))), 'blocked');
      }
      const through = choiceId === 'gk_ask_owner' ? (biz.researched ? 0.55 : 0.32) : 0.28;
      if (chance(through, rand)) {
        const passed = withLines(
          c,
          line('them', pick(['Sure, one moment.', 'Sure, hold on a sec and I’ll see if they’re free.', 'Let me check. One moment.', 'Yeah, hang on, I’ll grab them.'], rand)),
          line('system', pick(['You’re put on hold, then transferred.', 'Hold music plays for a bit, then someone picks up.'], rand)),
        );
        return ownerPicksUp(passed, biz, ctx, rand);
      }
      if (choiceId === 'gk_honest' && chance(0.5, rand)) {
        const cb = { day: ctx.day + 1, hour: 9 };
        const msg = pick(['They’re with a customer. Try tomorrow morning, before 10.', 'They’re tied up right now. Maybe try tomorrow morning?', 'Not right now, they’re in a meeting. Tomorrow before 10 is best.'], rand);
        return end(withLines(c, line('them', msg)), 'callback', { callback: cb });
      }
      return end(withLines(c, line('them', pick(['We’re all set, thanks. Bye.', 'We’re not interested, thanks. Bye.', 'Yeah, we don’t take sales calls. Thanks.', 'I’ll pass that along, thanks. Bye now.'], rand))), 'blocked');
    }

    case 'opener': {
      const delta = OPENER_EFFECT[choiceId][biz.temperament];
      let c: CallState = withLines(call, line('you', openerYouLine(choiceId, biz, ctx, rand)));
      c = {
        ...c,
        interest: clamp(c.interest + delta, 0, 100),
        patience: delta < 0 ? c.patience - 1 : c.patience,
        minutes: c.minutes + 2,
        xp: c.xp + (delta > 10 ? 6 : 3),
      };
      if (c.patience <= 0) return hangUp(c, biz, rand);
      // If they're cold after your opener, many people just brush you off.
      if (c.interest < 20 && chance(0.5, rand)) return hangUp(c, biz, rand);
      c = withLines(c, line('them', reaction(delta, biz.temperament, c, rand)));
      return askObjection(c, biz, rand);
    }

    case 'objection': {
      const obj = OBJECTIONS[call.currentObjection!];
      const idx = Number(choiceId.split('_')[1]);
      const researchBonus = idx === 0 && biz.researched ? 4 : 0;
      const delta = REPLY_EFFECT[idx] + researchBonus;
      let c: CallState = withLines(call, line('you', obj.replies[idx]));
      c = {
        ...c,
        interest: clamp(c.interest + delta, 0, 100),
        patience: delta < 0 ? c.patience - 1 : c.patience,
        minutes: c.minutes + 2,
        xp: c.xp + (idx === 0 ? 6 : idx === 1 ? 3 : 1),
      };
      if (c.patience <= 0) return hangUp(c, biz, rand);
      c = withLines(c, line('them', reaction(delta, biz.temperament, c, rand)));
      if (c.objectionsLeft > 0 && c.interest < 60) return askObjection(c, biz, rand);
      return goToClose(c);
    }

    case 'close': {
      const youText: Record<string, string> = {
        close_meeting: pick(
          [
            `Would you be open to a quick 15-minute chat this week, ${first}? I’ll bring a few ideas.`,
            `${first}, could we grab 15 minutes this week? I’ll show you a few things I have in mind.`,
            'How about a quick 15-minute meeting this week? I’ll come to you.',
          ],
          rand,
        ),
        close_text: pick(
          [
            'Can I text you a few ideas and a rough quote? No pressure at all.',
            'How about I text you a couple of ideas and a ballpark price? You can look whenever you want.',
            'Would it be okay if I sent you a text with some ideas and a rough quote?',
          ],
          rand,
        ),
        close_later: pick(
          ['No worries. Mind if I check back in a couple of weeks?', 'Totally understand. Is it okay if I call again in a couple of weeks?', 'That’s fine. Can I try you again in a few weeks?'],
          rand,
        ),
      };
      const c: CallState = { ...withLines(call, line('you', youText[choiceId])), minutes: call.minutes + 1, xp: call.xp + 4 };
      const p = clamp(0.5 + (c.interest - CLOSE_THRESHOLD[choiceId]) / 60, 0.03, 0.9);
      const yes = chance(p, rand);

      if (choiceId === 'close_later') {
        if (yes) {
          return end(withLines(c, line('them', pick(['Sure, try me then.', 'Yeah, give me a call in a couple of weeks.', 'Okay, that works. Call me then.'], rand))), 'callback', {
            callback: { day: ctx.day + 14, hour: 10 },
          });
        }
        return end(withLines(c, line('them', pick(['Nah, we’re good. Thanks.', 'I’d rather you didn’t, but thanks anyway.', 'No, I think we’re all set. Thanks.'], rand))), 'not_interested');
      }
      if (yes) {
        const reply =
          choiceId === 'close_meeting'
            ? pick(['Yeah, okay. Text me and we’ll find a time.', 'Alright, I can do that. Text me and we’ll sort out a time.', 'Sure, why not. Send me a text and we’ll set something up.'], rand)
            : pick([`Sure, text me at this number. It’s ${first}, by the way.`, `Yeah, go ahead and text this number. ${first} here.`, `Okay, send it over. This number is fine.`], rand);
        const warmth = clamp(c.interest + (choiceId === 'close_meeting' ? 15 : 0), 0, 100);
        return end(withLines(c, line('them', reply), line('system', `${biz.name} is interested!`)), 'interested', { interest: warmth });
      }
      if (c.interest >= 25) {
        const msg = pick(['Not right now. Maybe try me in a few weeks.', 'Bad timing for us. Check back in a few weeks.', 'Not right now, but call me back in a few weeks.'], rand);
        return end(withLines(c, line('them', msg)), 'callback', {
          callback: { day: ctx.day + 21, hour: 10 },
        });
      }
      return end(withLines(c, line('them', pick(['I think we’re good, thanks.', 'Nope, we’re all set, thanks though.', 'I’ll pass for now, thanks.'], rand))), 'not_interested');
    }
  }
  return call;
}
