// The game store holds the whole game state and every action that changes it.
// It saves itself to the browser (localStorage), so progress survives reloads.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { buyBlocker, FURNITURE, moveBlocker, OFFICES, officeEffects, type FurnitureId, type OfficeId } from './office';
import { CLAUDE_PLANS, claudeEffects, planBlocker, type ClaudePlan } from './claude';
import type { Business, DayStats, Deal, Employee, GameState, JobBoard, LogEntry, Project, Quote, Role, SkillId, TeamDay, TextMessage } from './types';
import {
  DAILY_LIVING_COST,
  DAY_HARD_END,
  TEST_TASK_COST,
  WORKDAY_END,
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
import { chooseOption, startCall, timeoutCall, type CallContext, type CallState } from './calls';
import {
  createDeal,
  dealStatus,
  DAY_MINUTES,
  endOfDayDeal,
  QUOTE_MINUTES,
  replyTime,
  sendQuote as sendQuoteToClient,
  sendText as sendTextToClient,
  textMessage,
  toGameTime,
  type TextContext,
} from './deals';
import {
  allTasksDone,
  applyRevision,
  builderFields,
  changeDesign,
  createProject,
  evaluateSite,
  fixBugs,
  MAX_POLISH,
  polishSite,
  REPUTATION_FOR_STARS,
  resolveEvent,
  reviewReply,
  testSite,
  work,
} from './projects';
import { FONTS, LAYOUTS, PALETTES, TASTE_HINTS, type Design } from './design';
import {
  addEmployeeXp,
  BOARDS,
  BONUS_AMOUNT,
  bugMult,
  dailyApplicants,
  endOfDayMorale,
  hire,
  interview,
  INTERVIEW_MINUTES,
  offerResult,
  POST_DAYS,
  productivity,
  qualityBonus,
  ROLES,
  salesHour,
  TEST_MINUTES,
  testTask,
  workMinutesBetween,
  type OfferResult,
} from './team';
import { chance, pick, randInt, uid } from './rng';
import { formatHour, isBusinessHours } from './time';

export const SAVE_VERSION = 6;
export { DAY_HARD_END };

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
    employees: [],
    jobPosts: [],
    applicants: [],
    payrollDue: 0,
    office: 'bedroom',
    furniture: [],
    claude: 'none',
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
  /** The answer timer ran out on a call. */
  callTimedOut: () => void;
  closeCall: () => void;
  sendText: (dealId: string, choiceId: string) => void;
  sendQuote: (dealId: string, quote: Quote) => void;
  markRead: (dealId: string) => void;
  /** Removes conversations that were lost. Anything else is left alone. */
  deleteLostDeals: (dealIds: string[]) => void;
  /** Let time pass, e.g. while waiting for a reply. */
  wait: (minutes: number) => void;
  // Projects (part 3)
  startProject: (projectId: string) => void;
  setDesign: (projectId: string, design: Design) => void;
  askStyle: (projectId: string) => void;
  workOnProject: (projectId: string, hours: number) => void;
  testProject: (projectId: string) => void;
  fixProjectBugs: (projectId: string) => void;
  polishProject: (projectId: string) => void;
  resolveProjectEvent: (projectId: string, choiceId: string) => void;
  submitProject: (projectId: string) => void;
  // Team (part 4)
  postJob: (role: Role, board: JobBoard, pay: number) => void;
  closeJobPost: (postId: string) => void;
  interviewApplicant: (applicantId: string) => void;
  testApplicant: (applicantId: string) => void;
  makeOffer: (applicantId: string, pay: number) => OfferResult | null;
  rejectApplicant: (applicantId: string) => void;
  assignEmployee: (employeeId: string, projectId: string | null) => void;
  giveBonus: (employeeId: string) => void;
  fireEmployee: (employeeId: string) => void;
  // Office (part 5)
  moveOffice: (to: OfficeId) => void;
  /** Subscribe to, switch, or cancel your Claude plan. */
  setClaudePlan: (plan: ClaudePlan) => void;
  buyFurniture: (item: FurnitureId) => void;
  endDay: () => void;
  dismissSummary: () => void;
}

/** Why a business can't be called right now, or null if it can. */
export function callBlocker(biz: Business, day: number, minute: number): string | null {
  if (!isBusinessHours(day, minute)) return 'Businesses are closed';
  if (biz.status === 'do_not_call') return 'Asked you not to call';
  if (biz.status === 'interested') return 'You’re texting them';
  if (biz.status === 'client') return 'Already a client';
  if (biz.cooldownUntil !== null && day < biz.cooldownUntil) return `Said no. Wait until day ${biz.cooldownUntil}`;
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
            const project = createProject(deal, biz, get().day);
            const deposit = project.depositPaid;
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

      const updateProject = (id: string, fn: (p: Project) => Project) => {
        set({ projects: get().projects.map((p) => (p.id === id ? fn(p) : p)) });
      };

      /** Adds texts to the conversation with a client. */
      const postToThread = (dealId: string, ...messages: TextMessage[]) => {
        set({ deals: get().deals.map((d) => (d.id === dealId ? { ...d, messages: [...d.messages, ...messages] } : d)) });
      };

      /** Applies client reviews that have arrived: final payment and stars, or a revision. */
      const settleProjects = () => {
        const t = now();
        for (const p of get().projects) {
          if (p.status !== 'review' || !p.review || p.review.at > t) continue;
          const biz = get().businesses.find((b) => b.id === p.businessId)!;
          if (p.review.approved) {
            const owed = p.price - p.depositPaid;
            const s = get();
            set({
              money: s.money + owed,
              reputation: Math.max(0, s.reputation + REPUTATION_FOR_STARS[p.review.stars]),
              today: { ...s.today, moneyIn: s.today.moneyIn + owed },
            });
            updateProject(p.id, (x) => ({ ...x, status: 'delivered', stars: x.review!.stars, deliveredDay: get().day }));
            set({ employees: get().employees.map((e) => (e.assignedProjectId === p.id ? { ...e, assignedProjectId: null } : e)) });
            log(`${biz.name} approved their site (${'\u2605'.repeat(p.review.stars)}) and paid $${owed.toLocaleString()}.`, p.review.stars >= 3 ? 'good' : 'bad');
          } else {
            updateProject(p.id, applyRevision);
            log(`${biz.name} asked for changes to their site.`, 'bad');
          }
        }
      };

      /** Your employees work in the background while the clock moves through work hours. */
      const runTeam = (from: number, to: number) => {
        const s = get();
        const minutes = workMinutesBetween(s.day, from, to);
        if (!minutes || !s.employees.length) return;
        const at = toGameTime(s.day, Math.min(to, WORKDAY_END));
        const fx = officeEffects(s.office, s.furniture);
        let businesses = s.businesses;
        let projects = s.projects;
        const newDeals: Deal[] = [];
        const messages: [string, LogEntry['tone']][] = [];

        const employees = s.employees.map((original) => {
          let e: Employee = { ...original, today: { ...original.today }, carryMinutes: original.carryMinutes + minutes };
          const gainXp = (amount: number) => {
            const r = addEmployeeXp(e, amount);
            e = { ...r.employee, today: e.today, carryMinutes: e.carryMinutes };
            if (r.leveled) messages.push([`${e.name} got better at their job (level ${e.level}).`, 'good']);
          };
          while (e.carryMinutes >= 60) {
            e.carryMinutes -= 60;
            if (e.role === 'sales') {
              const r = salesHour(e, businesses, s.day, s.reputation, Math.random, fx.dialMult * fx.teamSpeed);
              businesses = r.businesses;
              e.today.dials += r.dials;
              e.today.note = 'Calling businesses';
              if (r.dials === 0) {
                // Nobody left to call, so they look for more businesses.
                businesses = [...businesses, ...generateBusinesses(2)];
                e.today.note = 'Ran out of businesses to call, so searched the directory';
              }
              for (const lead of r.leads) {
                newDeals.push(createDeal(lead.biz, lead.warmth + fx.leadWarmth, at, Math.random, e.name.split(' ')[0]));
                e.today.leads++;
                messages.push([`${e.name} got ${lead.biz.name} interested! Text them in Messages.`, 'good']);
              }
              gainXp(5);
            } else {
              const project = projects.find((p) => p.id === e.assignedProjectId);
              if (!project) {
                e.today.note = 'Nothing to do. Assign them a project.';
                continue;
              }
              if (project.status !== 'in_progress') {
                e.today.note = project.status === 'not_started' ? 'Waiting for you to plan and start the project' : 'Waiting while the client reviews it';
                continue;
              }
              const res = work(project, 1, {
                minute: 12 * 60,
                designLevel: e.level,
                devLevel: e.level,
                only: e.role === 'designer' ? 'design' : 'development',
                events: false,
                speedMult: productivity(e, s.day) * fx.teamSpeed * (e.role === 'designer' ? fx.designSpeed : 1),
                qualityBonus: qualityBonus(e),
                bugMult: bugMult(e),
              });
              const biz = businesses.find((b) => b.id === project.businessId);
              if (res.minutes === 0) {
                e.today.note = `No ${e.role === 'designer' ? 'design' : 'coding'} work left on ${biz?.name ?? 'this project'}`;
                continue;
              }
              projects = projects.map((p) => (p.id === project.id ? res.project : p));
              e.today.hours += 1;
              e.today.note = `Working on ${biz?.name ?? 'a project'}`;
              gainXp(10);
            }
          }
          return e;
        });

        set({ employees, businesses, projects, deals: [...get().deals, ...newDeals] });
        for (const [text, tone] of messages) log(text, tone);
      };

      const spendTime = (minutes: number) => {
        const from = get().minute;
        const to = Math.min(from + minutes, 24 * 60 - 1);
        runTeam(from, to);
        set({ minute: to });
        settleDeals();
        settleProjects();
      };

      /** End of day for the team: morale, quitting, wages, and job applicants. */
      const closeTeamDay = (): { payroll: number; team: TeamDay | null } => {
        const s = get();
        const nextDay = s.day + 1;
        const workday = (s.day - 1) % 7 < 5;
        const team: TeamDay = {
          dials: s.employees.reduce((n, e) => n + e.today.dials, 0),
          leads: s.employees.reduce((n, e) => n + e.today.leads, 0),
          buildHours: s.employees.reduce((n, e) => n + e.today.hours, 0),
        };
        const hadTeam = s.employees.length > 0;
        let payrollDue = s.payrollDue;
        let employees = s.employees;
        const quitters: Employee[] = [];
        if (workday) {
          payrollDue += employees.reduce((n, e) => n + e.pay, 0);
          employees = employees.flatMap((e) => {
            const r = endOfDayMorale(e, Math.random, officeEffects(s.office, s.furniture).morale);
            if (r.quit) {
              quitters.push(e);
              return [];
            }
            return [r.employee];
          });
        }
        // Payday is Friday.
        let payroll = 0;
        if ((s.day - 1) % 7 === 4 && payrollDue > 0) {
          payroll = payrollDue;
          payrollDue = 0;
          if (s.money - payroll - DAILY_LIVING_COST - OFFICES[s.office].rent - CLAUDE_PLANS[s.claude].price < 0) {
            // Nobody likes a bounced paycheck.
            employees = employees.map((e) => ({ ...e, morale: Math.max(0, e.morale - 25) }));
          }
        }
        employees = employees.map((e) => ({ ...e, carryMinutes: 0, today: { dials: 0, leads: 0, hours: 0, note: '' } }));

        const jobPosts = s.jobPosts.filter((p) => p.endsDay >= nextDay);
        const expiredPosts = s.jobPosts.length - jobPosts.length;
        const staying = s.applicants.filter((a) => a.leavesDay >= nextDay);
        const gone = s.applicants.length - staying.length;
        const fresh = jobPosts.flatMap((p) => dailyApplicants(p, nextDay));

        set({ employees, payrollDue, jobPosts, applicants: [...staying, ...fresh] });
        for (const q of quitters) log(`${q.name} quit. They weren\u2019t happy here.`, 'bad');
        if (payroll) log(`Payday: paid your team $${payroll.toLocaleString()}.`, 'bad');
        if (payroll && s.money - payroll - DAILY_LIVING_COST - OFFICES[s.office].rent - CLAUDE_PLANS[s.claude].price < 0) log('You couldn\u2019t cover payroll. Your team is upset.', 'bad');
        if (expiredPosts) log(`${expiredPosts} job post${expiredPosts > 1 ? 's' : ''} ended.`);
        if (gone) log(`${gone} applicant${gone > 1 ? 's' : ''} took another job.`, 'bad');
        if (fresh.length) log(`${fresh.length} new job applicant${fresh.length > 1 ? 's' : ''}. Check the Team screen.`, 'good');
        return { payroll, team: hadTeam ? team : null };
      };

      /** True when you can't do anything else (on a call, or too late). */
      const busy = (minutesNeeded: number) => {
        const s = get();
        return (!!s.activeCall && s.activeCall.phase !== 'ended') || s.minute + minutesNeeded > DAY_HARD_END;
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
          presence: officeEffects(s.office, s.furniture).presence,
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
            set({ deals: [...get().deals, createDeal(biz, call.interest + officeEffects(s.office, s.furniture).leadWarmth, now())] });
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
          log(`${profile.agencyName} is open for business. You have $${START_MONEY.toLocaleString()} saved up. Make it last.`);
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

        callTimedOut: () => {
          const s = get();
          const call = s.activeCall;
          if (!call || call.phase === 'ended') return;
          const biz = s.businesses.find((b) => b.id === call.businessId);
          if (!biz) return;
          const next = timeoutCall(call, biz);
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

        deleteLostDeals: (dealIds) => {
          settleDeals();
          const t = now();
          const gone = new Set(
            get()
              .deals.filter((d) => dealIds.includes(d.id) && d.stage === 'lost' && dealStatus(d, t) === 'lost')
              .map((d) => d.id),
          );
          if (!gone.size) return;
          set({ deals: get().deals.filter((d) => !gone.has(d.id)) });
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

        startProject: (projectId) => {
          updateProject(projectId, (p) => (p.status === 'not_started' ? { ...p, status: 'in_progress' } : p));
        },

        setDesign: (projectId, design) => {
          const { skills } = get();
          const d = skills.design.level;
          if (LAYOUTS[design.layout].level > d || PALETTES[design.palette].level > d || FONTS[design.font].level > d) return;
          updateProject(projectId, (p) => changeDesign(p, design));
        },

        askStyle: (projectId) => {
          const p = get().projects.find((x) => x.id === projectId);
          if (!p || p.tasteAt !== null || busy(3)) return;
          const biz = get().businesses.find((b) => b.id === p.businessId)!;
          const t = now();
          const at = replyTime(t, biz.temperament, Math.random);
          postToThread(
            p.dealId,
            textMessage('you', 'Quick question for the design: what kind of style do you like? Any websites you love?', t),
            textMessage('them', TASTE_HINTS[p.taste], at),
          );
          updateProject(projectId, (x) => ({ ...x, tasteAt: at }));
          spendTime(3);
        },

        workOnProject: (projectId, hours) => {
          const s = get();
          const p = s.projects.find((x) => x.id === projectId);
          if (!p || busy(60)) return;
          const fx = officeEffects(s.office, s.furniture);
          const res = work(p, hours, {
            minute: s.minute,
            designLevel: s.skills.design.level,
            devLevel: s.skills.development.level,
            speedMult: fx.playerSpeed * claudeEffects(s.claude).build,
            latePenalty: fx.latePenalty,
          });
          if (res.minutes === 0) return;
          updateProject(projectId, () => res.project);
          if (res.xp.design) addXp('design', res.xp.design);
          if (res.xp.development) addXp('development', res.xp.development);
          spendTime(res.minutes);
        },

        testProject: (projectId) => {
          const p = get().projects.find((x) => x.id === projectId);
          const minutes = claudeEffects(get().claude).testMinutes;
          if (!p || p.status !== 'in_progress' || busy(minutes)) return;
          const res = testSite(p, get().skills.development.level);
          updateProject(projectId, () => res.project);
          addXp('development', 5);
          spendTime(minutes);
          const biz = get().businesses.find((b) => b.id === p.businessId)!;
          log(res.found ? `Testing ${biz.name}\u2019s site found ${res.found} bug${res.found > 1 ? 's' : ''}.` : `Testing ${biz.name}\u2019s site found no bugs.`);
        },

        fixProjectBugs: (projectId) => {
          const s = get();
          const p = s.projects.find((x) => x.id === projectId);
          if (!p || p.status !== 'in_progress' || busy(30)) return;
          const res = fixBugs(p, DAY_HARD_END - s.minute);
          updateProject(projectId, () => res.project);
          addXp('development', res.minutes / 6);
          spendTime(res.minutes);
        },

        polishProject: (projectId) => {
          const p = get().projects.find((x) => x.id === projectId);
          if (!p || p.status !== 'in_progress' || !allTasksDone(p) || p.polish >= MAX_POLISH || busy(60)) return;
          updateProject(projectId, polishSite);
          addXp('design', 8);
          spendTime(60);
        },

        resolveProjectEvent: (projectId, choiceId) => {
          const p = get().projects.find((x) => x.id === projectId);
          if (!p || !p.pendingEvent) return;
          const res = resolveEvent(p, choiceId);
          updateProject(projectId, () => res.project);
          if (res.money) {
            const s = get();
            set({ money: s.money + res.money, today: { ...s.today, moneyOut: s.today.moneyOut - Math.min(0, res.money) } });
          }
          if (res.xp.design) addXp('design', res.xp.design);
          if (res.xp.development) addXp('development', res.xp.development);
          if (res.note) log(res.note);
          if (res.minutes) spendTime(Math.min(res.minutes, Math.max(0, DAY_HARD_END - get().minute)));
        },

        submitProject: (projectId) => {
          const s = get();
          const p = s.projects.find((x) => x.id === projectId);
          if (!p || p.status !== 'in_progress' || !allTasksDone(p) || p.pendingEvent || busy(10)) return;
          const biz = s.businesses.find((b) => b.id === p.businessId)!;
          const t = now();
          const review = { ...evaluateSite(p, biz, s.day), at: replyTime(t, biz.temperament, Math.random, 60, 240, 0) };
          const first = biz.ownerName.split(' ')[0];
          postToThread(
            p.dealId,
            textMessage('you', `Hi ${first}! Your new website is ready. Have a look and let me know what you think \ud83d\ude42`, t),
            textMessage('them', reviewReply(review, p, biz, TASTE_HINTS[p.taste]), review.at),
          );
          updateProject(projectId, (x) => ({ ...x, status: 'review', review }));
          spendTime(10);
        },

        postJob: (role, board, pay) => {
          const s = get();
          const info = BOARDS[board];
          if (s.reputation < info.reputation || s.money < info.cost) return;
          if (s.jobPosts.some((p) => p.role === role && p.board === board)) return;
          set({
            money: s.money - info.cost,
            today: { ...s.today, moneyOut: s.today.moneyOut + info.cost },
            jobPosts: [...s.jobPosts, { id: uid('post'), role, board, pay, postedDay: s.day, endsDay: s.day + POST_DAYS }],
          });
          log(`Posted a ${ROLES[role].label.toLowerCase()} job on the ${info.label.toLowerCase()}. Applicants will come in over the next few days.`);
        },

        closeJobPost: (postId) => set({ jobPosts: get().jobPosts.filter((p) => p.id !== postId) }),

        interviewApplicant: (applicantId) => {
          const a = get().applicants.find((x) => x.id === applicantId);
          if (!a || a.interviewed || busy(INTERVIEW_MINUTES)) return;
          set({ applicants: get().applicants.map((x) => (x.id === applicantId ? interview(x) : x)) });
          spendTime(INTERVIEW_MINUTES);
        },

        testApplicant: (applicantId) => {
          const s = get();
          const a = s.applicants.find((x) => x.id === applicantId);
          if (!a || a.tested || s.money < TEST_TASK_COST || busy(TEST_MINUTES)) return;
          set({
            money: s.money - TEST_TASK_COST,
            today: { ...s.today, moneyOut: s.today.moneyOut + TEST_TASK_COST },
            applicants: s.applicants.map((x) => (x.id === applicantId ? testTask(x) : x)),
          });
          spendTime(TEST_MINUTES);
        },

        makeOffer: (applicantId, pay) => {
          const s = get();
          const a = s.applicants.find((x) => x.id === applicantId);
          const fx = officeEffects(s.office, s.furniture);
          if (!a || s.employees.length >= fx.capacity) return null;
          // A nicer office helps convince great people to join.
          const result = offerResult(a, pay, s.reputation + fx.prestige);
          if (result.kind === 'accept') {
            set({ employees: [...s.employees, hire(a, pay, s.day)], applicants: s.applicants.filter((x) => x.id !== applicantId) });
            log(`${a.name} joined your team as a ${ROLES[a.role].label.toLowerCase()}!`, 'good');
          } else if (result.kind === 'counter') {
            set({ applicants: s.applicants.map((x) => (x.id === applicantId ? { ...x, counter: result.pay } : x)) });
          } else {
            set({ applicants: s.applicants.filter((x) => x.id !== applicantId) });
            log(`${a.name} turned down your offer.`, 'bad');
          }
          return result;
        },

        rejectApplicant: (applicantId) => set({ applicants: get().applicants.filter((x) => x.id !== applicantId) }),

        assignEmployee: (employeeId, projectId) => {
          set({ employees: get().employees.map((e) => (e.id === employeeId ? { ...e, assignedProjectId: projectId } : e)) });
        },

        giveBonus: (employeeId) => {
          const s = get();
          if (s.money < BONUS_AMOUNT) return;
          set({
            money: s.money - BONUS_AMOUNT,
            today: { ...s.today, moneyOut: s.today.moneyOut + BONUS_AMOUNT },
            employees: s.employees.map((e) => (e.id === employeeId ? { ...e, morale: Math.min(100, e.morale + 15), lowMoraleDays: 0 } : e)),
          });
        },

        moveOffice: (to) => {
          const s = get();
          if (s.activeCall && s.activeCall.phase !== 'ended') return;
          if (moveBlocker(to, s.office, s.money, s.reputation, s.employees.length)) return;
          const cost = OFFICES[to].moveIn;
          set({ office: to, money: s.money - cost, today: { ...s.today, moneyOut: s.today.moneyOut + cost } });
          log(`Moved into ${OFFICES[to].name.toLowerCase()}. Rent is $${OFFICES[to].rent}/day.`, 'good');
        },

        setClaudePlan: (plan) => {
          const s = get();
          if (s.activeCall && s.activeCall.phase !== 'ended') return;
          if (planBlocker(plan, s.claude, s.money)) return;
          set({ claude: plan });
          if (plan === 'none') log(`Cancelled ${CLAUDE_PLANS[s.claude].name}. You\u2019re building on your own again.`);
          else log(`Subscribed to ${CLAUDE_PLANS[plan].name}. $${CLAUDE_PLANS[plan].price}/day, charged each evening.`, 'good');
        },

        buyFurniture: (item) => {
          const s = get();
          if (buyBlocker(item, s.office, s.furniture, s.money)) return;
          const cost = FURNITURE[item].price;
          set({ furniture: [...s.furniture, item], money: s.money - cost, today: { ...s.today, moneyOut: s.today.moneyOut + cost } });
          log(`Bought ${FURNITURE[item].name.toLowerCase()}.`);
        },

        fireEmployee: (employeeId) => {
          const e = get().employees.find((x) => x.id === employeeId);
          if (!e) return;
          // Everyone else gets a little nervous.
          set({
            employees: get()
              .employees.filter((x) => x.id !== employeeId)
              .map((x) => ({ ...x, morale: Math.max(0, x.morale - 5) })),
          });
          log(`You let ${e.name} go.`, 'bad');
        },

        endDay: () => {
          if (get().activeCall && get().activeCall!.phase !== 'ended') return;
          // Your team finishes their workday, even if you stop early.
          runTeam(get().minute, WORKDAY_END);
          const teamDay = closeTeamDay();
          const s = get();
          const rent = OFFICES[s.office].rent;
          const claude = CLAUDE_PLANS[s.claude].price;
          const expenses = DAILY_LIVING_COST + rent + claude + teamDay.payroll;
          const nextDay = s.day + 1;
          const summary = { ...s.today, moneyOut: s.today.moneyOut + expenses, day: s.day, expenses, payroll: teamDay.payroll, rent, claude, team: teamDay.team };

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
          let deals = s.deals.map((d) => endOfDayDeal(d, businesses.find((b) => b.id === d.businessId)!, dayEnd, nextStart));

          // Clients chase you when their site is late.
          const projects = s.projects.map((p) => {
            const late = (p.status === 'not_started' || p.status === 'in_progress') && nextDay > p.dueDay;
            if (!late || (p.lastNudgeDay !== null && nextDay - p.lastNudgeDay < 2)) return p;
            const nudge = textMessage('them', 'Hey, how\u2019s the website coming along? It was supposed to be ready by now.', nextStart + randInt(30, 180));
            deals = deals.map((d) => (d.id === p.dealId ? { ...d, messages: [...d.messages, nudge] } : d));
            return { ...p, goodwill: p.goodwill - 3, lastNudgeDay: nextDay };
          });

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
            projects,
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
          log(rent ? `Paid $${DAILY_LIVING_COST} in living costs and $${rent} rent.` : `Paid $${DAILY_LIVING_COST} in living costs.`, 'bad');
          settleDeals();
          settleProjects();
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
        if (version < 3) {
          // Part 3 added the website builder. Give old projects the new fields.
          state.projects = state.projects.map((p) => {
            const biz = state.businesses.find((b) => b.id === p.businessId)!;
            return { ...builderFields(p.pages, p.features, biz), ...p };
          });
        }
        if (version < 4) {
          // Part 4 added hiring.
          state.employees = [];
          state.jobPosts = [];
          state.applicants = [];
          state.payrollDue = 0;
        }
        if (version < 5) {
          // Part 5 added offices. Everyone starts in their bedroom.
          state.office = 'bedroom';
          state.furniture = [];
        }
        if (version < 6) {
          // The Claude subscription is new. Nobody has one yet.
          state.claude = 'none';
        }
        return state;
      },
      // The active call is saved too, so reloading the page can't be used
      // to escape a call that's going badly.
    },
  ),
);
