import { addDays, type DayKey, toDayKey } from "@/lib/dates";
import type { HouseEvent } from "@/lib/household";

/** A row of house_calendar() (0013): already cut down to what this viewer may see. */
export type CalendarRow = {
  id: string;
  owner_id: string;
  detail: "details" | "busy";
  provider: "google" | "microsoft" | null;
  source_name: string | null;
  title: string | null;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
  start_day: DayKey;
  end_day: DayKey;
  tentative: boolean;
  people: string[];
  fixed: boolean;
  prep: string | null;
  link: string | null;
  match_key: string | null;
};

/** One thing on the calendar, from one or more connected calendars that agree it's the same meeting. */
export type CalendarItem = {
  id: string;
  ids: string[];
  owners: string[];
  detail: "details" | "busy";
  provider: "google" | "microsoft" | null;
  sourceName: string | null;
  title: string | null;
  allDay: boolean;
  startsAt: string | null;
  endsAt: string | null;
  startDay: DayKey;
  endDay: DayKey;
  tentative: boolean;
  people: string[];
  fixed: boolean;
  prep: string | null;
  link: string | null;
};

const toItem = (row: CalendarRow): CalendarItem => ({
  id: row.id,
  ids: [row.id],
  owners: [row.owner_id],
  detail: row.detail,
  provider: row.provider,
  sourceName: row.source_name,
  title: row.title,
  allDay: row.all_day,
  startsAt: row.starts_at,
  endsAt: row.ends_at,
  startDay: row.start_day,
  endDay: row.end_day,
  tentative: row.tentative,
  people: [...row.people],
  fixed: row.fixed,
  prep: row.prep,
  link: row.link,
});

/**
 * Copies of one meeting from two connected calendars become one item, but only on firm evidence: the same
 * iCalendar UID at the same start (the server's match_key). Title and time alone never merge anything, and only
 * copies the viewer may already see in full take part, so a merge can't show more than either copy did.
 */
export function mergeCopies(rows: CalendarRow[], selfId: string): CalendarItem[] {
  const merged = new Map<string, CalendarItem>();
  const items: CalendarItem[] = [];
  // The viewer's own copy leads, so its link and calendar name are the ones shown.
  const ordered = [...rows].sort((a, b) => Number(b.owner_id === selfId) - Number(a.owner_id === selfId));
  for (const row of ordered) {
    const key = row.detail === "details" ? row.match_key : null;
    const known = key ? merged.get(key) : undefined;
    if (!known) {
      const item = toItem(row);
      if (key) merged.set(key, item);
      items.push(item);
      continue;
    }
    known.ids.push(row.id);
    if (!known.owners.includes(row.owner_id)) known.owners.push(row.owner_id);
    for (const person of row.people) if (!known.people.includes(person)) known.people.push(person);
    known.fixed ||= row.fixed;
    known.prep ??= row.prep;
    known.link ??= row.link;
    known.tentative &&= row.tentative;
  }
  return items;
}

export type AgendaEntry = {
  key: string;
  kind: "home" | "calendar";
  title: string | null;
  busy: boolean;
  allDay: boolean;
  /** Minutes from the start of the day; null all day. An event that began yesterday starts at 0. */
  start: number | null;
  end: number | null;
  startLabel: string | null;
  endLabel: string | null;
  continues: boolean;
  people: string[];
  prep: string | null;
  event?: HouseEvent;
  item?: CalendarItem;
};

/** A home event has a start and no end; it counts as on for this long. */
export const HOME_EVENT_MINUTES = 60;

const pad = (n: number) => String(n).padStart(2, "0");
const label = (minutes: number) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;
const minutesOf = (date: Date) => date.getHours() * 60 + date.getMinutes();

/** Everything on one day, in this device's time: home events and visible calendar items, all-day first. */
export function agendaFor(day: DayKey, events: HouseEvent[], items: CalendarItem[]): AgendaEntry[] {
  const entries: AgendaEntry[] = [];
  for (const event of events) {
    if (event.date !== day) continue;
    const start = event.time ? Number(event.time.slice(0, 2)) * 60 + Number(event.time.slice(3, 5)) : null;
    entries.push({
      key: `home:${event.id}`,
      kind: "home",
      title: event.title,
      busy: false,
      allDay: start === null,
      start,
      end: start === null ? null : Math.min(start + HOME_EVENT_MINUTES, 24 * 60),
      startLabel: event.time ? event.time.slice(0, 5) : null,
      endLabel: null,
      continues: false,
      people: event.attendeeId ? [event.attendeeId] : [],
      prep: event.prep,
      event,
    });
  }
  for (const item of items) {
    if (item.allDay) {
      if (item.startDay > day || item.endDay < day) continue;
      entries.push(entryOf(item, null, null, item.startDay < day));
      continue;
    }
    const startsAt = new Date(item.startsAt!);
    const endsAt = new Date(item.endsAt!);
    const first = toDayKey(startsAt);
    const last = toDayKey(new Date(Math.max(startsAt.getTime(), endsAt.getTime() - 1)));
    if (first > day || last < day) continue;
    const start = first < day ? 0 : minutesOf(startsAt);
    const end = last > day ? 24 * 60 : Math.max(start, endsAt.getTime() === startsAt.getTime() ? start : minutesOf(endsAt) || 24 * 60);
    entries.push(entryOf(item, start, end, first < day));
  }
  return entries.sort((a, b) => Number(b.allDay) - Number(a.allDay) || (a.start ?? 0) - (b.start ?? 0) || (a.end ?? 0) - (b.end ?? 0));
}

function entryOf(item: CalendarItem, start: number | null, end: number | null, continues: boolean): AgendaEntry {
  return {
    key: `calendar:${item.id}`,
    kind: "calendar",
    title: item.title,
    busy: item.detail === "busy",
    allDay: start === null,
    start,
    end,
    startLabel: start === null ? null : continues ? null : label(start),
    endLabel: end === null || end >= 24 * 60 ? null : label(end),
    continues,
    people: item.people,
    prep: item.prep,
    item,
  };
}

/** Still ahead or happening now. All-day stays all day. */
export const stillOn = (entry: AgendaEntry, now: number) => entry.allDay || (entry.end ?? 0) > now;
export const happeningNow = (entry: AgendaEntry, now: number) => !entry.allDay && (entry.start ?? 0) <= now && (entry.end ?? 0) > now;

/**
 * Whether an entry is the viewer's to plan around: their own or the house's (home events, meetings they're in).
 * Another parent's meetings and busy blocks are theirs, not the viewer's next thing.
 */
export const concernsViewer = (entry: AgendaEntry, selfId: string) =>
  entry.kind === "home" || (!entry.busy && entry.people.includes(selfId));

/** A parent's busy blocks that touch or overlap read as one stretch: "busy 9:00–17:00", not eight lines. */
export function foldBusy(entries: AgendaEntry[]): AgendaEntry[] {
  const out: AgendaEntry[] = [];
  const open = new Map<string, AgendaEntry>();
  for (const entry of entries) {
    const owner = entry.busy && !entry.allDay ? entry.people[0] : undefined;
    if (!owner) {
      out.push(entry);
      continue;
    }
    const last = open.get(owner);
    if (last && (entry.start ?? 0) <= (last.end ?? 0)) {
      if ((entry.end ?? 0) > (last.end ?? 0)) {
        last.end = entry.end;
        last.endLabel = entry.endLabel;
      }
      continue;
    }
    const copy = { ...entry };
    open.set(owner, copy);
    out.push(copy);
  }
  return out;
}

/**
 * The few lines Today has room for. What's the viewer's or the whole house's comes first, then the rest, so a day
 * of someone else's meetings can't push the viewer's evening off the screen. Shown in time order.
 */
export function pickForToday(entries: AgendaEntry[], selfId: string, limit: number) {
  const ranked = entries
    .map((entry, index) => ({ entry, index, mine: concernsViewer(entry, selfId) }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.index - b.index);
  const kept = new Set(ranked.slice(0, limit).map(({ index }) => index));
  return { shown: entries.filter((_, index) => kept.has(index)), hidden: Math.max(0, entries.length - limit) };
}

export type PeopleFilter = "all" | "me" | "shared" | { member: string };

/** "Everyone" is everything this viewer may see; "shared" is what every parent in the house takes part in. */
export function matchesFilter(entry: AgendaEntry, filter: PeopleFilter, selfId: string, memberIds: string[]) {
  if (filter === "all") return true;
  const people = entry.kind === "home" && entry.people.length === 0 ? memberIds : entry.people;
  if (filter === "me") return people.includes(selfId);
  if (filter === "shared") return memberIds.length > 1 && memberIds.every((id) => people.includes(id));
  return people.includes(filter.member);
}

/** Days of calendar to keep at hand: a little back, a month ahead. */
export const calendarRange = (today: DayKey) => ({ from: addDays(today, -7), to: addDays(today, 45) });
