import { NextResponse } from "next/server";
import en from "@/i18n/dictionaries/en.json";
import he from "@/i18n/dictionaries/he.json";
import { format } from "@/i18n/format";
import { activityLine, isActivityKind } from "@/lib/activity";
import { firstName, nextOpenEvent, tellDay } from "@/lib/day-story";
import type { DayKey } from "@/lib/dates";
import type { HouseEvent } from "@/lib/household";
import { notifyKindOf, readPrefs, validTimeZone, type Prefs } from "@/lib/prefs";
import { apnsKeys, sendApns } from "@/lib/push/apns";
import { inQuiet, localTime, minutesOf, morningDue, quietJustEnded } from "@/lib/routine";
import { createAdminSupabase } from "@/lib/supabase/admin";

const dictionaries = { he, en } as const;

type Admin = NonNullable<ReturnType<typeof createAdminSupabase>>;
type Device = { token: string; locale: string; user_id: string };
type Task = { assignee_id: string; title: string; household_id: string; due_date: string };
type Event = { title: string; time: string | null; household_id: string; attendee_id: string | null };
type State = { user_id: string; morning_sent_on: string | null; quiet_done_until: string | null; digest_until: string | null };
type Activity = { actor_id: string; kind: string; title: string; created_at: string };
type Person = { id: string; prefs: Prefs; house: string; zone: string; devices: Device[]; state: State };

const DIGEST_EVERY = 60 * 60_000;
const LOOKBACK = 12 * 60 * 60_000;

/**
 * Every 15 minutes (.github/workflows/morning.yml), for each parent with an iPhone, in their own zone:
 * - the morning summary on the days and at the time they chose, once a local day;
 * - when their quiet hours end, one line about what the other parent did meanwhile;
 * - on digest, what happened since the last one, at most hourly and never during quiet hours.
 * notify_state remembers what was sent, so a late or repeated run (or a clock change) doesn't send twice.
 * The same pass clears status photos past their 24 hours, files and rows.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const db = createAdminSupabase();
  // Not a failure: until the key is set there is simply nothing this job may do (and the run stays green).
  if (!db) return NextResponse.json({ skipped: "SUPABASE_SERVICE_ROLE_KEY is not set" });

  const cleared = await clearExpiredStories(db);
  const keys = apnsKeys();
  if (!keys) return NextResponse.json({ cleared, sent: 0 });

  const found = await peopleWithPhones(db);
  if (found.people.length === 0) return NextResponse.json({ cleared, sent: 0 });

  const now = new Date();
  let sent = 0;
  const send = async (person: Person, message: (locale: "he" | "en") => { title: string; body: string; url: string; collapseId: string }) => {
    await Promise.all(
      person.devices.map(async (device) => {
        const locale = device.locale === "en" ? "en" : "he";
        const result = await sendApns(device.token, message(locale), keys);
        if (result === "sent") sent += 1;
        if (result === "gone") await db.from("push_devices").delete().eq("token", device.token);
      }),
    );
  };

  const { people, tracked } = found;
  // Without notify_state (before 0014) nothing remembers a send: only the first run after the chosen time sends it,
  // and nothing is held back to sum up later (/api/activity holds nothing either when prefs can't be read).
  const due = (person: Person) => {
    const local = localTime(now, person.zone);
    if (!morningDue(person.prefs.morning, local, person.state.morning_sent_on)) return false;
    return tracked || local.minutes - minutesOf(person.prefs.morning.time) < 15;
  };
  const summaries = await morningLines(db, people.filter(due), now);

  for (const person of people) {
    const local = localTime(now, person.zone);
    const state = { ...person.state };

    const morning = summaries.get(person.id);
    if (morning !== undefined) {
      state.morning_sent_on = local.day;
      if (morning) await send(person, (locale) => ({ title: dictionaries[locale].morning.title, body: morning(locale), url: `/${locale}`, collapseId: `morning-${local.day}` }));
    }

    if (!tracked) continue;
    const quiet = quietJustEnded(person.prefs.quiet, now, person.zone);
    if (quiet && (!state.quiet_done_until || new Date(state.quiet_done_until) < quiet.to)) {
      const during = await othersActivity(db, person, quiet.from, quiet.to);
      if (during.length) await send(person, (locale) => summaryMessage(locale, "quiet", during, `quiet-${quiet.to.toISOString()}`));
      state.quiet_done_until = quiet.to.toISOString();
      if (!state.digest_until || new Date(state.digest_until) < quiet.to) state.digest_until = quiet.to.toISOString();
    }

    if (person.prefs.delivery === "digest" && !inQuiet(person.prefs.quiet, local)) {
      const last = state.digest_until ? new Date(state.digest_until) : null;
      if (!last) state.digest_until = now.toISOString();
      else if (now.getTime() - last.getTime() >= DIGEST_EVERY) {
        const from = new Date(Math.max(last.getTime(), now.getTime() - LOOKBACK));
        const since = await othersActivity(db, person, from, now);
        if (since.length) await send(person, (locale) => summaryMessage(locale, "digest", since, `digest-${now.toISOString()}`));
        state.digest_until = now.toISOString();
      }
    }

    if (tracked && JSON.stringify(state) !== JSON.stringify(person.state)) await db.from("notify_state").upsert(state);
  }
  return NextResponse.json({ cleared, sent });
}

/** Parents with at least one iPhone, their choices, their house and the zone their day runs in. */
async function peopleWithPhones(db: Admin): Promise<{ people: Person[]; tracked: boolean }> {
  const { data: phones } = await db.from("push_devices").select("token, locale, user_id");
  const devices = (phones ?? []) as Device[];
  const ids = [...new Set(devices.map((device) => device.user_id))];
  if (ids.length === 0) return { people: [], tracked: false };
  const [{ data: profiles }, { data: memberships }, { data: states, error: untracked }] = await Promise.all([
    db.from("profiles").select("id, prefs").in("id", ids),
    db.from("household_members").select("user_id, household_id").in("user_id", ids),
    db.from("notify_state").select("user_id, morning_sent_on, quiet_done_until, digest_until").in("user_id", ids),
  ]);
  const houseOf = new Map((memberships ?? []).map((row) => [row.user_id as string, row.household_id as string]));
  const houses = [...new Set(houseOf.values())];
  const { data: zones } = houses.length ? await db.from("households").select("id, timezone").in("id", houses) : { data: [] };
  const zoneOf = new Map((zones ?? []).map((row) => [row.id as string, row.timezone as string]));
  const people = ids.flatMap((id) => {
    const house = houseOf.get(id);
    if (!house) return [];
    const prefs = readPrefs(profiles?.find((row) => row.id === id)?.prefs);
    const houseZone = zoneOf.get(house);
    const zone = prefs.timezone ?? (validTimeZone(houseZone) ? houseZone : "Asia/Jerusalem");
    const state = ((states ?? []) as State[]).find((row) => row.user_id === id) ?? { user_id: id, morning_sent_on: null, quiet_done_until: null, digest_until: null };
    return [{ id, prefs, house, zone, devices: devices.filter((device) => device.user_id === id), state }];
  });
  return { people, tracked: !untracked };
}

/**
 * The day's sentence for each parent due one, when the house has a task due today or an event still ahead. If the
 * only thing left is their own overdue task, they hear that instead. Null: a quiet morning stays quiet.
 */
async function morningLines(db: Admin, people: Person[], now: Date) {
  const lines = new Map<string, ((locale: "he" | "en") => string) | null>();
  if (people.length === 0) return lines;
  const houses = [...new Set(people.map((person) => person.house))];
  const days = [...new Set(people.map((person) => localTime(now, person.zone).day))];
  const [{ data: tasks }, { data: events }] = await Promise.all([
    db.from("tasks").select("assignee_id, title, household_id, due_date").in("household_id", houses).is("completed_at", null).is("deleted_at", null).lte("due_date", days.sort().at(-1)!),
    db.from("events").select("title, time, household_id, attendee_id, date").in("household_id", houses).in("date", days).is("deleted_at", null),
  ]);
  const attendeeIds = [...new Set(((events ?? []) as Event[]).flatMap((event) => (event.attendee_id ? [event.attendee_id] : [])))];
  const { data: names } = attendeeIds.length ? await db.from("profiles").select("id, display_name").in("id", attendeeIds) : { data: [] };
  const nameOf = new Map((names ?? []).map((row) => [row.id as string, (row.display_name as string | null) ?? ""]));

  for (const person of people) {
    const local = localTime(now, person.zone);
    const day = local.day;
    const houseTasks = ((tasks ?? []) as Task[]).filter((task) => task.household_id === person.house && task.due_date <= day);
    const dueToday = houseTasks.filter((task) => task.due_date === day);
    const overdueMine = houseTasks.filter((task) => task.assignee_id === person.id && task.due_date < day);
    const ours = ((events ?? []) as (Event & { date: string })[])
      .filter((event) => event.household_id === person.house && event.date === day)
      .map(
        (event): HouseEvent => ({
          id: event.title,
          title: event.title,
          date: day as DayKey,
          time: event.time ? String(event.time).slice(0, 5) : null,
          prep: null,
          attendeeId: event.attendee_id,
          createdBy: "",
        }),
      );
    const next = nextOpenEvent(ours, day as DayKey, Math.floor(local.minutes / 60), true);
    if (dueToday.length === 0 && !next && overdueMine.length === 0) {
      lines.set(person.id, null);
      continue;
    }
    const who = next?.attendeeId ? nameOf.get(next.attendeeId) : null;
    lines.set(person.id, (locale) => {
      const copy = dictionaries[locale].today;
      if (dueToday.length > 0 || next) {
        return tellDay({
          open: dueToday.length,
          done: 0,
          isToday: true,
          event: next ? { title: next.title, time: next.time, who: who ? firstName(who) : null } : null,
          copy,
        }).text;
      }
      return overdueMine.length === 1 ? copy.waitingEarlierOne : format(copy.waitingEarlier, { count: overdueMine.length });
    });
  }
  return lines;
}

/** What the other parent did between two instants that this parent wants to hear about. */
async function othersActivity(db: Admin, person: Person, from: Date, to: Date) {
  const { data } = await db
    .from("activity")
    .select("actor_id, kind, title, created_at")
    .eq("household_id", person.house)
    .neq("actor_id", person.id)
    .gt("created_at", from.toISOString())
    .lte("created_at", to.toISOString())
    .order("created_at", { ascending: true })
    .limit(50);
  return ((data ?? []) as Activity[]).filter((row) => isActivityKind(row.kind) && person.prefs.notify[notifyKindOf(row.kind)]);
}

function summaryMessage(locale: "he" | "en", kind: "quiet" | "digest", rows: Activity[], collapseId: string) {
  const copy = dictionaries[locale];
  const lines = rows.slice(0, 3).map((row) => activityLine(copy.activity.kinds, row.kind as Parameters<typeof activityLine>[1], row.title));
  const body = rows.length === 1 ? lines[0] : format(copy.routine.push.many, { count: rows.length, list: lines.join(copy.morning.join) });
  return { title: kind === "quiet" ? copy.routine.push.quietTitle : copy.routine.push.digestTitle, body, url: `/${locale}`, collapseId };
}

async function clearExpiredStories(db: Admin) {
  const { data } = await db.from("stories").select("id, path").lte("expires_at", new Date().toISOString()).limit(500);
  if (!data?.length) return 0;
  await db.storage.from("house-media").remove(data.map((row) => row.path as string));
  await db.from("stories").delete().in("id", data.map((row) => row.id as string));
  return data.length;
}
