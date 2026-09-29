import { WORKDAY_END, WORKDAY_START } from './balance';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekday(day: number): string {
  return DAY_NAMES[(day - 1) % 7];
}

export function isWeekend(day: number): boolean {
  return (day - 1) % 7 >= 5;
}

export function formatClock(minute: number): string {
  const h24 = Math.floor(minute / 60);
  const m = minute % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export function formatHour(hour: number): string {
  return formatClock(hour * 60).replace(':00', '');
}

export function isBusinessHours(day: number, minute: number): boolean {
  if ((day - 1) % 7 === 6) return false; // Sunday: closed
  return minute >= WORKDAY_START && minute < WORKDAY_END;
}

/**
 * How likely anyone picks up, based on the time of day. Mornings are best,
 * lunch and late afternoon are rough, Saturdays are quiet.
 */
export function pickupMultiplier(day: number, minute: number): number {
  const hour = minute / 60;
  let m = 1;
  if (hour < 10) m = 0.9;
  else if (hour < 12) m = 1.15;
  else if (hour < 13.5) m = 0.6; // lunch
  else if (hour < 16) m = 1;
  else m = 0.7;
  if ((day - 1) % 7 === 5) m *= 0.55; // Saturday
  return m;
}

export function callTimeQuality(day: number, minute: number): 'good' | 'okay' | 'poor' {
  const m = pickupMultiplier(day, minute);
  if (m >= 1) return 'good';
  if (m >= 0.8) return 'okay';
  return 'poor';
}
