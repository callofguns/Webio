// The game store holds the whole game state and every action that changes it.
// It saves itself to the browser (localStorage), so progress survives reloads.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Business, DayStats, Deal, GameState, LogEntry, Project, Quote, SkillId } from './types';
import {
  DAILY_LIVING_COST,
  DIRECTORY_SEARCH_MINUTES,
  DIRECTORY_SEARCH_RESULTS,
  LEAD_LIST_COST,
  LEAD_LIST_SIZE,
  NOT_INTERESTED_COOLDOWN,
  RESEARCH_MINUTES,
  START_BUSINESSES,
  START_MONEY,
  VOICEMAIL_RETURN_CHANCE,
  WORKDAY_START,
  xpForLevel,
} from './balance';
import { generateBusinesses } from './businesses';
import { chooseOption, startCall, type CallContext, type CallState } from './calls';
import {
  createDeal,
  DAY_MINUTES,
  endOfDayDeal,
  QUOTE_MINUTES,
  sendQuote as sendQuoteToClient,
  sendText as sendTextToClient,
  toGameTime,
  type TextContext,
} from './deals';
import { chance, pick, uid } from './rng';
import { formatHour, isBusinessHours } from './time';

export const SAVE_VERSION = 2;
/** After this time you're too tired to keep working. */
export const DAY_HARD_END = 22 * 60;

function emptyStats(): DayStats {
  return { dials: 0, conversations: 0, leadsWon: 0, moneyIn: 0, moneyOut: 0 };
}

function newGameState(): GameState {
  return {
    version: SAVE_VERSION,
    day: 1,
    minute: WORKDAY_START,
    money: START_MONEY,
    reputation: 0,
    skills: {
      sales: { level: 1, xp: 0 },
      design: { level: 1, xp: 0 },
      development: { level: 1, xp: 0 },
    },
    businesses: generateBusinesses(START_BUSINESSES),
    deals: [],
    projects: [],
    log: [],
    today: emptyStats(),
    lifetime: emptyStats(),
    lastDaySummary: null,
  };
}

export interface Profile {
  playerName: string;
  agencyName: string;
}

interface Store extends GameState {
  profile: Profile | null;
  activeCall: CallState | null;
  /** Businesses you left a voicemail for today. */
  voicemailsToday: string[];

  newGame: (profile: Profile) => void;
  resetGame: () => void;
  research: (bizId: string) => void;
  searchDirectory: () => void;
  buyLeadList: () => void;
  beginCall: (bizId: string) => void;
  choose: (choiceId: string) => void;
  closeCall: () => void;
  sendText: (dealId: string, choiceId: string) => void;
  sendQuote: (dealId: string, quote: Quote) => void;
  markRead: (dealId: string) => void;
  /** Let time pass, e.g. while waiting for a reply. */
  wait: (minutes: number) => void;
  endDay: () => void;
  dismissSummary: () => void;
}

/** Why a business can't be called right now, or null if it can. */
export function callBlocker(biz: Business, day: number, minute: number): string | null {
  if (!isBusinessHours(day, minute)) return 'Businesses are closed';
  if (biz.status === 'do_not_call') return 'Asked you not to call';
  if (biz.status === 'interested') return 'You’re texting them';
  if (biz.status === 'client') return 'Already a client';
  if (biz.cooldownUntil !== null && day < biz.cooldownUntil) return `Said no — wait until day ${biz.cooldownUntil}`;
  const hasCallbackToday = biz.callback?.day === day;
  if (biz.lastCalledDay === day && !hasCallbackToday) return 'Already called today';
  return null;
}

export const useGame = create<Store>()(
  persist(
    (set, get) => {
      /** Adds a message to the activity log. */
      const log = (text: string, tone: LogEntry['tone'] = 'neutral') => {
        const s = get();
        const entry: LogEntry = { id: uid('log'), day: s.day, minute: s.minute, text, tone };
        set({ log: [entry, ...s.log].slice(0, 200) });
      };

      const addXp = (skill: SkillId, amount: number) => {
        const s = get();
        let { level, xp } = s.skills[skill];
        xp += amount;
        let leveled = false;
        while (xp >= xpForLevel(level)) {
          xp -= xpForLevel(level);
          level++;
          leveled = true;
        }
        set({ skills: { ...s.skills, [skill]: { level, xp } } });
        if (leveled) log(`Your ${skill} skill reached level ${level}!`, 'good');
      };

      const updateBiz = (id: string, patch: Partial<Business> | ((b: Business) => Partial<Business>)) => {
        set({
          businesses: get().businesses.map((b) => (b.id === id ? { ...b, ...(typeof patch === 'function' ? patch(b) : patch) } : b)),
        });
      };

      const now = () => toGameTime(get().day, get().minute);

      /** Applies deals whose final reply has now arrived: pays deposits, creates projects. */
      const settleDeals = () => {
        const t = now();
        const ready = get().deals.filter((d) => !d.settled && d.closedAt !== null && d.closedAt <= t);
        for (const deal of ready) {
          const biz = get().businesses.find((b) => b.id === deal.businessId)!;
          if (deal.stage === 'won' && deal.quote && deal.agreedPrice !== null) {
            const deposit = Math.round((deal.agreedPrice * deal.quote.depositPct) / 100);
            const project: Project = {
              id: uid('proj'),
              businessId: biz.id,
              dealId: deal.id,
              pages: deal.quote.pages,
              features: deal.quote.features,
              price: deal.agreedPrice,
              depositPaid: deposit,
              signedDay: get().day,
              dueDay: get().day + deal.quote.days,
              hasContent: deal.needs.hasContent,
              status: 'not_started',
            };
            const s = get();
            set({
              money: s.money + deposit,
              today: { ...s.today, moneyIn: s.today.moneyIn + deposit },
              projects: [...s.projects, project],
            });
            updateBiz(biz.id, { status: 'client' });
            addXp('sales', 25);
            log(
              `Contract signed with ${biz.name} for $${deal.agreedPrice.toLocaleString()}!${deposit ? ` $${deposit.toLocaleString()} deposit received.` : ''}`,
              'good',
            );
          } else {
            updateBiz(biz.id, { status: 'not_interested', cooldownUntil: get().day + 30 });
            log(`${biz.name} decided not to go ahead.`, 'bad');
          }
          set({ deals: get().deals.map((d) => (d.id === deal.id ? { ...d, settled: true } : d)) });
        }
      };

      const spendTime = (minutes: number) => {
        set({ minute: Math.min(get().minute + minutes, 24 * 60 - 1) });
        settleDeals();
      };

      const textContext = (): TextContext => {
        const s = get();
        return {
          now: now(),
          playerName: s.profile?.playerName ?? 'Alex',
          agencyName: s.profile?.agencyName ?? 'my agency',
          reputation: s.reputation,
          devLevel: s.skills.development.level,
        };
      };

      const updateDeal = (id: string, fn: (d: Deal, biz: Business) => Deal) => {
        const s = get();
        set({
          deals: s.deals.map((d) => (d.id === id ? fn(d, s.businesses.find((b) => b.id === d.businessId)!) : d)),
        });
      };

      const callContext = (): CallContext => {
        const s = get();
        return {
          day: s.day,
          minute: s.minute,
          playerName: s.profile?.playerName ?? 'Alex',
          agencyName: s.profile?.agencyName ?? 'my agency',
          salesLevel: s.skills.sales.level,
          reputation: s.reputation,
        };
      };

      /** Applies what happened on a finished call to the business, the clock and your stats. */
      const settleCall = (call: CallState) => {
        const s = get();
        const biz = s.businesses.find((b) => b.id === call.businessId);
        if (!biz) return;

        spendTime(call.minutes);
        addXp('sales', call.xp);
        set({
          today: {
            ...get().today,
            dials: get().today.dials + 1,
            conversations: get().today.conversations + (call.reachedOwner ? 1 : 0),
            leadsWon: get().today.leadsWon + (call.outcome === 'interested' ? 1 : 0),
          },
        });

        const base: Partial<Business> = {
          attempts: biz.attempts + 1,
          lastCalledDay: s.day,
          status: biz.status === 'new' ? 'contacted' : biz.status,
        };
        const when = (cb: { day: number; hour: number }) => `day ${cb.day} around ${formatHour(cb.hour)}`;

        switch (call.outcome) {
          case 'interested':
            updateBiz(biz.id, { ...base, status: 'interested', warmth: call.interest, callback: null });
            set({ deals: [...get().deals, createDeal(biz, call.interest, now())] });
            log(`${biz.name} is interested! Text them from Messages.`, 'good');
            break;
          case 'callback':
            updateBiz(biz.id, { ...base, status: 'callback', callback: call.callback });
            log(`${biz.name}: call back ${when(call.callback!)}.`);
            break;
          case 'not_interested':
            updateBiz(biz.id, {
              ...base,
              status: 'not_interested',
              callback: null,
              cooldownUntil: s.day + NOT_INTERESTED_COOLDOWN,
            });
            log(`${biz.name} said no.`, 'bad');
            break;
          case 'do_not_call':
            updateBiz(biz.id, { ...base, status: 'do_not_call', callback: null });
            log(`${biz.name} told you never to call again.`, 'bad');
            break;
          case 'voicemail_left':
            updateBiz(biz.id, base);
            set({ voicemailsToday: [...get().voicemailsToday, biz.id] });
            break;
          default:
            updateBiz(biz.id, base);
        }
      };

      return {
        ...newGameState(),
        profile: null,
        activeCall: null,
        voicemailsToday: [],

        newGame: (profile) => {
          set({ ...newGameState(), profile, activeCall: null, voicemailsToday: [] });
          log(`${profile.agencyName} is open for business. You have $${START_MONEY.toLocaleString()} saved up — make it last.`);
        },

        resetGame: () => set({ ...newGameState(), profile: null, activeCall: null, voicemailsToday: [] }),

        research: (bizId) => {
          const s = get();
          const biz = s.businesses.find((b) => b.id === bizId);
          if (!biz || biz.researched || s.minute + RESEARCH_MINUTES > DAY_HARD_END || s.activeCall) return;
          spendTime(RESEARCH_MINUTES);
          updateBiz(bizId, { researched: true });
          addXp('sales', 2);
        },

        searchDirectory: () => {
          const s = get();
          if (s.minute + DIRECTORY_SEARCH_MINUTES > DAY_HARD_END || s.activeCall) return;
          spendTime(DIRECTORY_SEARCH_MINUTES);
          const found = generateBusinesses(DIRECTORY_SEARCH_RESULTS);
          set({ businesses: [...get().businesses, ...found] });
          log(`Found ${found.length} new businesses in the local directory.`);
        },

        buyLeadList: () => {
          const s = get();
          if (s.money < LEAD_LIST_COST || s.activeCall) return;
          const found = generateBusinesses(LEAD_LIST_SIZE);
          set({
            money: s.money - LEAD_LIST_COST,
            businesses: [...s.businesses, ...found],
            today: { ...s.today, moneyOut: s.today.moneyOut + LEAD_LIST_COST },
          });
          log(`Bought a list of ${found.length} local businesses for $${LEAD_LIST_COST}.`);
        },

        beginCall: (bizId) => {
          const s = get();
          const biz = s.businesses.find((b) => b.id === bizId);
          if (!biz || s.activeCall || callBlocker(biz, s.day, s.minute)) return;
          const call = startCall(biz, callContext());
          set({ activeCall: call });
          if (call.phase === 'ended') settleCall(call);
        },

        choose: (choiceId) => {
          const s = get();
          const call = s.activeCall;
          if (!call || call.phase === 'ended') return;
          const biz = s.businesses.find((b) => b.id === call.businessId);
          if (!biz) return;
          const next = chooseOption(call, biz, choiceId, callContext());
          set({ activeCall: next });
          if (next.phase === 'ended') settleCall(next);
        },

        closeCall: () => {
          const call = get().activeCall;
          if (call && call.phase !== 'ended') return; // can't walk away mid-call
          set({ activeCall: null });
        },

        sendText: (dealId, choiceId) => {
          const s = get();
          if (s.activeCall && s.activeCall.phase !== 'ended') return;
          if (s.minute + 3 > DAY_HARD_END) return;
          const before = s.deals.find((d) => d.id === dealId);
          updateDeal(dealId, (d, biz) => sendTextToClient(d, biz, choiceId, textContext()));
          if (get().deals.find((d) => d.id === dealId) !== before) spendTime(3);
        },

        sendQuote: (dealId, quote) => {
          const s = get();
          if (s.activeCall && s.activeCall.phase !== 'ended') return;
          if (s.minute + QUOTE_MINUTES > DAY_HARD_END) return;
          const before = s.deals.find((d) => d.id === dealId);
          updateDeal(dealId, (d, biz) => sendQuoteToClient(d, biz, quote, textContext()));
          if (get().deals.find((d) => d.id === dealId) !== before) spendTime(QUOTE_MINUTES);
        },

        markRead: (dealId) => {
          const t = now();
          const deal = get().deals.find((d) => d.id === dealId);
          if (!deal || deal.readAt >= t) return;
          set({ deals: get().deals.map((d) => (d.id === dealId ? { ...d, readAt: t } : d)) });
        },

        wait: (minutes) => {
          const s = get();
          if (s.activeCall && s.activeCall.phase !== 'ended') return;
          if (s.minute >= DAY_HARD_END) return;
          spendTime(Math.min(minutes, DAY_HARD_END - s.minute));
        },

        endDay: () => {
          const s = get();
          if (s.activeCall && s.activeCall.phase !== 'ended') return;
          const expenses = DAILY_LIVING_COST;
          const nextDay = s.day + 1;
          const summary = { ...s.today, moneyOut: s.today.moneyOut + expenses, day: s.day, expenses };

          // Some voicemails get returned overnight.
          let businesses = s.businesses;
          const returned: string[] = [];
          for (const id of s.voicemailsToday) {
            if (chance(VOICEMAIL_RETURN_CHANCE)) {
              const hour = pick([9, 10, 11, 14, 15]);
              businesses = businesses.map((b) =>
                b.id === id && b.status !== 'interested'
                  ? { ...b, status: 'callback', callback: { day: nextDay, hour } }
                  : b,
              );
              returned.push(id);
            }
          }
          // Clients you left waiting cool off.
          const dayEnd = toGameTime(s.day, DAY_MINUTES - 1);
          const nextStart = toGameTime(nextDay, WORKDAY_START);
          const deals = s.deals.map((d) => endOfDayDeal(d, businesses.find((b) => b.id === d.businessId)!, dayEnd, nextStart));

          // Businesses whose "no" has cooled off can be called again.
          businesses = businesses.map((b) =>
            b.status === 'not_interested' && b.cooldownUntil !== null && nextDay >= b.cooldownUntil
              ? { ...b, status: 'contacted', cooldownUntil: null }
              : b,
          );

          set({
            day: nextDay,
            minute: WORKDAY_START,
            money: s.money - expenses,
            businesses,
            deals,
            activeCall: null,
            voicemailsToday: [],
            lifetime: {
              dials: s.lifetime.dials + s.today.dials,
              conversations: s.lifetime.conversations + s.today.conversations,
              leadsWon: s.lifetime.leadsWon + s.today.leadsWon,
              moneyIn: s.lifetime.moneyIn + s.today.moneyIn,
              moneyOut: s.lifetime.moneyOut + s.today.moneyOut + expenses,
            },
            today: emptyStats(),
            lastDaySummary: summary,
          });
          log(`Paid $${expenses} in living costs.`, 'bad');
          settleDeals();
          for (const id of returned) {
            const b = get().businesses.find((x) => x.id === id)!;
            log(`${b.name} returned your voicemail! Call back today around ${formatHour(b.callback!.hour)}.`, 'good');
          }
        },

        dismissSummary: () => set({ lastDaySummary: null }),
      };
    },
    {
      name: 'webio-save',
      version: SAVE_VERSION,
      migrate: (saved, version) => {
        const state = saved as Store;
        if (version < 2) {
          // Part 2 added texting. Turn anyone who was "interested" into a deal.
          const t = toGameTime(state.day, state.minute);
          state.deals = state.businesses.filter((b) => b.status === 'interested').map((b) => createDeal(b, b.warmth, t));
          state.projects = [];
        }
        return state;
      },
      // The active call is saved too, so reloading the page can't be used
      // to escape a call that's going badly.
    },
  ),
);
