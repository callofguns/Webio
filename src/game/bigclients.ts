// Bigger clients, and clients who come back for more.
//
// Big companies and chains only take your calls once your agency looks the
// part: a good reputation and a proper office. They want big sites with big
// features, and they pay for them.
//
// Clients who loved their site sometimes text you weeks later with a new job:
// a redesign, or something new added to their site.

import type { Business, Deal, Feature, GameTime, Project } from './types';
import { atLeast, OFFICES, type OfficeId } from './office';
import { chance, pick, randInt, type Rand, defaultRand } from './rng';
import { createDeal, FEATURES, INDUSTRY_NEEDS, BIG_EXTRAS, marketPrice, textMessage } from './deals';

/** Reputation you need before big companies take you seriously. */
export const BIG_CLIENT_REPUTATION = 25;
/** The smallest office big companies are happy to work with. */
export const BIG_CLIENT_OFFICE: OfficeId = 'small';
/** Once unlocked, how likely each new business you find is to be a big one. */
export const BIG_CLIENT_CHANCE = 0.2;

export function bigClientsOpen(reputation: number, office: OfficeId): boolean {
  return reputation >= BIG_CLIENT_REPUTATION && atLeast(office, BIG_CLIENT_OFFICE);
}

/** What's still missing before big clients show up, in plain words. Empty when they're open. */
export function bigClientsMissing(reputation: number, office: OfficeId): string[] {
  const out: string[] = [];
  if (reputation < BIG_CLIENT_REPUTATION) out.push(`Reputation ${BIG_CLIENT_REPUTATION} (you have ${reputation})`);
  if (!atLeast(office, BIG_CLIENT_OFFICE)) out.push(`A ${OFFICES[BIG_CLIENT_OFFICE].name.toLowerCase()} or bigger`);
  return out;
}

/** How likely each new business is to be a big one right now. */
export function bigChance(reputation: number, office: OfficeId): number {
  return bigClientsOpen(reputation, office) ? BIG_CLIENT_CHANCE : 0;
}

// ---------------------------------------------------------------------------
// Returning clients

/** How likely a client is to come back with more work, by how many stars they gave. */
const COMEBACK_CHANCE: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0.45, 5: 0.7 };

/** The day a happy client will text you again, or null if they won't. */
export function comebackDay(stars: number, day: number, rand: Rand = defaultRand): number | null {
  return chance(COMEBACK_CHANCE[stars] ?? 0, rand) ? day + randInt(8, 20, rand) : null;
}

/** New things a client could add to the site they already have, that you know how to build. */
export function addOnOptions(biz: Business, have: Feature[], devLevel = 99): Feature[] {
  const { core, extra } = INDUSTRY_NEEDS[biz.industry];
  const pool: Feature[] = [...core, ...extra, 'reviews', 'gallery', 'blog'];
  if (biz.size === 'large') pool.push('locations', 'multilang', ...BIG_EXTRAS[biz.industry]);
  return [...new Set(pool)].filter((f) => f !== 'copywriting' && !have.includes(f) && FEATURES[f].devLevel <= devLevel);
}

/**
 * A happy client texts you about a new job. They tell you everything up front,
 * so you can go straight to writing a quote. They trust you, so they're warm.
 */
export function returnDeal(biz: Business, project: Project, now: GameTime, devLevel: number, rand: Rand = defaultRand): Deal {
  const first = biz.ownerName.split(' ')[0];
  // They ask for things they've seen on other sites, which is usually something you can build.
  const options = addOnOptions(biz, project.features, devLevel);
  const addOn = options.length > 0 && chance(0.65, rand);
  const features = addOn
    ? [...options].sort(() => rand() - 0.5).slice(0, chance(0.4, rand) ? 2 : 1)
    : project.features.filter((f) => f !== 'copywriting');
  const pages = addOn ? 1 : project.pages + randInt(0, 2, rand);
  const deadlineDays = addOn ? randInt(10, 25, rand) : randInt(20, 40, rand);
  const market = marketPrice(pages, features);
  const budget = Math.round((market * (1.15 + rand() * 0.3)) / 50) * 50;
  const weeks = Math.max(1, Math.round(deadlineDays / 7));
  const list = features.map((f) => FEATURES[f].label.toLowerCase()).join(' and ');

  const ask = addOn
    ? pick(
        [
          `Hi! It’s ${first} from ${biz.name}. The site has been great for us. Could you add ${list}? Within ${weeks} weeks would be perfect.`,
          `Hey, ${first} here from ${biz.name} 👋 Customers love the site. We’d like to add ${list} next. Can you send me a quote? We’d need it in about ${weeks} weeks.`,
          `Hi, ${first} at ${biz.name}. We’re ready for the next step: ${list}. Budget is around $${budget.toLocaleString()}, and ${weeks} weeks would work.`,
        ],
        rand,
      )
    : pick(
        [
          `Hi! It’s ${first} from ${biz.name}. Business is growing and we’d love a fresh redesign, about ${pages} pages with everything we have now. Could you quote it? We have about ${weeks} weeks.`,
          `Hey, ${first} here 🙂 You did such a good job last time. We want a whole new look for the site, ${pages} pages. Can you send a quote? Around ${weeks} weeks is fine.`,
          `Hi, ${first} at ${biz.name}. Time for a redesign! Same features, about ${pages} pages, a fresh new look. Budget is around $${budget.toLocaleString()}.`,
        ],
        rand,
      );

  const base = createDeal(biz, 72 + (project.stars ?? 4) * 3, now, rand);
  return {
    ...base,
    stage: 'discovery',
    // They told you exactly what they want, so there's nothing to ask.
    needs: { features, pages, deadlineDays, hasContent: true },
    known: { features: true, budget: true, deadline: true, content: true },
    budgetHint: [Math.round((market * 0.9) / 50) * 50, budget],
    budget,
    returning: addOn ? 'addon' : 'redesign',
    patience: base.patience + 1,
    messages: [
      textMessage('system', `${biz.name} came back! They loved their last site and want more work.`, now),
      textMessage('them', ask, now),
    ],
    readAt: now - 1,
  };
}
