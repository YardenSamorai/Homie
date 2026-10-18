/** A calendar day in the household's time zone, formatted `YYYY-MM-DD`. */
export type DayKey = string;

const pad = (n: number) => String(n).padStart(2, "0");

export function toDayKey(date: Date): DayKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Noon avoids DST edges shifting the date when doing day arithmetic. */
export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

export function addDays(key: DayKey, days: number): DayKey {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

export function diffDays(later: DayKey, earlier: DayKey): number {
  return Math.round((fromDayKey(later).getTime() - fromDayKey(earlier).getTime()) / 86_400_000);
}

export function dayRange(from: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/** Sunday-first, matching both Hebrew and US English calendars. */
export function weekStart(key: DayKey): DayKey {
  return addDays(key, -fromDayKey(key).getDay());
}

/** Friday–Saturday in Hebrew, Saturday–Sunday otherwise. */
export function isWeekend(key: DayKey, locale: string): boolean {
  const weekday = fromDayKey(key).getDay();
  return locale === "he" ? weekday === 5 || weekday === 6 : weekday === 0 || weekday === 6;
}

export function startOfMonth(key: DayKey): DayKey {
  return `${key.slice(0, 7)}-01`;
}

export function addMonths(key: DayKey, months: number): DayKey {
  const date = fromDayKey(startOfMonth(key));
  date.setMonth(date.getMonth() + months);
  return toDayKey(date);
}
