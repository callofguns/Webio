// The game's version and what's changed in it. The settings menu reads this.

export const VERSION = 'Beta-v2';

export interface ChangeEntry {
  title: string;
  notes: string[];
}

/** Newest first. */
export const UPDATE_LOG: ChangeEntry[] = [
  {
    title: 'Late-night work',
    notes: [
      'You can now work until midnight instead of stopping at 10 PM.',
      'Work after 8 PM is sloppier and buggier, and after 10 PM it is even worse. A coffee machine halves the damage.',
    ],
  },
  {
    title: 'Designers work on their own',
    notes: [
      'Designers now find design work by themselves when they have nothing to do.',
      'They pick projects you have started that still need design, spreading out between them.',
      'The Team screen explains what design work is.',
    ],
  },
  {
    title: 'Price plans',
    notes: [
      'Quotes can now be a one-time buyout, a monthly retainer, or both (the client picks).',
      'The monthly retainer is a tenth of the full price: $1,000 once, or $100 a month forever, covering hosting and maintenance.',
      'Retainer clients pay their first month when the site goes live, then every 30 days.',
    ],
  },
  {
    title: 'Claude subscription',
    notes: [
      'New Claude subscription in the Office tab, charged every day.',
      'Claude Pro ($20/day): you build sites 50% faster. You still test for bugs yourself.',
      'Claude Max ($45/day): you build 75% faster and bug tests take half the time.',
    ],
  },
  {
    title: 'Beta-v2 · Calls, replies and fixes',
    notes: [
      'Delete conversations that were lost, one at a time or all at once.',
      'Clients sometimes text back right away when they are free.',
      'Phones stay in portrait and tablets in landscape. Turn the device the right way to keep playing.',
      'Much more natural cold call dialogue, with 14 kinds of objections and fewer repeated lines.',
      'Popups close when you tap outside them, press Escape, or drag the sheet down.',
      'Fixed: the tab bar covering "Send quote" on phones.',
      'Fixed: client notes showing answers before the client had replied.',
      'Fixed: text growing and buttons freezing after rotating a phone.',
      'Fixed: the "new version" popup showing off-center on phones, and the Reload button doing nothing.',
    ],
  },
  {
    title: 'v1-beta · Settings menu',
    notes: ['New settings menu on the home screen.', 'See the version, what changed, and what is coming next.'],
  },
  {
    title: 'Part 5 · Offices and equipment',
    notes: [
      'Move from your bedroom to a coworking desk, a small office, or a loft.',
      'A floor plan that fills up with your team and equipment.',
      'Buy a coffee machine, plants, chairs and more for team morale and speed.',
      'Rent is paid every day, so moving up is a real risk.',
    ],
  },
  {
    title: 'Look and feel',
    notes: [
      'A new "studio canvas" design: dot-grid background, selection frames, colour for each section.',
      'New font, playful animations and number keys as shortcuts.',
    ],
  },
  {
    title: 'Phone and calls',
    notes: ['Install Webio on your phone (PWA) and play offline.', 'Mobile layout with a bottom tab bar.', '30 second timer to answer on calls.', 'The next business is pulled up after you hang up.'],
  },
  {
    title: 'Part 4 · Hiring and team',
    notes: ['Post jobs, interview, and give test tasks to find out who is really good.', 'Hire sales callers, designers and developers.', 'Pay wages every Friday and keep morale up.'],
  },
  {
    title: 'Part 3 · Building websites',
    notes: ['Pick pages, features and design for each client.', 'Test for bugs, polish, and handle surprises.', 'Clients review your work. Stars change your reputation.', 'Skills unlock as you level up.'],
  },
  {
    title: 'Part 2 · Texting clients',
    notes: ['A texting screen for every interested business.', 'Ask questions, send quotes, and negotiate the price.'],
  },
  {
    title: 'Part 1 · Cold calling',
    notes: ['Find local businesses and research them.', 'Call them. Read their mood and pitch the right way.', 'A day clock, a bank balance, and living costs.'],
  },
];

/** Ideas for later. Nothing here is promised. */
export const UPCOMING: ChangeEntry[] = [
  {
    title: 'Part 6 · Training',
    notes: ['Courses for you and your team that unlock skills faster.', 'Pay for training in money and time.'],
  },
  {
    title: 'Later',
    notes: ['More types of websites and bigger clients.', 'More office upgrades and team roles.', 'Sound effects and more events.'],
  },
];
