import type { Morning, Quiet } from "./prefs";

/**
 * Wall-clock time in a parent's zone, and the two schedules built on it: quiet hours (which may run past midnight)
 * and the morning summary. Pure functions of an instant, so a clock change is just another instant.
 */

export type LocalTime = { day: string; weekday: number; minutes: number };

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localTime(at: Date, zone: string): LocalTime {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY[parts.weekday] ?? 0,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

const offsetAt = (at: number, zone: string) => {
  const local = localTime(new Date(at), zone);
  const [y, m, d] = local.day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, Math.floor(local.minutes / 60), local.minutes % 60);
  return wall - Math.floor(at / 60_000) * 60_000;
};

/** The instant a wall-clock time happens on a day in a zone. A time skipped by the clock moving forward lands just after the jump. */
export function instantOf(day: string, minutes: number, zone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  let at = wall - offsetAt(wall, zone);
  const second = wall - offsetAt(at, zone);
  if (second !== at) at = Math.max(at, second);
  return new Date(at);
}

export function shiftDay(day: string, by: number) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

const weekdayOf = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

/**
 * Whether it's quiet now. A window that runs past midnight belongs to the evening it starts on: 22:00–07:00 on
 * Friday keeps Saturday morning quiet too. Equal start and end mean no window at all.
 */
export function inQuiet(quiet: Quiet, now: LocalTime) {
  if (!quiet.on) return false;
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return false;
  if (start < end) return quiet.days.includes(now.weekday) && now.minutes >= start && now.minutes < end;
  const yesterday = (now.weekday + 6) % 7;
  return (quiet.days.includes(now.weekday) && now.minutes >= start) || (quiet.days.includes(yesterday) && now.minutes < end);
}

/** The quiet window that ended most recently, if it ended within `within` minutes: what to sum up once it's over. */
export function quietJustEnded(quiet: Quiet, at: Date, zone: string, within = 180): { from: Date; to: Date } | null {
  if (!quiet.on) return null;
  const start = minutesOf(quiet.start);
  const end = minutesOf(quiet.end);
  if (start === end) return null;
  const today = localTime(at, zone).day;
  for (const offset of [0, -1, -2]) {
    const day = shiftDay(today, offset);
    if (!quiet.days.includes(weekdayOf(day))) continue;
    const from = instantOf(day, start, zone);
    const to = instantOf(start < end ? day : shiftDay(day, 1), end, zone);
    const since = (at.getTime() - to.getTime()) / 60_000;
    if (since >= 0 && since < within) return { from, to };
  }
  return null;
}

/**
 * Whether the morning summary should go out now: a chosen day, at or after the chosen time (a run can be late),
 * no more than three hours after it, and not already sent today. "Today" is the local day, so the hour the clock
 * repeats in the autumn can't send it twice.
 */
export function morningDue(morning: Morning, now: LocalTime, sentOn: string | null) {
  if (!morning.on || !morning.days.includes(now.weekday) || sentOn === now.day) return false;
  const at = minutesOf(morning.time);
  return now.minutes >= at && now.minutes < at + 180;
}
