import { describe, expect, it } from 'vitest';
import { COURSES, COURSE_ORDER, employeeCourseBlocker, levelBlocker, playerCourseBlocker, skillOfRole } from './training';
import { xpForLevel } from './balance';

describe('courses', () => {
  it('bigger courses cost more, take longer and teach more', () => {
    const [a, b, c] = COURSE_ORDER.map((id) => COURSES[id]);
    expect(a.cost).toBeLessThan(b.cost);
    expect(b.cost).toBeLessThan(c.cost);
    expect(a.hours).toBeLessThan(b.hours);
    expect(b.hours).toBeLessThan(c.hours);
    expect(a.xp).toBeLessThan(b.xp);
    expect(b.xp).toBeLessThan(c.xp);
  });

  it('every level has a course that suits it', () => {
    for (let level = 1; level <= 12; level++) {
      expect(COURSE_ORDER.some((id) => levelBlocker(COURSES[id], level) === null)).toBe(true);
    }
  });

  it('a course is faster than working but not free: a masterclass is worth about a level at level 4', () => {
    expect(COURSES.masterclass.xp / xpForLevel(4)).toBeGreaterThan(0.8);
    expect(COURSES.masterclass.xp / xpForLevel(4)).toBeLessThan(1.2);
    // The beginner workshop can't carry you past level 2.
    expect(levelBlocker(COURSES.workshop, 3)).toMatch(/too basic/i);
    expect(levelBlocker(COURSES.masterclass, 2)).toMatch(/level 4/);
  });

  it('you can only take one course a day, and need the money and the time', () => {
    const c = COURSES.course;
    expect(playerCourseBlocker(c, 3, 1000, 9 * 60, 24 * 60, false)).toBeNull();
    expect(playerCourseBlocker(c, 3, 1000, 9 * 60, 24 * 60, true)).toMatch(/one course/i);
    expect(playerCourseBlocker(c, 3, 100, 9 * 60, 24 * 60, false)).toMatch(/need/i);
    expect(playerCourseBlocker(c, 3, 1000, 22 * 60, 24 * 60, false)).toMatch(/not enough/i);
  });

  it('employees stop at level 5 and can only be in one course', () => {
    expect(employeeCourseBlocker(COURSES.masterclass, 4, false, 1000)).toBeNull();
    expect(employeeCourseBlocker(COURSES.masterclass, 5, false, 1000)).toMatch(/top level/i);
    expect(employeeCourseBlocker(COURSES.course, 3, true, 1000)).toMatch(/already/i);
  });

  it('each role learns its own skill', () => {
    expect(skillOfRole('sales')).toBe('sales');
    expect(skillOfRole('designer')).toBe('design');
    expect(skillOfRole('developer')).toBe('development');
  });
});
