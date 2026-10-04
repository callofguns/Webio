// The website builder engine. A signed Project goes:
//
//   not_started (plan the design) -> in_progress (work through tasks)
//   -> review (client is looking at it) -> delivered | back to in_progress
//
// Work happens an hour at a time. Your Design and Development levels decide
// how fast you work and how good the result is. Development work can create
// hidden bugs. Test the site to find them before the client does.

import type { BuildTask, Business, Deal, Feature, Project, ProjectEventId, ProjectReview } from './types';
import { chance, clamp, pick, randInt, uid, type Rand, defaultRand } from './rng';
import { DAY_HARD_END, LATE_NIGHT } from './balance';
import { FEATURES } from './deals';
import {
  DEFAULT_DESIGN,
  FONTS,
  INDUSTRY_VIBES,
  LAYOUTS,
  PALETTES,
  RECOMMENDED_SECTIONS,
  SECTIONS,
  type Design,
  type Vibe,
} from './design';

// ---------------------------------------------------------------------------
// Creating a project

function task(label: string, skill: BuildTask['skill'], hours: number, feature?: Feature): BuildTask {
  return { id: uid('task'), label, skill, hours, done: 0, quality: null, penalty: 0, ...(feature ? { feature } : {}) };
}

export function buildTasks(pages: number, features: Feature[]): BuildTask[] {
  const tasks = [task('Set up hosting and site structure', 'development', 2), task('Design the home page', 'design', 4)];
  if (pages > 1) tasks.push(task(`Build the other ${pages - 1} page${pages > 2 ? 's' : ''}`, 'design', 2.5 * (pages - 1)));
  for (const f of features) {
    if (f === 'copywriting') tasks.push(task('Write the text and find photos', 'design', 8, f));
    else tasks.push(task(`Build the ${FEATURES[f].label.toLowerCase()}`, 'development', FEATURES[f].days * 5, f));
  }
  tasks.push(task('Connect the domain and go live', 'development', 1));
  return tasks;
}

export function pickTaste(biz: Business, rand: Rand = defaultRand): Vibe {
  const all: Vibe[] = ['corporate', 'rustic', 'natural', 'bold', 'playful', 'luxury', 'minimal'];
  return chance(0.75, rand) ? pick(INDUSTRY_VIBES[biz.industry], rand) : pick(all, rand);
}

export function createProject(deal: Deal, biz: Business, day: number, rand: Rand = defaultRand): Project {
  const quote = deal.quote!;
  const price = deal.agreedPrice ?? quote.price;
  return {
    id: uid('proj'),
    businessId: biz.id,
    dealId: deal.id,
    pages: quote.pages,
    features: quote.features,
    price,
    // A retainer client pays nothing up front. Their first month is paid when the site goes live.
    plan: deal.plan ?? 'buyout',
    depositPaid: deal.plan === 'retainer' ? 0 : Math.round((price * quote.depositPct) / 100),
    signedDay: day,
    dueDay: day + quote.days,
    hasContent: deal.needs.hasContent,
    status: 'not_started',
    ...builderFields(quote.pages, quote.features, biz, rand),
  };
}

/** The Part 3 fields, also used to upgrade projects from older saves. */
export function builderFields(pages: number, features: Feature[], biz: Business, rand: Rand = defaultRand) {
  return {
    design: { ...DEFAULT_DESIGN, sections: [...DEFAULT_DESIGN.sections] },
    taste: pickTaste(biz, rand),
    tasteAt: null,
    tasks: buildTasks(pages, features),
    hiddenBugs: 0,
    foundBugs: 0,
    polish: 0,
    goodwill: 0,
    qualityMod: 0,
    eventsSeen: 0,
    revisions: 0,
    pendingEvent: null,
    review: null,
    lastFeedback: null,
    stars: null,
    deliveredDay: null,
    lastNudgeDay: null,
  } satisfies Partial<Project>;
}

// ---------------------------------------------------------------------------
// Reading a project

export function speed(level: number): number {
  return 1 + 0.2 * (level - 1);
}

export function progress(p: Project): number {
  const total = p.tasks.reduce((s, t) => s + t.hours, 0);
  const done = p.tasks.reduce((s, t) => s + Math.min(t.done, t.hours), 0);
  return total ? done / total : 0;
}

/** A project you've started that still has unfinished work of this kind. */
export function hasWorkLeft(p: Project, skill: BuildTask['skill']): boolean {
  return p.status === 'in_progress' && p.tasks.some((t) => t.skill === skill && t.done < t.hours);
}

/**
 * Where a free team member should pick up work. Only started projects count.
 * Projects with fewer people already on them come first, then the soonest due.
 * `crowd` is how many people are already working on each project.
 */
export function findWork(projects: Project[], skill: BuildTask['skill'], crowd: ReadonlyMap<string, number> = new Map()): Project | null {
  const options = projects.filter((p) => hasWorkLeft(p, skill));
  options.sort((a, b) => (crowd.get(a.id) ?? 0) - (crowd.get(b.id) ?? 0) || a.dueDay - b.dueDay);
  return options[0] ?? null;
}

export function allTasksDone(p: Project): boolean {
  return p.tasks.every((t) => t.done >= t.hours);
}

/** Hours of your own time left to finish the build. `mult` is any extra speed you have (laptop, Claude). */
export function hoursLeft(p: Project, designLevel: number, devLevel: number, mult = 1): number {
  return p.tasks.reduce((s, t) => s + Math.max(0, t.hours - t.done) / (speed(t.skill === 'design' ? designLevel : devLevel) * mult), 0);
}

/** 0-100. The average quality of finished work plus polish and choices you made. */
export function siteQuality(p: Project): number {
  const finished = p.tasks.filter((t) => t.quality !== null);
  if (!finished.length) return 0;
  const avg = finished.reduce((s, t) => s + t.quality!, 0) / finished.length;
  return clamp(Math.round(avg + p.polish * 3 + p.qualityMod), 0, 100);
}

export const MAX_POLISH = 4;

// ---------------------------------------------------------------------------
// Design fit

export interface DesignFit {
  layout: number;
  palette: number;
  font: number;
  sections: number;
  total: number;
  /** Recommended sections you left out. */
  missingSections: string[];
}

function vibeScore(vibes: Vibe[], taste: Vibe, industryVibes: Vibe[]): number {
  if (vibes.includes(taste)) return 10;
  if (vibes.some((v) => industryVibes.includes(v))) return 5;
  return 0;
}

/** How well the design suits this client. Max 42. */
export function designFit(p: Project, biz: Business): DesignFit {
  const iv = INDUSTRY_VIBES[biz.industry];
  const layout = vibeScore(LAYOUTS[p.design.layout].vibes, p.taste, iv);
  const palette = vibeScore(PALETTES[p.design.palette].vibes, p.taste, iv);
  const font = vibeScore(FONTS[p.design.font].vibes, p.taste, iv);
  const rec = RECOMMENDED_SECTIONS[biz.industry];
  const count = p.design.sections.length;
  let sections = rec.filter((s) => p.design.sections.includes(s)).length * 3;
  if (count > 6) sections -= (count - 6) * 3; // cluttered
  if (count < 3) sections -= 6; // too empty
  const missingSections = rec.filter((s) => !p.design.sections.includes(s)).map((s) => SECTIONS[s].name);
  return { layout, palette, font, sections, total: layout + palette + font + sections, missingSections };
}

// ---------------------------------------------------------------------------
// Changing the design

/** Hours of rework it takes to switch from one design to another. */
export function reworkHours(from: Design, to: Design): number {
  let h = 0;
  if (from.layout !== to.layout) h += 3;
  if (from.palette !== to.palette) h += 1;
  if (from.font !== to.font) h += 1;
  const changed = [...from.sections.filter((s) => !to.sections.includes(s)), ...to.sections.filter((s) => !from.sections.includes(s))];
  h += changed.length * 0.5;
  return h;
}

export function changeDesign(p: Project, next: Design): Project {
  if (p.status === 'review' || p.status === 'delivered') return p;
  const designStarted = p.tasks.some((t) => t.skill === 'design' && t.done > 0);
  if (p.status === 'not_started' || !designStarted) return { ...p, design: next };
  const hours = reworkHours(p.design, next);
  if (hours === 0) return { ...p, design: next };
  const existing = p.tasks.find((t) => t.label === 'Redesign' && t.done < t.hours);
  const tasks = existing
    ? p.tasks.map((t) => (t === existing ? { ...t, hours: t.hours + hours } : t))
    : // Redesign goes just before "go live".
      [...p.tasks.slice(0, -1), task('Redesign', 'design', hours), ...p.tasks.slice(-1)];
  return { ...p, design: next, tasks };
}

// ---------------------------------------------------------------------------
// Working

export interface WorkContext {
  minute: number;
  designLevel: number;
  devLevel: number;
  /** Employees only do their own kind of task. */
  only?: BuildTask['skill'];
  /** Employees don't stop for surprise events (default true for you). */
  events?: boolean;
  /** Multiplies work speed (morale, traits, onboarding). */
  speedMult?: number;
  /** Added to the quality of finished tasks (traits). */
  qualityBonus?: number;
  /** Multiplies the chance of creating bugs (traits). */
  bugMult?: number;
  /** Quality lost per late-night hour (less with a coffee machine). */
  latePenalty?: number;
}

export interface WorkResult {
  project: Project;
  minutes: number;
  xp: { design: number; development: number };
}

const EVENT_CHANCE_PER_HOUR = 0.08;
const MAX_EVENTS = 3;

function bugChance(t: BuildTask, devLevel: number, late: boolean): number {
  const difficulty = t.feature ? FEATURES[t.feature].devLevel : 1;
  return clamp(0.06 + 0.04 * difficulty - 0.02 * (devLevel - 1) + (late ? 0.05 : 0), 0.01, 0.35);
}

function possibleEvents(p: Project, current: BuildTask): ProjectEventId[] {
  const out: ProjectEventId[] = ['extra_section'];
  if (p.hasContent) out.push('blurry_photos');
  if (current.skill === 'development') out.push('tricky_bug');
  if (current.skill === 'design') out.push('tutorial');
  return out;
}

/** Works on the next unfinished tasks for up to `hours`. Stops early for surprises or bedtime. */
export function work(p: Project, hours: number, ctx: WorkContext, rand: Rand = defaultRand): WorkResult {
  const xp = { design: 0, development: 0 };
  const events = ctx.events ?? true;
  // A surprise waiting for you blocks your own work, but not your employees'.
  if (p.status !== 'in_progress' || (events && p.pendingEvent)) return { project: p, minutes: 0, xp };

  const tasks = p.tasks.map((t) => ({ ...t }));
  let hiddenBugs = p.hiddenBugs;
  let pendingEvent: ProjectEventId | null = null;
  let eventsSeen = p.eventsSeen;
  let minute = ctx.minute;
  let minutes = 0;

  for (let h = 0; h < hours; h++) {
    if (minute + 60 > DAY_HARD_END) break;
    const t = tasks.find((x) => x.done < x.hours && (!ctx.only || x.skill === ctx.only));
    if (!t) break;
    const level = t.skill === 'design' ? ctx.designLevel : ctx.devLevel;
    const late = minute >= LATE_NIGHT;

    t.done = Math.min(t.hours, t.done + speed(level) * (ctx.speedMult ?? 1));
    if (late) t.penalty += ctx.latePenalty ?? 6;
    xp[t.skill] += 10;
    if (t.skill === 'development' && chance(bugChance(t, ctx.devLevel, late) * (ctx.bugMult ?? 1), rand)) hiddenBugs++;
    if (t.done >= t.hours) {
      t.quality = clamp(45 + 8 * level + randInt(-8, 8, rand) - t.penalty + (ctx.qualityBonus ?? 0), 10, 95);
    }
    minute += 60;
    minutes += 60;

    if (events && eventsSeen < MAX_EVENTS && tasks.some((x) => x.done < x.hours) && chance(EVENT_CHANCE_PER_HOUR, rand)) {
      pendingEvent = pick(possibleEvents(p, t), rand);
      eventsSeen++;
      break;
    }
  }

  return { project: { ...p, tasks, hiddenBugs, pendingEvent: pendingEvent ?? p.pendingEvent, eventsSeen }, minutes, xp };
}

/** Test the site for an hour. Each hidden bug has a chance to be found. */
export function testSite(p: Project, devLevel: number, rand: Rand = defaultRand): { project: Project; found: number } {
  let found = 0;
  for (let i = 0; i < p.hiddenBugs; i++) if (chance(clamp(0.5 + 0.1 * devLevel, 0, 0.9), rand)) found++;
  return { project: { ...p, hiddenBugs: p.hiddenBugs - found, foundBugs: p.foundBugs + found }, found };
}

export const FIX_MINUTES_PER_BUG = 30;

export function fixBugs(p: Project, availableMinutes: number): { project: Project; minutes: number } {
  const n = Math.min(p.foundBugs, Math.floor(availableMinutes / FIX_MINUTES_PER_BUG));
  return { project: { ...p, foundBugs: p.foundBugs - n }, minutes: n * FIX_MINUTES_PER_BUG };
}

export function polishSite(p: Project): Project {
  return p.polish >= MAX_POLISH ? p : { ...p, polish: p.polish + 1 };
}

// ---------------------------------------------------------------------------
// Surprise events

export interface EventChoice {
  id: string;
  label: string;
  hint?: string;
}

export const EVENTS: Record<ProjectEventId, { title: string; text: string; choices: EventChoice[] }> = {
  blurry_photos: {
    title: 'Blurry photos',
    text: 'The photos the client sent are tiny and blurry. They’ll look bad on a big screen.',
    choices: [
      { id: 'use', label: 'Use them anyway', hint: 'Lower quality' },
      { id: 'stock', label: 'Buy stock photos', hint: '$40' },
      { id: 'ask', label: 'Ask the client for better ones', hint: '15 min, they’re a bit annoyed' },
    ],
  },
  tricky_bug: {
    title: 'A tricky bug',
    text: 'Something is broken and you can’t figure out why.',
    choices: [
      { id: 'dig', label: 'Dig in until you understand it', hint: '1.5 hrs, you learn a lot' },
      { id: 'quick', label: 'Copy a quick fix from the internet', hint: 'Might break something else' },
      { id: 'note', label: 'Write it down and fix it later', hint: 'Adds 2 known bugs' },
    ],
  },
  tutorial: {
    title: 'A cool idea',
    text: 'You saw a design trick in a tutorial that could make this site look better.',
    choices: [
      { id: 'try', label: 'Try it out', hint: '1 hr, might not work' },
      { id: 'skip', label: 'Stay on track' },
    ],
  },
  extra_section: {
    title: 'An extra request',
    text: 'The client texts: “Could you also add a small section about our opening hours?”',
    choices: [
      { id: 'free', label: 'Sure, no charge', hint: '+1.5 hrs of work, they’ll love you' },
      { id: 'charge', label: 'Happy to, for $100 extra', hint: '+1.5 hrs, +$100 on the final bill' },
      { id: 'no', label: 'Politely say it wasn’t in the quote', hint: 'They’re a bit disappointed' },
    ],
  },
};

export interface EventResult {
  project: Project;
  minutes: number;
  money: number;
  xp: { design: number; development: number };
  note: string;
}

export function resolveEvent(p: Project, choiceId: string, rand: Rand = defaultRand): EventResult {
  const none = { design: 0, development: 0 };
  const done = (patch: Partial<Project>, note: string, extra: Partial<Omit<EventResult, 'project' | 'note'>> = {}): EventResult => ({
    project: { ...p, ...patch, pendingEvent: null },
    minutes: 0,
    money: 0,
    xp: none,
    note,
    ...extra,
  });
  const addTask = (label: string, hours: number) => [...p.tasks.slice(0, -1), task(label, 'design', hours), ...p.tasks.slice(-1)];

  switch (`${p.pendingEvent}:${choiceId}`) {
    case 'blurry_photos:use':
      return done({ qualityMod: p.qualityMod - 5 }, 'You used the blurry photos.');
    case 'blurry_photos:stock':
      return done({ qualityMod: p.qualityMod + 2 }, 'You bought some nice stock photos.', { money: -40 });
    case 'blurry_photos:ask':
      return done({ qualityMod: p.qualityMod + 3, goodwill: p.goodwill - 1 }, 'The client sent better photos.', { minutes: 15 });
    case 'tricky_bug:dig':
      return done({}, 'You tracked the bug down and learned a lot.', { minutes: 90, xp: { design: 0, development: 25 } });
    case 'tricky_bug:quick':
      return chance(0.5, rand)
        ? done({}, 'The quick fix worked!')
        : done({ hiddenBugs: p.hiddenBugs + 1 }, 'The quick fix seemed to work…');
    case 'tricky_bug:note':
      return done({ foundBugs: p.foundBugs + 2 }, 'You wrote down 2 bugs to fix later.');
    case 'tutorial:try':
      return chance(0.6, rand)
        ? done({ qualityMod: p.qualityMod + 6 }, 'The new trick looks great!', { minutes: 60, xp: { design: 15, development: 0 } })
        : done({}, 'It didn’t really work, but you learned something.', { minutes: 60, xp: { design: 15, development: 0 } });
    case 'tutorial:skip':
      return done({}, 'You stayed on track.');
    case 'extra_section:free':
      return done({ goodwill: p.goodwill + 6, tasks: addTask('Add an opening hours section', 1.5) }, 'You agreed to add it for free.');
    case 'extra_section:charge':
      return done({ goodwill: p.goodwill - 2, price: p.price + 100, tasks: addTask('Add an opening hours section', 1.5) }, 'They agreed to pay $100 more.');
    case 'extra_section:no':
      return done({ goodwill: p.goodwill - 5 }, 'You said no to the extra section.');
  }
  return done({}, '');
}

// ---------------------------------------------------------------------------
// Client review

export const REPUTATION_FOR_STARS: Record<number, number> = { 1: -5, 2: -2, 3: 1, 4: 4, 5: 6 };

export function starsFor(satisfaction: number): number {
  if (satisfaction >= 85) return 5;
  if (satisfaction >= 72) return 4;
  if (satisfaction >= 60) return 3;
  if (satisfaction >= 45) return 2;
  return 1;
}

export function contentMissing(p: Project): boolean {
  return !p.hasContent && !p.features.includes('copywriting');
}

/** How happy the client is with the site right now (0-100). */
export function satisfaction(p: Project, biz: Business, day: number, rand: Rand = defaultRand): number {
  const fit = designFit(p, biz).total;
  const late = Math.max(0, day - p.dueDay);
  const bugs = p.hiddenBugs + p.foundBugs;
  const s = 18 + fit + siteQuality(p) * 0.4 - bugs * 7 - late * 4 - (contentMissing(p) ? 12 : 0) + p.goodwill + randInt(-4, 4, rand);
  return clamp(Math.round(s), 0, 100);
}

export const MAX_REVISIONS = 2;

export function evaluateSite(p: Project, biz: Business, day: number, rand: Rand = defaultRand): Omit<ProjectReview, 'at'> {
  const sat = satisfaction(p, biz, day, rand);
  const approved = sat >= 60 || p.revisions >= MAX_REVISIONS;
  if (approved) return { approved, stars: starsFor(sat), satisfaction: sat, feedback: null };

  const fit = designFit(p, biz);
  let feedback: ProjectReview['feedback'] = 'quality';
  if (p.hiddenBugs + p.foundBugs > 0) feedback = 'bugs';
  else if (contentMissing(p)) feedback = 'content';
  else if (fit.layout + fit.palette + fit.font < 15) feedback = 'design';
  else if (fit.missingSections.length > 1) feedback = 'sections';
  return { approved, stars: starsFor(sat), satisfaction: sat, feedback };
}

export function reviewReply(review: Omit<ProjectReview, 'at'>, p: Project, biz: Business, tasteHint: string): string {
  if (review.approved) {
    return {
      5: 'Wow, I love it! 😍 Sending the rest of the payment now.',
      4: 'Looks great, thank you! The rest of the payment is on its way.',
      3: 'It’s fine, thanks. I’ll send the rest of the money.',
      2: 'Honestly it’s not what I hoped for, but let’s just wrap it up.',
      1: 'This isn’t good. I’ll pay because we agreed, but I won’t be recommending you.',
    }[review.stars]!;
  }
  switch (review.feedback) {
    case 'bugs':
      return 'A few things are broken. The contact form didn’t work on my phone. Can you fix them?';
    case 'content':
      return 'Why is there fake placeholder text everywhere? We need real text and photos on there.';
    case 'design':
      return `Hmm, it doesn’t really feel like us. ${tasteHint} Could you try a different look?`;
    case 'sections': {
      const missing = designFit(p, biz).missingSections.slice(0, 2).join(' and ').toLowerCase();
      return `It’s missing things our customers look for, like ${missing}. Can you add those?`;
    }
    default:
      return 'It’s okay, but it feels a bit rough around the edges. Can you polish it up?';
  }
}

/** Puts a project back into building after the client asks for changes. */
export function applyRevision(p: Project): Project {
  const base: Project = { ...p, status: 'in_progress', revisions: p.revisions + 1, review: null, lastFeedback: p.review?.feedback ?? null };
  switch (p.review?.feedback) {
    case 'bugs':
      // The client found them for you.
      return { ...base, foundBugs: base.foundBugs + base.hiddenBugs, hiddenBugs: 0 };
    case 'content':
      return {
        ...base,
        features: [...base.features, 'copywriting'],
        tasks: [...base.tasks.slice(0, -1), task('Write the text and find photos', 'design', 8, 'copywriting'), ...base.tasks.slice(-1)],
      };
    default:
      return base;
  }
}
