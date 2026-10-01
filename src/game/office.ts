// Where your agency works, and what's in it.
//
// Bigger offices fit more people, make the team happier and faster, and make
// clients take you more seriously on the phone. They also cost rent every day.
// Equipment adds smaller bonuses. Some needs a real office before it fits.

import { MAX_TEAM } from './balance';

export type OfficeId = 'bedroom' | 'coworking' | 'small' | 'loft';

export interface OfficeInfo {
  name: string;
  description: string;
  /** How many employees fit (not counting you). */
  capacity: number;
  /** Rent per day, every day (weekends too). */
  rent: number;
  /** One-time cost to move in (deposit, setup). */
  moveIn: number;
  /** Reputation landlords and clients expect before you can move here. */
  reputation: number;
  /** Added to every employee's happiness. */
  morale: number;
  /** Multiplies how fast your team works. */
  speed: number;
  /** Extra interest on cold calls. A real address sounds trustworthy. */
  presence: number;
  /** Counts as extra reputation when great applicants decide on your offer. */
  prestige: number;
  /** Employees here work from home. */
  remote: boolean;
}

export const OFFICES: Record<OfficeId, OfficeInfo> = {
  bedroom: {
    name: 'Your bedroom',
    description: 'Free, but nobody takes a bedroom agency seriously. Staff work remotely.',
    capacity: MAX_TEAM,
    rent: 0,
    moveIn: 0,
    reputation: 0,
    morale: 0,
    speed: 1,
    presence: 0,
    prestige: 0,
    remote: true,
  },
  coworking: {
    name: 'Co-working desks',
    description: 'A few desks in a shared space. A real address, free coffee, other people around.',
    capacity: 3,
    rent: 30,
    moveIn: 250,
    reputation: 5,
    morale: 3,
    speed: 1,
    presence: 3,
    prestige: 3,
    remote: false,
  },
  small: {
    name: 'Small office',
    description: 'Your own room with your name on the door. Room for a proper little team.',
    capacity: 6,
    rent: 85,
    moveIn: 1500,
    reputation: 15,
    morale: 5,
    speed: 1.05,
    presence: 6,
    prestige: 8,
    remote: false,
  },
  loft: {
    name: 'Studio loft',
    description: 'Big windows, brick walls, a real studio. Clients and great designers want to be here.',
    capacity: 12,
    rent: 210,
    moveIn: 5000,
    reputation: 35,
    morale: 8,
    speed: 1.1,
    presence: 10,
    prestige: 15,
    remote: false,
  },
};

export const OFFICE_ORDER: OfficeId[] = ['bedroom', 'coworking', 'small', 'loft'];

export type FurnitureId = 'laptop' | 'monitor' | 'coffee' | 'plants' | 'headsets' | 'chairs' | 'whiteboard' | 'lounge';

export interface FurnitureInfo {
  name: string;
  /** Shown on the floor plan. */
  icon: string;
  price: number;
  /** Smallest office it fits in. */
  minOffice: OfficeId;
  effect: string;
}

export const FURNITURE: Record<FurnitureId, FurnitureInfo> = {
  laptop: { name: 'Faster laptop', icon: '💻', price: 650, minOffice: 'bedroom', effect: 'You build sites 15% faster.' },
  monitor: { name: 'Second monitor', icon: '🖥️', price: 220, minOffice: 'bedroom', effect: 'You build sites 5% faster.' },
  coffee: { name: 'Coffee machine', icon: '☕', price: 300, minOffice: 'coworking', effect: 'Team morale +3. Late-night work is half as sloppy.' },
  plants: { name: 'Plants', icon: '🪴', price: 120, minOffice: 'coworking', effect: 'Team morale +2.' },
  headsets: { name: 'Phone headsets', icon: '🎧', price: 200, minOffice: 'coworking', effect: 'Sales callers make 20% more calls.' },
  chairs: { name: 'Good chairs', icon: '🪑', price: 450, minOffice: 'small', effect: 'Team morale +3 and the team works 5% faster.' },
  whiteboard: { name: 'Whiteboard wall', icon: '📋', price: 250, minOffice: 'small', effect: 'Designers work 10% faster.' },
  lounge: { name: 'Client lounge', icon: '🛋️', price: 1200, minOffice: 'small', effect: 'New leads start out warmer.' },
};

export const FURNITURE_ORDER: FurnitureId[] = ['laptop', 'monitor', 'coffee', 'plants', 'headsets', 'chairs', 'whiteboard', 'lounge'];

/** True if the office is at least as big as `min`. */
export function atLeast(office: OfficeId, min: OfficeId): boolean {
  return OFFICE_ORDER.indexOf(office) >= OFFICE_ORDER.indexOf(min);
}

/** Equipment only works if it fits in your current office. */
export function activeFurniture(office: OfficeId, owned: FurnitureId[]): FurnitureId[] {
  return owned.filter((f) => atLeast(office, FURNITURE[f].minOffice));
}

export interface OfficeEffects {
  capacity: number;
  rent: number;
  /** Added to employee morale targets. */
  morale: number;
  /** Multiplies every employee's work speed. */
  teamSpeed: number;
  /** Extra multiplier for designers. */
  designSpeed: number;
  /** Multiplies your own building speed. */
  playerSpeed: number;
  /** Extra interest on cold calls. */
  presence: number;
  /** Counts as extra reputation for hiring. */
  prestige: number;
  /** Multiplies how many calls sales callers make. */
  dialMult: number;
  /** Extra warmth for every new lead. */
  leadWarmth: number;
  /** Quality lost per late-night hour of work. */
  latePenalty: number;
}

export function officeEffects(office: OfficeId, owned: FurnitureId[]): OfficeEffects {
  const o = OFFICES[office];
  const has = new Set(activeFurniture(office, owned));
  return {
    capacity: o.capacity,
    rent: o.rent,
    // Pay still matters most for morale. The office only adds a little.
    morale: o.morale + (has.has('coffee') ? 3 : 0) + (has.has('plants') ? 2 : 0) + (has.has('chairs') ? 3 : 0),
    teamSpeed: o.speed * (has.has('chairs') ? 1.05 : 1),
    designSpeed: has.has('whiteboard') ? 1.1 : 1,
    playerSpeed: (has.has('laptop') ? 1.15 : 1) * (has.has('monitor') ? 1.05 : 1),
    presence: o.presence,
    prestige: o.prestige,
    dialMult: has.has('headsets') ? 1.2 : 1,
    leadWarmth: has.has('lounge') ? 8 : 0,
    latePenalty: has.has('coffee') ? 3 : 6,
  };
}

/** Why you can't move there right now, or null if you can. */
export function moveBlocker(to: OfficeId, current: OfficeId, money: number, reputation: number, teamSize: number): string | null {
  if (to === current) return 'You’re already here';
  const o = OFFICES[to];
  if (teamSize > o.capacity) return `Only fits ${o.capacity} people. You have ${teamSize}.`;
  if (reputation < o.reputation) return `Needs ${o.reputation} reputation (you have ${reputation})`;
  if (money < o.moveIn) return `Moving costs $${o.moveIn.toLocaleString()}`;
  return null;
}

export function buyBlocker(item: FurnitureId, office: OfficeId, owned: FurnitureId[], money: number): string | null {
  const f = FURNITURE[item];
  if (owned.includes(item)) return 'Owned';
  if (!atLeast(office, f.minOffice)) return `Needs a ${OFFICES[f.minOffice].name.toLowerCase()} or bigger`;
  if (money < f.price) return `Costs $${f.price.toLocaleString()}`;
  return null;
}
