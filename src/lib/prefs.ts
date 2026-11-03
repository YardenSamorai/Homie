import type { ActivityKind } from "./activity";
import { defaultHomeLayout, readHomeLayout, type HomeLayout } from "./home-layout";
import { defaultLook, readLook, type Look } from "./look";
import { normalizeHex } from "./color";

/** What a parent hears about, grouped as Settings shows it. */
export const notifyKinds = ["tasks", "done", "shopping", "bought", "events", "stories"] as const;
export type NotifyKind = (typeof notifyKinds)[number];

export const PREFS_VERSION = 2;

/** Days of the week, Sunday first, as Date.getDay() counts them. */
export const weekDays = [0, 1, 2, 3, 4, 5, 6] as const;

export type Quiet = { on: boolean; start: string; end: string; days: number[] };
export type Morning = { on: boolean; time: string; days: number[] };
export type CalendarColors = { by: "person" | "calendar"; people: Record<string, string>; calendars: Record<string, string> };

/**
 * One parent's choices, stored in profiles.prefs so every device and the server read the same.
 * Written only through /api/prefs, which applies a change at its own path and keeps everything else as it was.
 */
export type Prefs = {
  v: typeof PREFS_VERSION;
  notify: Record<NotifyKind, boolean>;
  /** Pushes as they happen, or gathered into one now and then. */
  delivery: "instant" | "digest";
  quiet: Quiet;
  morning: Morning;
  /** An IANA zone; null follows the house's. */
  timezone: string | null;
  newTask: { assignee: "me" | "partner"; due: "today" | "none" };
  look: Look;
  home: HomeLayout;
  calendarColors: CalendarColors;
};

export const defaultPrefs: Prefs = {
  v: PREFS_VERSION,
  notify: { tasks: true, done: true, shopping: true, bought: true, events: true, stories: true },
  delivery: "instant",
  quiet: { on: false, start: "22:00", end: "07:00", days: [...weekDays] },
  morning: { on: true, time: "08:00", days: [...weekDays] },
  timezone: null,
  newTask: { assignee: "me", due: "today" },
  look: defaultLook,
  home: defaultHomeLayout,
  calendarColors: { by: "person", people: {}, calendars: {} },
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CALENDAR_KEY = /^(home|[0-9a-f]{32})$/;

export const readTime = (value: unknown, fallback: string) => (typeof value === "string" && TIME.test(value) ? value : fallback);

function readDays(value: unknown, fallback: number[]) {
  if (!Array.isArray(value)) return fallback;
  return [...new Set(value.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
}

export function validTimeZone(zone: unknown): zone is string {
  if (typeof zone !== "string" || zone.length > 64 || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function readColors(value: unknown, keyOk: (key: string) => boolean) {
  const out: Record<string, string> = {};
  if (!value || typeof value !== "object") return out;
  for (const [key, color] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
    const hex = typeof color === "string" ? normalizeHex(color) : null;
    if (keyOk(key) && hex) out[key] = hex;
  }
  return out;
}

type Raw = Partial<Record<keyof Prefs, unknown>> & { morning?: { on?: unknown; time?: unknown; hour?: unknown; days?: unknown } };
const section = (value: unknown) => (value && typeof value === "object" ? (value as Record<string, unknown>) : {});

/**
 * Whatever is stored, as a full set of choices: a missing or malformed value never turns something off, and the
 * first version (a morning hour from 7 to 9, nothing else) carries over as it was.
 */
export function readPrefs(raw: unknown): Prefs {
  const value = (raw && typeof raw === "object" ? raw : {}) as Raw;
  const notify = { ...defaultPrefs.notify };
  const storedNotify = section(value.notify);
  for (const kind of notifyKinds) if (typeof storedNotify[kind] === "boolean") notify[kind] = storedNotify[kind] as boolean;
  const morning = section(value.morning);
  const hour = Number(morning.hour);
  const legacyTime = Number.isInteger(hour) && hour >= 0 && hour <= 23 ? `${String(hour).padStart(2, "0")}:00` : null;
  const quiet = section(value.quiet);
  const newTask = section(value.newTask);
  const colors = section(value.calendarColors);
  return {
    v: PREFS_VERSION,
    notify,
    delivery: value.delivery === "digest" ? "digest" : "instant",
    quiet: {
      on: typeof quiet.on === "boolean" ? quiet.on : defaultPrefs.quiet.on,
      start: readTime(quiet.start, defaultPrefs.quiet.start),
      end: readTime(quiet.end, defaultPrefs.quiet.end),
      days: readDays(quiet.days, defaultPrefs.quiet.days),
    },
    morning: {
      on: typeof morning.on === "boolean" ? morning.on : defaultPrefs.morning.on,
      time: readTime(morning.time, legacyTime ?? defaultPrefs.morning.time),
      days: readDays(morning.days, defaultPrefs.morning.days),
    },
    timezone: validTimeZone(value.timezone) ? value.timezone : null,
    newTask: {
      assignee: newTask.assignee === "partner" ? "partner" : "me",
      due: newTask.due === "none" ? "none" : "today",
    },
    look: readLook(value.look),
    home: readHomeLayout(value.home),
    calendarColors: {
      by: colors.by === "calendar" ? "calendar" : "person",
      people: readColors(colors.people, (key) => UUID.test(key)),
      calendars: readColors(colors.calendars, (key) => CALENDAR_KEY.test(key)),
    },
  };
}

/** Whether the account already holds a look, or this device's old choices should become its first one. */
export const storedLook = (raw: unknown) => Boolean(raw && typeof raw === "object" && section((raw as Raw).look).theme);

/** A change at one place in the choices: ["look", "accent"], ["notify", "shopping"], ["calendarColors", "people", id]. */
export type PrefsChange = { path: string[]; value: unknown };

const TOP: readonly (keyof Prefs)[] = ["notify", "delivery", "quiet", "morning", "timezone", "newTask", "look", "home", "calendarColors"];
const MAX_DEPTH: Partial<Record<keyof Prefs, number>> = { delivery: 1, timezone: 1, home: 2, look: 2, calendarColors: 3 };
const SAFE_KEY = /^[A-Za-z0-9-]{1,40}$/;

/** A change the server accepts: a known section, no deeper than that section goes, plain keys only. */
export function validChange(change: unknown): change is PrefsChange {
  if (!change || typeof change !== "object") return false;
  const { path } = change as { path?: unknown };
  if (!Array.isArray(path) || path.length === 0 || !path.every((key) => typeof key === "string" && SAFE_KEY.test(key))) return false;
  const top = path[0] as keyof Prefs;
  if (!TOP.includes(top)) return false;
  return path.length <= (MAX_DEPTH[top] ?? 2);
}

/**
 * The stored choices with these changes laid in, each at its own path, then read back through readPrefs so only
 * known fields with valid values remain. A change from another device at a different path is left alone.
 */
export function applyChanges(stored: unknown, changes: PrefsChange[]): Prefs {
  const base = readPrefs(stored) as unknown as Record<string, unknown>;
  const next = structuredClone(base);
  for (const { path, value } of changes) {
    let node = next;
    for (const key of path.slice(0, -1)) {
      const child = node[key];
      node[key] = child && typeof child === "object" && !Array.isArray(child) ? { ...(child as Record<string, unknown>) } : {};
      node = node[key] as Record<string, unknown>;
    }
    const leaf = path[path.length - 1];
    if (value === null && path.length === 3) delete node[leaf];
    else node[leaf] = value;
  }
  return readPrefs(next);
}

/** The changes that turn `from` into `to`, one per field that differs, at the depth the server accepts. */
export function changesBetween(from: Prefs, to: Prefs): PrefsChange[] {
  const out: PrefsChange[] = [];
  for (const top of TOP) {
    const depth = MAX_DEPTH[top] ?? 2;
    const a = from[top] as unknown;
    const b = to[top] as unknown;
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    if (depth === 1 || !a || typeof a !== "object" || Array.isArray(a)) {
      out.push({ path: [top], value: b });
      continue;
    }
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
      if (JSON.stringify(left[key]) === JSON.stringify(right[key])) continue;
      const inner = left[key];
      if (depth === 3 && inner && typeof inner === "object" && !Array.isArray(inner)) {
        const l = inner as Record<string, unknown>;
        const r = (right[key] ?? {}) as Record<string, unknown>;
        for (const leaf of new Set([...Object.keys(l), ...Object.keys(r)])) {
          if (JSON.stringify(l[leaf]) !== JSON.stringify(r[leaf])) out.push({ path: [top, key, leaf], value: r[leaf] ?? null });
        }
      } else {
        out.push({ path: [top, key], value: right[key] });
      }
    }
  }
  return out;
}

/** Which switch in Settings covers a kind of activity. A task handed to you counts as a new task. */
export function notifyKindOf(kind: ActivityKind): NotifyKind {
  switch (kind) {
    case "task_added":
    case "task_assigned":
      return "tasks";
    case "task_done":
      return "done";
    case "shopping_added":
      return "shopping";
    case "shopping_bought":
      return "bought";
    case "event_added":
      return "events";
    case "story_added":
      return "stories";
  }
}
