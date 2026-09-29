# Webio

A 2D management game where you run your own web design agency. Start alone in your
bedroom with $1,800, cold call local businesses, win clients, build their websites,
and grow into a real agency with a team and an office.

It's meant to feel close to real life: most calls go nowhere, money runs out fast,
and growing is hard.

## The main loop

1. **Cold call** local businesses from the Phone screen *(done — part 1)*
2. **Text** the interested ones, work out what they need, and agree on a price *(part 2)*
3. **Build** their website by choosing layouts, features and content *(part 3)*
4. Get paid, grow your reputation, and repeat

Later on: **hire** employees to automate the work *(part 4)*, **upgrade your office**
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
    store.ts       The game state and every action that changes it, plus saving
    time.ts        Clock and calendar helpers
  ui/            Everything you see
    components/    Buttons, popups, tabs, icons
    phone/         The Phone screen and the live call view
    screens/       Dashboard, Skills, start screen, end-of-day summary
    motion.ts      Shared spring animation settings
```

Built with React, TypeScript, Vite, Zustand (game state) and Motion (spring animations).
