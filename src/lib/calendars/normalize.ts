import type { DayKey } from "@/lib/dates";

export type Provider = "google" | "microsoft";
export type Response = "accepted" | "tentative" | "declined" | "none" | "organizer";

/** An event as Homie keeps it, whichever provider it came from. One instance, for a series. */
export type RemoteEvent = {
  remoteId: string;
  seriesId: string | null;
  icalUid: string | null;
  title: string | null;
  allDay: boolean;
  /** Instants (UTC ISO) for timed events. */
  startsAt: string | null;
  endsAt: string | null;
  /** First and last day, inclusive. Only all-day events carry them from the source; timed ones get them later. */
  startDay: DayKey | null;
  endDay: DayKey | null;
  busy: boolean;
  markedPrivate: boolean;
  tentative: boolean;
  myResponse: Response;
  attendees: { email: string; response: Response }[];
  link: string | null;
};

/** The provider says this one is gone: deleted, cancelled, or a whole series (seriesId = remoteId). */
export type RemovedEvent = { remoteId: string; removed: true };

export type Change = RemoteEvent | RemovedEvent;

export const isRemoved = (change: Change): change is RemovedEvent => "removed" in change;

const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar arithmetic on the date alone, in UTC, so no device or server zone can move it. */
export function shiftDay(day: DayKey, days: number): DayKey {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** The day an instant falls on in a time zone (the house's, for imported events). */
export function dayIn(instant: string | Date, timeZone: string): DayKey {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    typeof instant === "string" ? new Date(instant) : instant,
  );
}

/** First and last day a timed event touches. An event ending at midnight doesn't spill into the next day. */
export function daysOf(startsAt: string, endsAt: string, timeZone: string): { startDay: DayKey; endDay: DayKey } {
  const start = new Date(startsAt);
  const end = new Date(Math.max(start.getTime(), new Date(endsAt).getTime() - 1));
  return { startDay: dayIn(start, timeZone), endDay: dayIn(end, timeZone) };
}

const googleResponse = (value: unknown): Response =>
  value === "accepted" ? "accepted" : value === "tentative" ? "tentative" : value === "declined" ? "declined" : "none";

type GoogleTime = { date?: string; dateTime?: string; timeZone?: string };
type GoogleEvent = {
  id: string;
  status?: string;
  eventType?: string;
  summary?: string;
  start?: GoogleTime;
  end?: GoogleTime;
  recurringEventId?: string;
  iCalUID?: string;
  transparency?: string;
  visibility?: string;
  htmlLink?: string;
  organizer?: { self?: boolean };
  attendees?: { email?: string; self?: boolean; resource?: boolean; responseStatus?: string }[];
};

/** Working-location chips and contact birthdays aren't plans anyone makes. */
const GOOGLE_SKIPPED = new Set(["workingLocation", "birthday"]);

/** Google Calendar API v3 event → Homie's shape (https://developers.google.com/workspace/calendar/api/v3/reference/events). */
export function fromGoogle(raw: unknown): Change | null {
  const item = raw as GoogleEvent;
  if (!item?.id) return null;
  if (item.status === "cancelled" || GOOGLE_SKIPPED.has(item.eventType ?? "")) return { remoteId: item.id, removed: true };
  const start = item.start ?? {};
  const end = item.end ?? start;
  const allDay = Boolean(start.date);
  if (!allDay && !start.dateTime) return null;

  const self = item.attendees?.find((attendee) => attendee.self);
  const myResponse: Response = item.organizer?.self ? "organizer" : self ? googleResponse(self.responseStatus) : "none";
  const startDay = allDay ? start.date! : null;
  // An all-day end date is exclusive: 3–4 November is one day, the 3rd.
  const endDay = allDay ? (end.date && end.date > start.date! ? shiftDay(end.date, -1) : start.date!) : null;

  return {
    remoteId: item.id,
    seriesId: item.recurringEventId ?? null,
    icalUid: item.iCalUID ?? null,
    title: item.summary?.trim() || null,
    allDay,
    startsAt: allDay ? null : new Date(start.dateTime!).toISOString(),
    endsAt: allDay ? null : new Date(end.dateTime ?? start.dateTime!).toISOString(),
    startDay,
    endDay,
    busy: item.transparency !== "transparent",
    markedPrivate: item.visibility === "private" || item.visibility === "confidential",
    tentative: myResponse === "tentative" || item.status === "tentative",
    myResponse,
    attendees: (item.attendees ?? [])
      .filter((attendee) => attendee.email && !attendee.resource)
      .map((attendee) => ({ email: attendee.email!.toLowerCase(), response: googleResponse(attendee.responseStatus) })),
    link: item.htmlLink ?? null,
  };
}

const graphResponse = (value: unknown): Response =>
  value === "organizer"
    ? "organizer"
    : value === "accepted"
      ? "accepted"
      : value === "tentativelyAccepted"
        ? "tentative"
        : value === "declined"
          ? "declined"
          : "none";

type GraphTime = { dateTime?: string; timeZone?: string };
type GraphEvent = {
  id: string;
  "@removed"?: unknown;
  isCancelled?: boolean;
  type?: string;
  subject?: string;
  isAllDay?: boolean;
  start?: GraphTime;
  end?: GraphTime;
  seriesMasterId?: string;
  iCalUId?: string;
  showAs?: string;
  sensitivity?: string;
  webLink?: string;
  responseStatus?: { response?: string };
  attendees?: { type?: string; emailAddress?: { address?: string }; status?: { response?: string } }[];
};

/** Graph sends times without an offset, in the zone it names. Every request asks for UTC (Prefer: outlook.timezone). */
function graphInstant(time: GraphTime): string {
  const value = time.dateTime ?? "";
  return new Date(/([zZ]|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`).toISOString();
}

/**
 * An all-day event is midnight to midnight wherever it was made. Read through a UTC lens that midnight can show up
 * as 22:00 the day before (Israel) or 05:00 the same day (New York), so the nearest midnight is the day.
 */
function graphDay(time: GraphTime): DayKey {
  const value = time.dateTime ?? "";
  const day = value.slice(0, 10);
  const hour = Number(value.slice(11, 13) || 0);
  return hour >= 12 ? shiftDay(day, 1) : day;
}

/** Microsoft Graph v1.0 event → Homie's shape (https://learn.microsoft.com/graph/api/resources/event). */
export function fromGraph(raw: unknown): Change | null {
  const item = raw as GraphEvent;
  if (!item?.id) return null;
  if (item["@removed"] || item.isCancelled) return { remoteId: item.id, removed: true };
  // A calendar view lists the instances; a series master on its own isn't something on the calendar.
  if (item.type === "seriesMaster") return null;
  if (!item.start?.dateTime) return null;
  const end = item.end?.dateTime ? item.end : item.start;
  const allDay = Boolean(item.isAllDay);
  const myResponse = graphResponse(item.responseStatus?.response);
  const startDay = allDay ? graphDay(item.start) : null;
  const lastDay = allDay ? shiftDay(graphDay(end), -1) : null;

  return {
    remoteId: item.id,
    seriesId: item.seriesMasterId ?? null,
    icalUid: item.iCalUId ?? null,
    title: item.subject?.trim() || null,
    allDay,
    startsAt: allDay ? null : graphInstant(item.start),
    endsAt: allDay ? null : graphInstant(end),
    startDay,
    endDay: allDay && startDay && lastDay ? (lastDay >= startDay ? lastDay : startDay) : null,
    busy: item.showAs !== "free",
    markedPrivate: item.sensitivity === "private" || item.sensitivity === "confidential" || item.sensitivity === "personal",
    tentative: myResponse === "tentative" || item.showAs === "tentative",
    myResponse,
    attendees: (item.attendees ?? [])
      .filter((attendee) => attendee.emailAddress?.address && attendee.type !== "resource")
      .map((attendee) => ({ email: attendee.emailAddress!.address!.toLowerCase(), response: graphResponse(attendee.status?.response) })),
    link: item.webLink ?? null,
  };
}

/**
 * Who in the house takes part, from addresses each parent has proven (their sign-in, their connected accounts),
 * never from a display name. The calendar's owner is in unless they declined, in which case the event isn't
 * theirs to show at all (null). Others are in when an invite to one of their addresses wasn't declined.
 */
export function takingPart(
  event: Pick<RemoteEvent, "myResponse" | "attendees">,
  ownerId: string,
  addresses: ReadonlyMap<string, ReadonlySet<string>>,
): { people: string[]; declined: string[] } | null {
  if (event.myResponse === "declined") return null;
  const people = [ownerId];
  const declined: string[] = [];
  for (const [memberId, emails] of addresses) {
    if (memberId === ownerId) continue;
    const invites = event.attendees.filter((attendee) => emails.has(attendee.email));
    if (invites.length === 0) continue;
    if (invites.every((invite) => invite.response === "declined")) declined.push(memberId);
    else people.push(memberId);
  }
  return { people, declined };
}

/** Whether an event touches the synced window at all. */
export function inWindow(event: { startDay: DayKey; endDay: DayKey }, from: DayKey, to: DayKey) {
  return event.startDay <= to && event.endDay >= from;
}
