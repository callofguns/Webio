// Design options for the website builder: layouts, color palettes, fonts and
// page sections. Each option has "vibes". Clients like options that match their
// taste and their kind of business.

import type { Industry } from './types';

export type Vibe = 'corporate' | 'rustic' | 'natural' | 'bold' | 'playful' | 'luxury' | 'minimal';

export const VIBE_LABELS: Record<Vibe, string> = {
  corporate: 'Professional',
  rustic: 'Warm & homey',
  natural: 'Fresh & natural',
  bold: 'Bold',
  playful: 'Fun & friendly',
  luxury: 'Premium',
  minimal: 'Minimal',
};

/** What a client says when you ask about the style they like. */
export const TASTE_HINTS: Record<Vibe, string> = {
  corporate: 'Clean and professional. We want people to trust us.',
  rustic: 'Something warm and homey, like an old family place.',
  natural: 'Fresh and natural. Calm, lots of green maybe?',
  bold: 'Something bold that really stands out!',
  playful: 'Fun and friendly! Nothing too serious.',
  luxury: 'High-end. It should feel premium and classy.',
  minimal: 'Simple and minimal. Lots of white space, nothing cluttered.',
};

/** The styles that usually suit each kind of business. */
export const INDUSTRY_VIBES: Record<Industry, Vibe[]> = {
  plumbing: ['corporate', 'bold'],
  restaurant: ['rustic', 'luxury', 'bold'],
  salon: ['luxury', 'playful', 'minimal'],
  dentist: ['corporate', 'natural', 'minimal'],
  landscaping: ['natural', 'rustic'],
  auto: ['bold', 'corporate'],
  bakery: ['playful', 'rustic'],
  fitness: ['bold', 'natural'],
  law: ['corporate', 'luxury', 'minimal'],
  realestate: ['luxury', 'corporate', 'minimal'],
};

export type LayoutId = 'classic' | 'bold' | 'minimal' | 'cards' | 'split';
export type PaletteId = 'trust' | 'earth' | 'fresh' | 'dark' | 'pastel' | 'gold' | 'mono';
export type FontId = 'sans' | 'serif' | 'rounded' | 'display';
export type SectionId = 'services' | 'about' | 'gallery' | 'testimonials' | 'pricing' | 'team' | 'faq' | 'contact';

interface Option {
  name: string;
  description: string;
  vibes: Vibe[];
  /** Design skill level needed. */
  level: number;
}

export const LAYOUTS: Record<LayoutId, Option> = {
  classic: { name: 'Classic', description: 'Text on the left, photo on the right', vibes: ['corporate', 'rustic'], level: 1 },
  cards: { name: 'Card grid', description: 'Friendly tiles for everything', vibes: ['playful', 'natural'], level: 1 },
  bold: { name: 'Big & bold', description: 'Huge headline on a strong color', vibes: ['bold', 'playful'], level: 1 },
  minimal: { name: 'Minimal', description: 'Lots of white space, thin lines', vibes: ['minimal', 'luxury'], level: 2 },
  split: { name: 'Split screen', description: 'Full-height photo beside the text', vibes: ['luxury', 'corporate', 'natural'], level: 3 },
};

export interface Palette extends Option {
  bg: string;
  surface: string;
  primary: string;
  text: string;
  muted: string;
  onPrimary: string;
}

export const PALETTES: Record<PaletteId, Palette> = {
  trust: { name: 'Trust blue', description: 'Calm and dependable', vibes: ['corporate'], level: 1, bg: '#ffffff', surface: '#eef3fb', primary: '#1f5fbf', text: '#14213d', muted: '#5c6b84', onPrimary: '#ffffff' },
  earth: { name: 'Warm earth', description: 'Cozy browns and cream', vibes: ['rustic'], level: 1, bg: '#fbf6ef', surface: '#f1e6d6', primary: '#9a4f25', text: '#3b2a1e', muted: '#7d6655', onPrimary: '#ffffff' },
  fresh: { name: 'Fresh green', description: 'Clean and natural', vibes: ['natural'], level: 1, bg: '#ffffff', surface: '#ecf6ee', primary: '#2f8a4c', text: '#17311f', muted: '#5a7563', onPrimary: '#ffffff' },
  dark: { name: 'Bold dark', description: 'Dark with a loud accent', vibes: ['bold'], level: 1, bg: '#121418', surface: '#1e2229', primary: '#ff5a1f', text: '#f3f4f6', muted: '#9aa1ad', onPrimary: '#ffffff' },
  pastel: { name: 'Soft pastel', description: 'Sweet and playful', vibes: ['playful'], level: 1, bg: '#fff8fb', surface: '#fdeaf2', primary: '#d6457e', text: '#3d2530', muted: '#86677a', onPrimary: '#ffffff' },
  mono: { name: 'Black & white', description: 'Sharp and simple', vibes: ['minimal'], level: 2, bg: '#ffffff', surface: '#f4f4f4', primary: '#111111', text: '#111111', muted: '#6b6b6b', onPrimary: '#ffffff' },
  gold: { name: 'Black & gold', description: 'Elegant and premium', vibes: ['luxury'], level: 3, bg: '#0f0e0c', surface: '#1b1914', primary: '#c9a24a', text: '#f5efe2', muted: '#a89f8c', onPrimary: '#0f0e0c' },
};

export interface FontOption extends Option {
  heading: string;
  body: string;
}

export const FONTS: Record<FontId, FontOption> = {
  sans: { name: 'Modern sans', description: 'Neutral and easy to read', vibes: ['corporate', 'minimal'], level: 1, heading: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
  rounded: { name: 'Friendly rounded', description: 'Soft and approachable', vibes: ['playful', 'natural'], level: 1, heading: "Nunito, 'Arial Rounded MT Bold', system-ui, sans-serif", body: "Nunito, system-ui, sans-serif" },
  serif: { name: 'Classic serif', description: 'Traditional and trustworthy', vibes: ['rustic', 'corporate'], level: 2, heading: "Georgia, 'Times New Roman', serif", body: "Georgia, serif" },
  display: { name: 'Elegant display', description: 'Fancy headings, fashion style', vibes: ['luxury', 'bold'], level: 3, heading: "'Playfair Display', Georgia, serif", body: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" },
};

export const SECTIONS: Record<SectionId, { name: string }> = {
  services: { name: 'Services' },
  about: { name: 'About us' },
  gallery: { name: 'Gallery' },
  testimonials: { name: 'Testimonials' },
  pricing: { name: 'Pricing' },
  team: { name: 'Meet the team' },
  faq: { name: 'FAQ' },
  contact: { name: 'Contact' },
};

export const SECTION_ORDER: SectionId[] = ['services', 'about', 'gallery', 'testimonials', 'pricing', 'team', 'faq', 'contact'];

/** Sections visitors expect to see for each kind of business. */
export const RECOMMENDED_SECTIONS: Record<Industry, SectionId[]> = {
  plumbing: ['services', 'testimonials', 'faq', 'contact'],
  restaurant: ['about', 'gallery', 'testimonials', 'contact'],
  salon: ['services', 'gallery', 'team', 'pricing'],
  dentist: ['services', 'team', 'testimonials', 'faq'],
  landscaping: ['services', 'gallery', 'testimonials', 'contact'],
  auto: ['services', 'pricing', 'testimonials', 'contact'],
  bakery: ['about', 'gallery', 'testimonials', 'contact'],
  fitness: ['pricing', 'team', 'gallery', 'testimonials'],
  law: ['services', 'team', 'about', 'contact'],
  realestate: ['about', 'team', 'testimonials', 'contact'],
};

export interface Design {
  layout: LayoutId;
  palette: PaletteId;
  font: FontId;
  sections: SectionId[];
}

export const DEFAULT_DESIGN: Design = { layout: 'classic', palette: 'trust', font: 'sans', sections: ['services', 'about', 'contact'] };

/** Headline for the preview's hero section. */
export const HEADLINES: Record<Industry, string> = {
  plumbing: 'Fast, friendly plumbing when you need it',
  restaurant: 'Good food, made with love',
  salon: 'Look good. Feel even better.',
  dentist: 'Gentle care for the whole family',
  landscaping: 'Beautiful yards, all year round',
  auto: 'Honest repairs at fair prices',
  bakery: 'Baked fresh every morning',
  fitness: 'Get stronger every week',
  law: 'Straight answers. Real results.',
  realestate: 'Find the home you’ll love',
};

/** Example services shown in the preview. */
export const SERVICES: Record<Industry, [string, string, string]> = {
  plumbing: ['Leak repair', 'Drain cleaning', 'Water heaters'],
  restaurant: ['Lunch', 'Dinner', 'Private events'],
  salon: ['Cuts & styling', 'Color', 'Treatments'],
  dentist: ['Check-ups', 'Whitening', 'Emergency care'],
  landscaping: ['Lawn care', 'Garden design', 'Tree trimming'],
  auto: ['Oil changes', 'Brakes', 'Diagnostics'],
  bakery: ['Fresh bread', 'Custom cakes', 'Pastries'],
  fitness: ['Personal training', 'Group classes', 'Open gym'],
  law: ['Family law', 'Business law', 'Real estate law'],
  realestate: ['Buying', 'Selling', 'Home valuation'],
};
