# Webio

A 2D management game where you run your own web design agency. Start alone in your
bedroom with $1,800, cold call local businesses, win clients, build their websites,
and grow into a real agency with a team and an office.

It's meant to feel close to real life: most calls go nowhere, money runs out fast,
and growing is hard.

## The main loop

1. **Cold call** local businesses from the Phone screen *(done — part 1)*
2. **Text** the interested ones, work out what they need, and agree on a price *(done — part 2)*
3. **Build** their website by choosing layouts, features and content *(done — part 3)*
4. Get paid, grow your reputation, and repeat

Later on: **hire** employees to automate the work *(done — part 4)*, **upgrade your office**
*(part 5)*, and **train** yourself and your team to unlock better skills *(part 6)*.

## What's in part 1

- Start screen: name yourself and your agency
- A game clock (9 AM – 6 PM workdays, closed on Sundays) where every action takes time
- Daily living costs, and a summary at the end of each day
- **Cold calling:**
  - A list of generated local businesses (plumbers, salons, dentists, law offices…)
  - Research a business (15 min) to learn the owner's name, their website and their biggest problem
  - Calls can ring out, go to voicemail, hit a receptionist, or reach the owner
  - Owners have hidden personalities (friendly, busy, skeptical, grumpy). Listen to how they answer
  - Pick your opener, handle objections, and ask for a meeting, a text, or a callback
  - A "vibe" meter shows how warm they're getting
  - Callbacks, "not interested" cooldowns, and "never call again"
  - Best and worst times of day to call
- Sales skill that levels up as you make calls
- Autosave in your browser

## What's in part 2

- **Messages:** every business that says yes on the phone gets a text thread
- Replies take game time (busy owners are slow, nobody texts at night), so you keep
  calling while you wait, or use **Wait 1 hr**
- Ask about their needs, budget, deadline and content. Ask too much and they get annoyed
- **Client notes** fill in as you learn things (grumpy owners lowball their budget!)
- **Quote builder:** pages, features, timeline, deposit and price. Some features need a
  higher Development skill before you can offer them
- Clients accept, ask for a revision, counter-offer, or say no
- **Negotiate:** accept, meet in the middle, hold firm, or walk away
- Ignore a client for a day and they cool off. Keep ignoring them and they ghost you
- Signed deals pay the deposit right away and show up in **Projects**

## What's in part 3

- **Projects:** every signed deal becomes a project with a due date
- **Plan:** pick a layout, color palette, fonts and home page sections, with a
  **live preview** of the client's site. Text the client to ask what style they like
- **Build:** work 1 hr, 3 hrs or until 6 PM. Tasks fill in the preview as you go.
  Late-night work is sloppier
- Coding creates hidden **bugs**. Test the site to find them, then fix them
- **Polish** to raise the quality, and handle surprise events (blurry photos,
  tricky bugs, extra requests)
- **Review:** the client rates the site on design fit, quality, bugs and
  lateness. They approve it and pay the rest, or ask for changes (up to 2 rounds)
- Star ratings change your **reputation**, which makes future calls and quotes easier
- Building gives **Design** and **Development** XP, which unlocks better layouts,
  colors, fonts, online booking, listings and online stores
- Late projects make clients chase you, and they like you less

## What's in part 4

- **Team screen:** post jobs for sales callers, designers and developers
- Pick where to post: a **free job board** (few, weak applicants), a **paid job site**
  ($90/week, more and better people) or **your network** (needs 12 reputation,
  the best people)
- The pay you offer changes how many people apply and how good they are
- Applicants arrive overnight and take other jobs after a few days, so move fast
- **Interview** (1 hr) to learn a personality trait. **Test task** (30 min, $25) to see
  their real skill, because résumés can be exaggerated
- **Make an offer:** lowball them and they'll ask for more, or walk away.
  Great people don't want to work for an agency nobody's heard of
- Employees work on their own from 9 to 6 on weekdays:
  - **Sales callers** phone your business list and send you leads in Messages
  - **Designers** and **developers** work on the project you assign them
- Traits matter: reliable, fast learner, perfectionist, people person, lazy, sloppy
- **Morale** depends on pay. Unhappy people slow down and quit. Bonuses help
- **Payday is Friday.** Can't cover payroll and your team gets upset
- Employees slowly level up as they work
- While you work from your bedroom you can only have 2 remote employees

## Play on your phone (install it like an app)

Webio is a PWA (Progressive Web App), so it can be installed and played offline.

- **Android / Chrome / Edge:** open the game and tap **Install app** on the
  dashboard (or *Install* in the browser menu)
- **iPhone / iPad:** open it in Safari, tap **Share**, then **Add to Home Screen**

After the first visit the whole game is saved on the device, so it works without
internet. When a new version comes out, a small message asks you to reload.

On phones the layout changes: a bottom tab bar, lists that open into full pages
with a back button, and popups that slide up from the bottom.

## Running it on your computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install     # download the libraries (only needed once)
npm run dev     # start the game at http://localhost:5173
npm test        # run the automated tests
npm run build   # make the final website in the dist/ folder
```

## Putting it online (GitHub Pages)

The file `.github/workflows/deploy.yml` builds and publishes the game every time
code is pushed to `main`.

One-time setup: on GitHub, open the repo → **Settings** → **Pages** → under
**Source** pick **GitHub Actions**. After the next push to `main`, the game will be
live at `https://<your-username>.github.io/<repo-name>/`.

The build uses relative paths, so the `dist/` folder also works on Netlify,
Vercel, Cloudflare Pages or itch.io with no changes.

## How the code is organized

```
src/
  game/          The rules of the game. No UI code in here.
    types.ts       What a business, a skill and the save file look like
    balance.ts     All the difficulty numbers in one place (start money, costs…)
    businesses.ts  Generates random local businesses
    calls.ts       The cold call engine (who picks up, replies, outcomes)
    deals.ts       The texting engine (questions, quotes, haggling, ghosting)
    design.ts      Layouts, colors, fonts and sections for the website builder
    projects.ts    The building engine (tasks, bugs, events, client reviews)
    team.ts        Hiring, applicants, employee work, morale and pay
    store.ts       The game state and every action that changes it, plus saving
    time.ts        Clock and calendar helpers
  ui/            Everything you see
    components/    Buttons, popups, tabs, icons
    phone/         The Phone screen and the live call view
    messages/      The Messages screen, chat and quote builder
    projects/      The Projects screen, builder panels and live site preview
    team/          The Team screen, employee cards and hiring
    screens/       Dashboard, Skills, start screen, end-of-day summary
    motion.ts      Shared spring animation settings
    useIsMobile.ts Tells components when they're on a phone-sized screen
  pwa/           Install button, update message (the offline setup is in vite.config.ts)
```

Built with React, TypeScript, Vite, Zustand (game state), Motion (spring animations)
and vite-plugin-pwa (installable + offline).
