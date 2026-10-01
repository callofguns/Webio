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
import { chance, clamp, pick, randInt, shuffle, uid, type Rand, defaultRand } from './rng';
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
    'Good morning, {biz}, this is {first}! How can I help you?',
    'Hi there, {biz}, {first} speaking. What can I do for you?',
  ],
  busy: ['{biz}, {first} speaking — make it quick.', 'Yeah, {first} here. What’s up? (lots of noise in the background)'],
  skeptical: ['Hello, {biz}. Who’s calling, please?', '{biz}. Who is this?'],
  grumpy: ['Yeah? Who is this?', 'What.'],
};

const GATEKEEPER_NAMES = ['Jess', 'Marco', 'Tina', 'Kyle', 'Brenda', 'Sam'];

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
    pick(GREETINGS[biz.temperament], rand).replace('{biz}', biz.name).replace('{first}', firstName(biz.ownerName));
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
    const warm = biz.temperament === 'grumpy' ? 'Yeah, I remember. Go ahead.' : `${first} here. Oh — you’re the web person, right? Go ahead.`;
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
        line('system', `You’ve reached ${biz.name}. Please leave a message after the tone.`),
      );
    }
    return end(withLines(call, line('system', 'It rings out. Nobody picks up.')), 'no_answer');
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
      line('them', `${biz.name}, this is ${gk}. How can I help?`),
    );
  }

  return ownerPicksUp({ ...call, minutes: call.minutes + 1 }, biz, ctx, rand);
}

// ---------------------------------------------------------------------------
// Openers

const PAIN_PITCH: Record<Business['painPoint'], string> = {
  no_presence: 'I searched for you online and couldn’t find a website at all',
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

function openerYouLine(id: string, biz: Business, ctx: CallContext): string {
  const intro = `Hi ${biz.researched ? firstName(biz.ownerName) : 'there'}, I’m ${ctx.playerName} from ${agency(ctx)}.`;
  switch (id) {
    case 'op_specific':
      return `${intro} I noticed ${PAIN_PITCH[biz.painPoint]}, and I had a couple of ideas to fix that.`;
    case 'op_question':
      return `${intro} Quick question — how do most of your new customers find you right now?`;
    case 'op_direct':
      return `${intro} I build websites for local businesses. Would you be interested in a new one?`;
    default:
      return `${intro} We help businesses like yours 10x their revenue online!`;
  }
}

// ---------------------------------------------------------------------------
// Objections

export type ObjectionId = 'have_site' | 'word_of_mouth' | 'too_expensive' | 'too_busy' | 'nephew' | 'bad_experience';

interface Objection {
  text: string;
  applies: (biz: Business) => boolean;
  /** [best, okay, bad] replies. Order is shuffled when shown. */
  replies: [string, string, string];
}

const OBJECTIONS: Record<ObjectionId, Objection> = {
  have_site: {
    text: 'We already have a website.',
    applies: (b) => b.website !== 'none',
    replies: [
      'That’s great. Is it bringing you new customers, or is it more of an online business card?',
      'Sure, but I could make it look a lot better.',
      'Yeah, but honestly, most sites like yours are pretty bad.',
    ],
  },
  word_of_mouth: {
    text: 'Honestly, we get all our work from word of mouth.',
    applies: (b) => b.website === 'none' || b.website === 'outdated',
    replies: [
      'That’s the best kind of customer. A website gives those referrals somewhere to land when they look you up.',
      'Word of mouth is great, but a website would get you even more.',
      'Word of mouth is kind of old-school though.',
    ],
  },
  too_expensive: {
    text: 'Websites cost a fortune. We can’t afford that right now.',
    applies: () => true,
    replies: [
      'Fair. I can start simple — one page that gets you calls — and grow it when it pays off.',
      'It’s an investment. It pays for itself.',
      'I’m the cheapest around, seriously. Like, really cheap.',
    ],
  },
  too_busy: {
    text: 'Look, I’m really busy right now.',
    applies: (b) => b.temperament === 'busy' || b.temperament === 'grumpy',
    replies: [
      'No problem — can I text you two quick ideas to look at when you’re free?',
      'It’ll only take two minutes, I promise.',
      'This is really important, you should make time for it.',
    ],
  },
  nephew: {
    text: 'My nephew handles all that computer stuff for us.',
    applies: (b) => b.size !== 'medium' && b.website !== 'good',
    replies: [
      'Nice, family help is great. If it ever gets too much for him, I’d be happy to take it off his plate.',
      'Is he a professional designer?',
      'No offense, but that usually doesn’t turn out well.',
    ],
  },
  bad_experience: {
    text: 'We paid someone before and they just disappeared.',
    applies: (b) => b.temperament === 'skeptical' && b.website !== 'none',
    replies: [
      'That’s awful, I’m sorry. I work in stages — you only pay once you’ve seen each part finished.',
      'Don’t worry, I’m not like those other guys.',
      'Well, that’s kind of what happens when you go cheap.',
    ],
  },
};

const REPLY_EFFECT = [14, 3, -14]; // best, okay, bad

function nextObjection(call: CallState, biz: Business, rand: Rand): ObjectionId | null {
  const options = (Object.keys(OBJECTIONS) as ObjectionId[]).filter(
    (id) => !call.usedObjections.includes(id) && OBJECTIONS[id].applies(biz),
  );
  return options.length ? pick(options, rand) : null;
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
    line('them', obj.text),
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

function reaction(delta: number, t: Temperament, rand: Rand): string {
  if (delta >= 15) {
    return pick(
      t === 'friendly'
        ? ['Oh, interesting! Go on.', 'Huh, I’ve actually been thinking about that.']
        : ['Okay… I’m listening.', 'Hm. Fair point.'],
      rand,
    );
  }
  if (delta >= 3) return pick(['Mm-hm.', 'Okay.', 'Right…'], rand);
  if (delta >= -6) return pick(['Uh-huh.', '…Okay.', 'I guess.'], rand);
  return pick(
    t === 'grumpy' || t === 'busy'
      ? ['(sighs) Yeah, I’ve heard that one before.', 'Look, I don’t have time for a sales pitch.']
      : ['Hmm. I’m not sure about that.', 'That sounds like a sales line.'],
    rand,
  );
}

function hangUp(call: CallState, biz: Business): CallState {
  const angry = biz.temperament === 'grumpy' && call.interest < 20;
  return end(
    withLines(
      call,
      line('them', angry ? 'Don’t call here again.' : 'Sorry, I’ve got to go. Not interested.'),
      line('system', 'They hung up.'),
    ),
    angry ? 'do_not_call' : 'not_interested',
  );
}

// ---------------------------------------------------------------------------
// Taking too long to answer

/**
 * What happens when the answer timer runs out. Front desks and voicemails
 * just hang up. Owners get annoyed, and hang up if they run out of patience.
 */
export function timeoutCall(call: CallState, biz: Business): CallState {
  if (call.phase === 'ended') return call;
  const silent = line('system', 'You go quiet for too long\u2026');
  if (call.phase === 'voicemail') {
    return end(withLines(call, silent, line('system', 'The voicemail beeps and cuts off.')), 'no_answer');
  }
  if (call.phase === 'gatekeeper') {
    return end(withLines(call, silent, line('them', 'Hello? \u2026Okay, bye.'), line('system', 'They hung up.')), 'blocked', {
      minutes: call.minutes + 1,
    });
  }
  const c: CallState = {
    ...withLines(call, silent),
    interest: clamp(call.interest - SILENCE_INTEREST_LOSS, 0, 100),
    patience: call.patience - 1,
    minutes: call.minutes + 1,
  };
  if (c.patience <= 0) return hangUp(c, biz);
  return withLines(c, line('them', biz.temperament === 'friendly' ? 'Hello? Are you still there?' : 'Hello?? I don\u2019t have all day.'));
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
          withLines(call, line('you', `Hi, this is ${ctx.playerName} from ${agency(ctx)}. I had a quick idea for your website — call me back when you get a sec!`)),
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
            withLines(c, line('them', `${biz.researched ? first : 'The owner'} is usually free around ${cbHour > 12 ? cbHour - 12 : cbHour}${cbHour >= 12 ? 'pm' : 'am'}. Try tomorrow.`)),
            'callback',
            { callback: cb },
          );
        }
        return end(withLines(c, line('them', 'Sorry, I can’t give that out. Bye now.')), 'blocked');
      }
      const through = choiceId === 'gk_ask_owner' ? (biz.researched ? 0.55 : 0.32) : 0.28;
      if (chance(through, rand)) {
        const passed = withLines(c, line('them', 'Sure, one moment.'), line('system', 'You’re put on hold, then transferred.'));
        return ownerPicksUp(passed, biz, ctx, rand);
      }
      if (choiceId === 'gk_honest' && chance(0.5, rand)) {
        const cb = { day: ctx.day + 1, hour: 9 };
        return end(withLines(c, line('them', 'They’re with a customer. Try tomorrow morning, before 10.')), 'callback', { callback: cb });
      }
      return end(withLines(c, line('them', 'We’re all set, thanks. Bye.')), 'blocked');
    }

    case 'opener': {
      const delta = OPENER_EFFECT[choiceId][biz.temperament];
      let c: CallState = withLines(call, line('you', openerYouLine(choiceId, biz, ctx)));
      c = {
        ...c,
        interest: clamp(c.interest + delta, 0, 100),
        patience: delta < 0 ? c.patience - 1 : c.patience,
        minutes: c.minutes + 2,
        xp: c.xp + (delta > 10 ? 6 : 3),
      };
      if (c.patience <= 0) return hangUp(c, biz);
      // If they're cold after your opener, many people just brush you off.
      if (c.interest < 20 && chance(0.5, rand)) return hangUp(c, biz);
      c = withLines(c, line('them', reaction(delta, biz.temperament, rand)));
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
      if (c.patience <= 0) return hangUp(c, biz);
      c = withLines(c, line('them', reaction(delta, biz.temperament, rand)));
      if (c.objectionsLeft > 0 && c.interest < 60) return askObjection(c, biz, rand);
      return goToClose(c);
    }

    case 'close': {
      const youText: Record<string, string> = {
        close_meeting: `Would you be open to a quick 15-minute chat this week, ${first}? I’ll bring a few ideas.`,
        close_text: 'Can I text you a few ideas and a rough quote? No pressure at all.',
        close_later: 'No worries. Mind if I check back in a couple of weeks?',
      };
      const c: CallState = { ...withLines(call, line('you', youText[choiceId])), minutes: call.minutes + 1, xp: call.xp + 4 };
      const p = clamp(0.5 + (c.interest - CLOSE_THRESHOLD[choiceId]) / 60, 0.03, 0.9);
      const yes = chance(p, rand);

      if (choiceId === 'close_later') {
        if (yes) {
          return end(withLines(c, line('them', 'Sure, try me then.')), 'callback', { callback: { day: ctx.day + 14, hour: 10 } });
        }
        return end(withLines(c, line('them', 'Nah, we’re good. Thanks.')), 'not_interested');
      }
      if (yes) {
        const reply =
          choiceId === 'close_meeting'
            ? 'Yeah, okay. Text me and we’ll find a time.'
            : `Sure, text me at this number. It’s ${first}, by the way.`;
        const warmth = clamp(c.interest + (choiceId === 'close_meeting' ? 15 : 0), 0, 100);
        return end(withLines(c, line('them', reply), line('system', `${biz.name} is interested!`)), 'interested', { interest: warmth });
      }
      if (c.interest >= 25) {
        return end(withLines(c, line('them', 'Not right now. Maybe try me in a few weeks.')), 'callback', {
          callback: { day: ctx.day + 21, hour: 10 },
        });
      }
      return end(withLines(c, line('them', 'I think we’re good, thanks.')), 'not_interested');
    }
  }
  return call;
}
