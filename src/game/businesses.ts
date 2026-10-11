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
    names: [
      '{last} Plumbing',
      '{place} Plumbing & Drain',
      "{first}'s Pipe Pros",
      '{last} & Sons Plumbing',
      '{word} Plumbing Co.',
      '{place} Rooter & Plumbing',
      '{last} Pipe & Drain',
      '{word} Drain Service',
      'A-1 {last} Plumbers',
      '{first} {last} Plumbing',
      '{place} Water Works',
    ],
    words: ['Reliable', 'Rapid', 'Anchor', 'Blue Line', 'Precision', 'First Call', 'Clear Flow', 'Steadfast', 'Copperhead', 'Honest'],
    budget: [600, 2500],
  },
  restaurant: {
    label: 'Restaurant',
    names: [
      "{first}'s Kitchen",
      'The {word} Table',
      '{place} Diner',
      '{word} & Vine',
      'Casa {last}',
      'The {word} Fork',
      '{word} House',
      "{last}'s Grill",
      'Trattoria {last}',
      '{place} Tavern',
      'The {word} Spoon',
      '{word} Taqueria',
      '{first} & {first2} Eatery',
      'Little {place}',
    ],
    words: ['Copper', 'Olive', 'Rustic', 'Golden', 'Iron', 'Garden', 'Saffron', 'Juniper', 'Crimson', 'Wild Basil', 'Harvest', 'Smoke', 'Salt', 'Lantern'],
    budget: [500, 2000],
  },
  salon: {
    label: 'Hair salon',
    names: [
      '{word} Hair Studio',
      'Salon {first}',
      '{place} Cuts',
      'The {word} Chair',
      '{word} Salon & Spa',
      "{first}'s Hair Lounge",
      '{word} & Co. Hair',
      'Shear {word}',
      '{place} Hair Co.',
      'Studio {last}',
      'The {word} Room',
    ],
    words: ['Velvet', 'Luxe', 'Blush', 'Mirror', 'Silk', 'Honey', 'Rose', 'Ivory', 'Sage', 'Golden Comb', 'Peony', 'Twist'],
    budget: [400, 1500],
  },
  dentist: {
    label: 'Dental clinic',
    names: [
      '{place} Family Dental',
      'Dr. {last} Dentistry',
      '{word} Smile Dental',
      '{place} Dental Care',
      '{last} Family Dentistry',
      '{word} Dental Studio',
      'Dr. {first} {last}, DDS',
      '{place} Smiles',
      '{word} Tooth Care',
    ],
    words: ['Bright', 'Gentle', 'Pure', 'Summit', 'Radiant', 'Easy', 'Evergreen', 'Cornerstone', 'Clear', 'Happy'],
    budget: [1500, 6000],
  },
  landscaping: {
    label: 'Landscaping',
    names: [
      '{last} Lawn & Garden',
      '{place} Landscaping',
      '{word} Green Yards',
      '{last} Tree & Lawn',
      '{word} Outdoor Design',
      "{first}'s Lawn Care",
      '{place} Garden Works',
      '{word} Landscapes',
      '{last} & Sons Landscaping',
      'Mow Better {place}',
    ],
    words: ['Evergreen', 'Fresh', 'True', 'Pine', 'Meadow', 'Cedar', 'Greenleaf', 'Stonecrop', 'Willow', 'Backyard', 'Clover'],
    budget: [500, 2000],
  },
  auto: {
    label: 'Auto repair',
    names: [
      '{last} Auto Repair',
      '{place} Tire & Brake',
      "{first}'s Garage",
      '{word} Auto Care',
      '{last} Motors',
      '{place} Auto Service',
      '{word} Wheel & Tire',
      "{last}'s Transmission",
      '{word} Auto Body',
      '{first} {last} Automotive',
    ],
    words: ['Precision', 'Trusty', 'Highway', 'Redline', 'Dependable', 'Apex', 'Crossroads', 'Mile High', 'Torque', 'Ironside'],
    budget: [600, 2500],
  },
  bakery: {
    label: 'Bakery',
    names: [
      '{word} Crumb Bakery',
      "{first}'s Bakeshop",
      '{place} Bread Co.',
      'The {word} Oven',
      '{word} Rolling Pin',
      '{last} Family Bakery',
      '{place} Pastry Shop',
      'Little {word} Bakery',
      '{word} Loaf',
      "{first}'s Cakes & Pies",
    ],
    words: ['Sweet', 'Flour', 'Honey', 'Morning', 'Golden', 'Buttery', 'Cinnamon', 'Warm', 'Sugar Plum', 'Sourdough', 'Rye'],
    budget: [300, 1200],
  },
  fitness: {
    label: 'Gym / fitness',
    names: [
      '{place} Fitness',
      '{word} Strength Club',
      "{first}'s Boxing Gym",
      '{word} Athletic Club',
      '{place} CrossFit',
      '{word} Yoga Studio',
      'Train with {first}',
      '{word} Performance Gym',
      '{place} Health & Fitness',
      '{last} Martial Arts',
    ],
    words: ['Iron', 'Forge', 'Peak', 'Core', 'Anchor', 'Summit', 'Titan', 'Stride', 'Pulse', 'Granite', 'Momentum'],
    budget: [800, 3500],
  },
  law: {
    label: 'Law office',
    names: [
      '{last} Law Group',
      '{last} & Associates',
      '{place} Legal',
      '{last} & {last2}, Attorneys',
      'Law Offices of {first} {last}',
      '{place} Family Law',
      '{last} Legal Services',
      '{last} Injury Law',
      '{word} Law Partners',
    ],
    words: ['Summit', 'Cornerstone', 'Liberty', 'Meridian', 'Hallmark', 'Sterling', 'Harbor', 'Keystone'],
    budget: [2000, 8000],
  },
  realestate: {
    label: 'Real estate',
    names: [
      '{last} Realty',
      '{place} Homes Group',
      '{first} {last} Real Estate',
      '{word} Key Realty',
      '{place} Property Partners',
      '{last} & Co. Realtors',
      'Home Sweet {place}',
      '{word} Door Realty',
      "{first}'s Home Team",
      '{place} Estates',
    ],
    words: ['Golden', 'Open', 'Welcome', 'Landmark', 'Hearth', 'Front', 'Silver Key', 'Bluebird', 'Compass'],
    budget: [1200, 5000],
  },
};

const FIRST = [
  'Mike', 'Linda', 'Carlos', 'Priya', 'Tom', 'Grace', 'Dev', 'Rosa', 'Frank', 'Mei',
  'Tony', 'Sarah', 'Andre', 'Nina', 'Greg', 'Aisha', 'Paul', 'Elena', 'Omar', 'Julie',
  'Brian', 'Fatima', 'Hector', 'Janet', 'Ravi', 'Chloe', 'Marcus', 'Yuki', 'Dana', 'Luis',
  'Beth', 'Kwame', 'Irene', 'Sam', 'Olga', 'Dennis', 'Amara', 'Victor', 'Holly', 'Jamal',
  'Tessa', 'Hugo', 'Naomi', 'Walter', 'Lucia', 'Ben', 'Zainab', 'Cole', 'Marta', 'Raj',
  'Kelly', 'Diego', 'Anita', 'Pete', 'Hana', 'Rick', 'Sofia', 'Leo', 'Wendy', 'Ibrahim',
  'Carol', 'Mateo', 'Joyce', 'Nate', 'Esther', 'Arjun', 'Bridget', 'Felix', 'Gloria', 'Ivan',
  'Jade', 'Kofi', 'Lena', 'Manny', 'Nadia', 'Oscar', 'Pam', 'Quentin', 'Rhonda', 'Stan',
  'Tara', 'Uma', 'Vince', 'Willa', 'Xavier', 'Yolanda', 'Zack', 'Abby', 'Bruno', 'Cora',
  'Dale', 'Edith', 'Farid', 'Gwen', 'Hank', 'Ines', 'Joel', 'Kara', 'Lance', 'Mona',
];
const LAST = [
  'Carter', 'Nguyen', 'Romano', 'Patel', 'Brooks', 'Kowalski', 'Hayes', 'Mendez',
  'Olsen', 'Fischer', 'Reed', 'Delgado', 'Murphy', 'Kim', 'Bennett', 'Shah',
  'Alvarez', 'Becker', 'Chen', 'Dawson', 'Ellis', 'Foster', 'Garcia', 'Hughes',
  'Ibrahim', 'Jensen', 'Khan', 'Larson', 'Morales', 'Novak', "O'Brien", 'Park',
  'Quinn', 'Rossi', 'Santos', 'Tanaka', 'Underwood', 'Vasquez', 'Walsh', 'Xu',
  'Young', 'Zimmerman', 'Adler', 'Barnes', 'Castillo', 'Dubois', 'Evans', 'Flores',
  'Grant', 'Hassan', 'Ivanov', 'Jordan', 'Kaplan', 'Lopez', 'Mitchell', 'Nakamura',
  'Okafor', 'Petrov', 'Ramirez', 'Sullivan', 'Thompson', 'Ueda', 'Valdez', 'Wagner',
  'Yilmaz', 'Zhang', 'Abbott', 'Bishop', 'Coleman', 'Duncan', 'Estrada', 'Finch',
  'Gallagher', 'Hoffman', 'Iverson', 'Jacobs', 'Keller', 'Lindqvist', 'Moreno', 'Nolan',
  'Ortega', 'Pierce', 'Rao', 'Silva', 'Tran', 'Ulrich', 'Voss', 'Whitaker',
];
const PLACES = [
  'Riverside', 'Oakdale', 'Northgate', 'Elm Street', 'Harbor', 'Westfield', 'Maple', 'Lakeview',
  'Cedar Park', 'Brookside', 'Hillcrest', 'Fairview', 'Stonebridge', 'Eastwood', 'Millbrook', 'Pinecrest',
  'Southport', 'Greenfield', 'Ashland', 'Sunset', 'Highland', 'Clearwater', 'Bayview', 'Ridgeway',
  'Old Town', 'Lincoln', 'Franklin', 'Crescent', 'Meadowbrook', 'Willow Creek', 'Union Square', 'Main Street',
  'Rockport', 'Foxhall', 'Birchwood', 'Summit', 'Redwood', 'Dover', 'Kensington', 'Bellmont',
];

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
    .replace('{first2}', pick(FIRST.filter((f) => f !== first), rand))
    .replace('{last2}', pick(LAST.filter((l) => l !== last), rand))
    .replaceAll('{first}', first)
    .replaceAll('{last}', last)
    .replace('{place}', pick(PLACES, rand))
    .replace('{word}', pick(info.words, rand));

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

/** Makes `count` businesses with names that are unique, also compared to the ones you already have. */
export function generateBusinesses(count: number, rand: Rand = defaultRand, existing: Business[] = []): Business[] {
  const out: Business[] = [];
  const names = new Set<string>(existing.map((b) => b.name));
  let guard = 0;
  while (out.length < count && guard++ < count * 10) {
    const b = generateBusiness(rand);
    if (names.has(b.name)) continue;
    names.add(b.name);
    out.push(b);
  }
  return out;
}
