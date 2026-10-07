import { describe, expect, it } from 'vitest';
import { generateBusiness } from './businesses';
import { createDeal, toGameTime } from './deals';
import {
  allTasksDone,
  applyRevision,
  changeDesign,
  chooseDesign,
  createProject,
  designFit,
  evaluateSite,
  fixBugs,
  isDefaultDesign,
  progress,
  siteQuality,
  testSite,
  work,
} from './projects';
import { SECTION_ORDER } from './design';
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

  it('never works past midnight', () => {
    const rand = seeded(4);
    const { project } = newProject(rand);
    const res = work(project, 10, { minute: 20 * 60, designLevel: 1, devLevel: 1 }, rand);
    expect(res.minutes).toBeLessThanOrEqual(240);
  });

  it('you can work late into the night, but the later it gets the sloppier the work', () => {
    const lostQuality = (minute: number, latePenalty?: number) => {
      const rand = seeded(6);
      const { project } = newProject(rand);
      const res = work({ ...project, tasks: project.tasks.map((t) => ({ ...t })) }, 1, { minute, designLevel: 1, devLevel: 1, latePenalty, events: false }, rand);
      expect(res.minutes).toBe(60);
      return res.project.tasks.reduce((sum, t) => sum + t.penalty, 0);
    };
    expect(lostQuality(14 * 60)).toBe(0);
    expect(lostQuality(21 * 60)).toBe(6);
    expect(lostQuality(22 * 60 + 30)).toBe(9); // 1.5 times as bad after 10 PM
    expect(lostQuality(22 * 60 + 30, 3)).toBe(4.5); // a coffee machine halves it
    expect(lostQuality(23 * 60)).toBe(9); // the last hour before midnight is still allowed
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

describe('planning a design', () => {
  const unstarted = (rand: () => number) => {
    const { biz, project } = newProject(rand);
    return { biz, project: { ...project, status: 'not_started' as const } };
  };

  it('a new project starts with the untouched default design', () => {
    const { project } = unstarted(seeded(1));
    expect(isDefaultDesign(project.design)).toBe(true);
  });

  it('a good designer picks a design that suits the client better than the default', () => {
    const rand = seeded(2);
    let better = 0;
    let worse = 0;
    for (let i = 0; i < 300; i++) {
      const { biz, project } = unstarted(rand);
      const planned = { ...project, design: chooseDesign(project, biz, 4, rand) };
      const diff = designFit(planned, biz).total - designFit(project, biz).total;
      if (diff > 0) better++;
      if (diff < 0) worse++;
    }
    expect(better).toBeGreaterThan(worse * 5);
  });

  it('a new designer can only use options their level allows, and misses more often', () => {
    const rand = seeded(3);
    let fit1 = 0;
    let fit5 = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const { biz, project } = unstarted(rand);
      const d1 = chooseDesign(project, biz, 1, rand);
      expect(LAYOUTS[d1.layout].level).toBeLessThanOrEqual(1);
      expect(PALETTES[d1.palette].level).toBeLessThanOrEqual(1);
      expect(FONTS[d1.font].level).toBeLessThanOrEqual(1);
      fit1 += designFit({ ...project, design: d1 }, biz).total;
      fit5 += designFit({ ...project, design: chooseDesign(project, biz, 5, rand) }, biz).total;
    }
    expect(fit5 / n).toBeGreaterThan(fit1 / n + 3);
  });

  it('always plans a sensible set of sections, with a way to get in touch', () => {
    const rand = seeded(4);
    for (let i = 0; i < 200; i++) {
      const { biz, project } = unstarted(rand);
      const { sections } = chooseDesign(project, biz, 3, rand);
      expect(sections).toContain('contact');
      expect(sections.length).toBeGreaterThanOrEqual(3);
      expect(sections.length).toBeLessThanOrEqual(6);
      expect(sections).toEqual(SECTION_ORDER.filter((x) => sections.includes(x)));
      for (const r of RECOMMENDED_SECTIONS[biz.industry]) expect(sections).toContain(r);
    }
  });
});
