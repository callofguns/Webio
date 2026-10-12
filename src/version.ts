// The game's version and what's changed in it. The settings menu reads this.

export const VERSION = 'v1.2.0';
/** A line about this release, shown under the version in settings. */
export const VERSION_NOTE = 'Big League: big companies, bigger sites, and clients who come back for more. Thanks for playing!';

export interface ChangeEntry {
  title: string;
  notes: string[];
}

/** Newest first. */
export const UPDATE_LOG: ChangeEntry[] = [
  {
    title: 'Latest changes',
    notes: ['The menu icons wiggle when you tap them on a phone or tablet, not only when you hover with a mouse. The settings gear spins when you press it too.'],
  },
  {
    title: 'v1.2.0 · Big League',
    notes: [
      'Big companies and chains start taking your calls once you have reputation 25 and a small office or bigger. Look for the Big client tag on your call list. The Dashboard shows how close you are.',
      'They want big sites (10 to 14 pages) and pay a lot more, often $4,000 to $8,000, with longer deadlines.',
      'Four new big features: member accounts, many locations, delivery ordering and multi-language. Designers handle the translating.',
      'Happy clients come back: after a 4 or 5 star site, they may text you a few weeks later with a paid add-on or a redesign. They tell you exactly what they want, so you can quote right away.',
      'Your best salespeople count the whole team sharing a site when they set deadlines, so big jobs get fair dates.',
    ],
  },
  {
    title: 'v1.1.0 · Team Players',
    notes: [
      'Project cards (and the project page) show who on your team is working on them, with a green dot while they are at it.',
      'Employees find work more reliably: they spread out between projects instead of piling onto one.',
      'When a site is fully built, developers test it and fix bugs, and designers polish it, then you are told it is ready to send to the client.',
      'With no designer on the team, developers start new projects themselves.',
      'New Claude Enterprise plan in the Office tab: $40 a day for every developer on your team, and you count as one (minimum 3 seats). Everything in Max, and every developer builds 50% faster.',
      'Your best salespeople keep signing sites until you have 4 on the go, plus 3 more for each developer (it used to be 3, plus 2 for each designer or developer).',
      'They set deadlines from how many sites are already waiting, shared between you and your developers, and promise dates the team can actually hit.',
      'Thousands of different business names, and new businesses never repeat a name you already have.',
      'Conversations are more varied: clients answer, react to quotes and negotiate in many different ways depending on their mood. Rushed owners sound like their job, and friendly ones greet you for the time of day.',
    ],
  },
  {
    title: 'v1.0.1',
    notes: [
      'Messages can be filtered: All, Pending (waiting on you), Waiting (for a reply), Signed and Lost. The filter you pick is remembered.',
      'Going back from a business, chat or project puts you back where you were scrolled in the list.',
    ],
  },
  {
    title: 'v1.0 · The first full release',
    notes: [
      'The beta is over: this is the first full release of Webio.',
      'Everything from the betas is in: cold calling, texting and quotes, building sites, hiring, offices, courses, closers, price plans and the Claude subscription.',
      'Designers now plan new projects too: they ask the client what style they like, pick a matching design and start the project.',
    ],
  },
  {
    title: 'Beta-v3 · The final beta',
    notes: [
      'Part 6: courses. Pay for a workshop, course or masterclass in sales, design or development to level up faster, for you or your team (Skills screen).',
      'Your best sales people (level 4 and up) now text clients, send quotes, negotiate and sign deals on their own. Signed deals go straight to Projects.',
      'Designers and developers find work on their own when they have nothing to do.',
      'Quotes can be a one-time buyout, a monthly retainer (a tenth of the price, paid forever), or both.',
      'Claude subscription in the Office tab: Pro builds 50% faster, Max builds 75% faster and halves bug testing time.',
      'You can work until midnight. Work gets sloppier the later it gets, and a coffee machine helps.',
      'Tap the tab you are already on to go back to its main page.',
      'Designers now plan new projects too: they ask the client what style they like, pick a matching design and start the project.',
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
    title: 'Coming up',
    notes: ['Random events: viral clients, sick days, rival agencies.', 'Goals and milestones with rewards.', 'More office upgrades and team roles.', 'Sound effects.'],
  },
];
