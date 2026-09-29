import type { Business, BusinessSize, Industry, PainPoint, Temperament, WebsiteState } from './types';
import { pick, randInt, uid, weighted, type Rand, defaultRand } from './rng';

interface IndustryInfo {
  label: string;
  /** Name patterns. `{last}` = owner surname, `{first}` = owner first name, `{place}` = a local place name. */
  names: string[];
  words: string[];
  /** Budget range for a website, in dollars. */
  budget: [number, number];
}

export const INDUSTRIES: Record<Industry, IndustryInfo> = {
  plumbing: {
    label: 'Plumbing',
    names: ["{last} Plumbing", "{place} Plumbing & Drain", "{first}'s Pipe Pros", "{last} & Sons Plumbing"],
    words: [],
    budget: [600, 2500],
  },
  restaurant: {
    label: 'Restaurant',
    names: ["{first}'s Kitchen", "The {word} Table", "{place} Diner", "{word} & Vine", "Casa {last}"],
    words: ['Copper', 'Olive', 'Rustic', 'Golden', 'Iron', 'Garden'],
    budget: [500, 2000],
  },
  salon: {
    label: 'Hair salon',
    names: ["{word} Hair Studio", "Salon {first}", "{place} Cuts", "The {word} Chair"],
    words: ['Velvet', 'Luxe', 'Blush', 'Mirror', 'Silk'],
    budget: [400, 1500],
  },
  dentist: {
    label: 'Dental clinic',
    names: ["{place} Family Dental", "Dr. {last} Dentistry", "{word} Smile Dental"],
    words: ['Bright', 'Gentle', 'Pure', 'Summit'],
    budget: [1500, 6000],
  },
  landscaping: {
    label: 'Landscaping',
    names: ["{last} Lawn & Garden", "{place} Landscaping", "{word} Green Yards"],
    words: ['Evergreen', 'Fresh', 'True', 'Pine'],
    budget: [500, 2000],
  },
  auto: {
    label: 'Auto repair',
    names: ["{last} Auto Repair", "{place} Tire & Brake", "{first}'s Garage"],
    words: [],
    budget: [600, 2500],
  },
  bakery: {
    label: 'Bakery',
    names: ["{word} Crumb Bakery", "{first}'s Bakeshop", "{place} Bread Co."],
    words: ['Sweet', 'Flour', 'Honey', 'Morning'],
    budget: [300, 1200],
  },
  fitness: {
    label: 'Gym / fitness',
    names: ["{place} Fitness", "{word} Strength Club", "{first}'s Boxing Gym"],
    words: ['Iron', 'Forge', 'Peak', 'Core'],
    budget: [800, 3500],
  },
  law: {
    label: 'Law office',
    names: ["{last} Law Group", "{last} & Associates", "{place} Legal"],
    words: [],
    budget: [2000, 8000],
  },
  realestate: {
    label: 'Real estate',
    names: ["{last} Realty", "{place} Homes Group", "{first} {last} Real Estate"],
    words: [],
    budget: [1200, 5000],
  },
};

const FIRST = [
  'Mike', 'Linda', 'Carlos', 'Priya', 'Tom', 'Grace', 'Dev', 'Rosa', 'Frank', 'Mei',
  'Tony', 'Sarah', 'Andre', 'Nina', 'Greg', 'Aisha', 'Paul', 'Elena', 'Omar', 'Julie',
];
const LAST = [
  'Carter', 'Nguyen', 'Romano', 'Patel', 'Brooks', 'Kowalski', 'Hayes', 'Mendez',
  'Olsen', 'Fischer', 'Reed', 'Delgado', 'Murphy', 'Kim', 'Bennett', 'Shah',
];
const PLACES = ['Riverside', 'Oakdale', 'Northgate', 'Elm Street', 'Harbor', 'Westfield', 'Maple', 'Lakeview'];

export const WEBSITE_LABELS: Record<WebsiteState, string> = {
  none: 'No website',
  outdated: 'Outdated site',
  basic: 'Basic site',
  good: 'Good site',
};

export const PAIN_LABELS: Record<PainPoint, string> = {
  no_presence: "Can't be found online at all",
  not_mobile: 'Site breaks on phones',
  looks_dated: 'Site looks like it’s from 2009',
  no_booking: 'No way to book or order online',
  hard_to_find: 'Barely shows up on Google',
};

export const SIZE_LABELS: Record<BusinessSize, string> = {
  solo: 'Owner-run',
  small: '2–10 staff',
  medium: '10–40 staff',
};

function painFor(website: WebsiteState, rand: Rand): PainPoint {
  switch (website) {
    case 'none':
      return 'no_presence';
    case 'outdated':
      return pick(['not_mobile', 'looks_dated'] as const, rand);
    case 'basic':
      return pick(['no_booking', 'hard_to_find', 'not_mobile'] as const, rand);
    case 'good':
      return pick(['hard_to_find', 'no_booking'] as const, rand);
  }
}

function phoneNumber(rand: Rand): string {
  return `(555) ${randInt(200, 989, rand)}-${randInt(1000, 9999, rand)}`;
}

export function generateBusiness(rand: Rand = defaultRand): Business {
  const industry = pick(Object.keys(INDUSTRIES) as Industry[], rand);
  const info = INDUSTRIES[industry];
  const first = pick(FIRST, rand);
  const last = pick(LAST, rand);
  const name = pick(info.names, rand)
    .replace('{first}', first)
    .replace('{last}', last)
    .replace('{place}', pick(PLACES, rand))
    .replace('{word}', info.words.length ? pick(info.words, rand) : 'Main');

  const size = weighted<BusinessSize>({ solo: 5, small: 4, medium: 1.5 }, rand);
  const website = weighted<WebsiteState>({ none: 2.5, outdated: 3.5, basic: 3, good: 1.5 }, rand);
  const temperament = weighted<Temperament>({ friendly: 2.5, busy: 3, skeptical: 3, grumpy: 1.5 }, rand);

  const sizeMult = size === 'solo' ? 0.7 : size === 'small' ? 1 : 1.6;
  const budget = Math.round((randInt(info.budget[0], info.budget[1], rand) * sizeMult) / 50) * 50;

  return {
    id: uid('biz'),
    name,
    industry,
    ownerName: `${first} ${last}`,
    phone: phoneNumber(rand),
    size,
    website,
    temperament,
    painPoint: painFor(website, rand),
    budget,
    researched: false,
    status: 'new',
    attempts: 0,
    lastCalledDay: null,
    cooldownUntil: null,
    callback: null,
    warmth: 0,
    notes: [],
  };
}

export function generateBusinesses(count: number, rand: Rand = defaultRand): Business[] {
  const out: Business[] = [];
  const names = new Set<string>();
  let guard = 0;
  while (out.length < count && guard++ < count * 10) {
    const b = generateBusiness(rand);
    if (names.has(b.name)) continue;
    names.add(b.name);
    out.push(b);
  }
  return out;
}
