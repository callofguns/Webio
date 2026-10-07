// Courses: pay money and spend time to learn faster than you would by just working.
//
// You can take a course yourself (it uses up part of your day) or send someone
// on your team (they stop working while they're away, then come back better).
// There are three courses for each skill. Each suits a range of levels, so you
// can't skip ahead and you can't farm the beginner ones forever.

import type { Role, SkillId } from './types';
import { MAX_LEVEL } from './team';

export type CourseId = 'workshop' | 'course' | 'masterclass';

export interface Course {
  id: CourseId;
  /** Hours it takes. A workday is 9 hours. */
  hours: number;
  cost: number;
  /** Experience you get. */
  xp: number;
  /** Lowest and highest level it's useful for. */
  minLevel: number;
  maxLevel: number;
}

// Sizes were picked against how fast you level up normally. Levels need
// 100, 283, 520, 800 and 1,118 XP, and a day of building earns about 80, so:
//   workshop    gets you from level 1 to 2 in a day and a half
//   course      is a level at level 3 for about $450
//   masterclass is the only way to get through the high levels quickly, at a price
export const COURSES: Record<CourseId, Course> = {
  workshop: { id: 'workshop', hours: 2, cost: 75, xp: 70, minLevel: 1, maxLevel: 2 },
  course: { id: 'course', hours: 4, cost: 200, xp: 220, minLevel: 2, maxLevel: 4 },
  masterclass: { id: 'masterclass', hours: 8, cost: 600, xp: 700, minLevel: 4, maxLevel: 99 },
};

export const COURSE_ORDER: CourseId[] = ['workshop', 'course', 'masterclass'];

/** What each course is called for each skill. */
export const COURSE_NAMES: Record<SkillId, Record<CourseId, { name: string; blurb: string }>> = {
  sales: {
    workshop: { name: 'Cold-calling workshop', blurb: 'The basics: openers, listening, and not panicking.' },
    course: { name: 'Sales psychology course', blurb: 'Handling objections and reading people.' },
    masterclass: { name: 'Closing masterclass', blurb: 'Taught by someone who sells for a living.' },
  },
  design: {
    workshop: { name: 'Design basics workshop', blurb: 'Layout, color and type without the guesswork.' },
    course: { name: 'UI and layout course', blurb: 'How to design pages people actually use.' },
    masterclass: { name: 'Brand design masterclass', blurb: 'Look-and-feel that clients pay more for.' },
  },
  development: {
    workshop: { name: 'Web basics workshop', blurb: 'HTML, CSS and a few shortcuts.' },
    course: { name: 'Full-stack course', blurb: 'Forms, booking, payments and databases.' },
    masterclass: { name: 'Performance and architecture masterclass', blurb: 'Faster, cleaner, fewer bugs.' },
  },
};

/** Employees need twice the experience to level up, so a course teaches them twice as much. */
export const EMPLOYEE_XP_MULT = 2;
/** Employees like being invested in. */
export const TRAINING_MORALE = 5;

/** The skill a role learns. */
export function skillOfRole(role: Role): SkillId {
  return role === 'designer' ? 'design' : role === 'developer' ? 'development' : 'sales';
}

/** Why a course can't be taken at this level, or null if it can. */
export function levelBlocker(course: Course, level: number, top: number = Infinity): string | null {
  if (level >= top) return 'Already at the top level';
  if (level < course.minLevel) return `Needs level ${course.minLevel}`;
  if (level > course.maxLevel) return 'Too basic for you now';
  return null;
}

/** Why you can't take a course yourself right now, or null if you can. */
export function playerCourseBlocker(
  course: Course,
  level: number,
  money: number,
  minute: number,
  dayEnd: number,
  tookOneToday: boolean,
): string | null {
  const lvl = levelBlocker(course, level);
  if (lvl) return lvl;
  if (tookOneToday) return 'One course a day';
  if (money < course.cost) return `Need $${course.cost}`;
  if (minute + course.hours * 60 > dayEnd) return 'Not enough of the day left';
  return null;
}

/** Why someone on your team can't go on a course, or null if they can. */
export function employeeCourseBlocker(course: Course, level: number, training: boolean, money: number): string | null {
  if (training) return 'Already in training';
  const lvl = levelBlocker(course, level, MAX_LEVEL);
  if (lvl) return lvl;
  if (money < course.cost) return `Need $${course.cost}`;
  return null;
}
