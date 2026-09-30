import { describe, expect, it } from 'vitest';
import { generateBusiness } from './businesses';
import { createDeal, toGameTime } from './deals';
import {
  allTasksDone,
  applyRevision,
  changeDesign,
  createProject,
  designFit,
  evaluateSite,
  fixBugs,
  progress,
  siteQuality,
  testSite,
  work,
} from './projects';
import { FONTS, INDUSTRY_VIBES, LAYOUTS, PALETTES, RECOMMENDED_SECTIONS, type Design } from './design';
import type { Business, Project } from './types';

function seeded(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function newProject(rand: () => number, pages = 4): { biz: Business; project: Project } {
  const biz = generateBusiness(rand);
  const deal = {
    ...createDeal(biz, 60, toGameTime(1, 600), rand),
    stage: 'won' as const,
    agreedPrice: 1000,
    quote: { pages, features: ['contact_form' as const], price: 1000, days: 10, depositPct: 50 },
  };
  return { biz, project: { ...createProject(deal, biz, 1, rand), status: 'in_progress' } };
}

/** Works 9 AM to 6 PM each day, skipping events, until every task is done. */
function buildAll(p: Project, rand: () => number, levels = { designLevel: 1, devLevel: 1 }): Project {
  for (let i = 0; i < 40 && !allTasksDone(p); i++) {
    p = work({ ...p, pendingEvent: null }, 9, { minute: 9 * 60, ...levels }, rand).project;
  }
  return { ...p, pendingEvent: null };
}

/** The best-matching design a level-3 designer could pick. */
function bestDesign(biz: Business, taste: Project['taste']): Design {
  const pickBest = <T extends string>(opts: Record<T, { vibes: string[] }>) =>
    (Object.keys(opts) as T[]).sort((a, b) => Number(opts[b].vibes.includes(taste)) - Number(opts[a].vibes.includes(taste)))[0];
  return { layout: pickBest(LAYOUTS), palette: pickBest(PALETTES), font: pickBest(FONTS), sections: RECOMMENDED_SECTIONS[biz.industry] };
}

describe('projects', () => {
  it('working finishes tasks and fills the progress bar', () => {
    const rand = seeded(1);
    const { project } = newProject(rand);
    expect(progress(project)).toBe(0);
    const done = buildAll(project, rand);
    expect(allTasksDone(done)).toBe(true);
    expect(progress(done)).toBe(1);
    expect(siteQuality(done)).toBeGreaterThan(20);
  });

  it('higher skill levels build faster', () => {
    const rand = seeded(2);
    const { project } = newProject(rand, 6);
    const slow = work(project, 5, { minute: 540, designLevel: 1, devLevel: 1 }, seeded(3)).project;
    const fast = work(project, 5, { minute: 540, designLevel: 4, devLevel: 4 }, seeded(3)).project;
    expect(progress(fast)).toBeGreaterThan(progress(slow));
  });

  it('never works past 10 PM', () => {
    const rand = seeded(4);
    const { project } = newProject(rand);
    const res = work(project, 10, { minute: 20 * 60, designLevel: 1, devLevel: 1 }, rand);
    expect(res.minutes).toBeLessThanOrEqual(120);
  });

  it('testing finds bugs and fixing removes them', () => {
    const rand = seeded(5);
    const { project } = newProject(rand);
    const buggy = { ...project, hiddenBugs: 5 };
    const tested = testSite(buggy, 3, rand).project;
    expect(tested.foundBugs).toBeGreaterThan(0);
    expect(tested.foundBugs + tested.hiddenBugs).toBe(5);
    const fixed = fixBugs(tested, 600).project;
    expect(fixed.foundBugs).toBe(0);
  });

  it('changing the design after starting adds rework', () => {
    const rand = seeded(6);
    const { project } = newProject(rand);
    const started = work(project, 4, { minute: 540, designLevel: 1, devLevel: 1 }, rand).project;
    const changed = changeDesign({ ...started, pendingEvent: null }, { ...started.design, layout: 'bold', palette: 'dark' });
    expect(changed.tasks.some((t) => t.label === 'Redesign' && t.hours === 4)).toBe(true);
  });

  it('a matching design scores higher than a mismatched one', () => {
    const rand = seeded(7);
    const { biz, project } = newProject(rand);
    const good = designFit({ ...project, design: bestDesign(biz, project.taste) }, biz);
    const badVibe = (['corporate', 'rustic', 'natural', 'bold', 'playful', 'luxury', 'minimal'] as const).find(
      (v) => v !== project.taste && !INDUSTRY_VIBES[biz.industry].includes(v),
    )!;
    const bad = designFit({ ...project, taste: project.taste, design: { ...bestDesign(biz, badVibe), sections: ['faq'] } }, biz);
    expect(good.total).toBeGreaterThan(bad.total);
  });

  it('careful work gets better reviews than rushed, buggy work', () => {
    let careful = 0;
    let rushed = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const rand = seeded(100 + i);
      const { biz, project } = newProject(rand);
      const built = buildAll({ ...project, design: bestDesign(biz, project.taste) }, rand, { designLevel: 2, devLevel: 2 });
      const good = { ...built, hiddenBugs: 0, foundBugs: 0, polish: 2 };
      const bad = { ...built, design: { ...built.design, sections: ['faq' as const] }, hiddenBugs: built.hiddenBugs + 3 };
      careful += evaluateSite(good, biz, 5, rand).stars;
      rushed += evaluateSite(bad, biz, 15, rand).stars;
    }
    console.log(`average stars — careful: ${(careful / n).toFixed(1)}, rushed: ${(rushed / n).toFixed(1)}`);
    expect(careful / n).toBeGreaterThan(3.5);
    expect(rushed / n).toBeLessThan(2.5);
  });

  it('a bug complaint turns hidden bugs into known bugs', () => {
    const rand = seeded(8);
    const { project } = newProject(rand);
    const reviewed: Project = {
      ...project,
      status: 'review',
      hiddenBugs: 2,
      review: { at: 0, approved: false, stars: 2, satisfaction: 40, feedback: 'bugs' },
    };
    const back = applyRevision(reviewed);
    expect(back.status).toBe('in_progress');
    expect(back.foundBugs).toBe(2);
    expect(back.hiddenBugs).toBe(0);
    expect(back.revisions).toBe(1);
  });

  it('clients accept after too many revisions, even if unhappy', () => {
    const rand = seeded(9);
    const { biz, project } = newProject(rand);
    const awful = { ...project, hiddenBugs: 10, revisions: 2 };
    expect(evaluateSite(awful, biz, 30, rand).approved).toBe(true);
  });
});
