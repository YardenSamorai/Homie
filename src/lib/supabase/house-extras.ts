"use client";

import type { CalendarRow } from "@/lib/agenda";
import type { DayKey } from "@/lib/dates";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

export type HouseNote = { body: string; authorId: string; until: DayKey | null; version: string; updatedAt: string };
export type NoteFailure = "stale" | "gone" | "past" | "offline" | "generic";

type NoteRow = { body: string | null; author_id: string; until: string | null; version: number | string; updated_at: string };
const fromRow = (row: NoteRow & { body: string }): HouseNote => ({
  body: row.body,
  authorId: row.author_id,
  until: row.until,
  version: String(row.version),
  updatedAt: row.updated_at,
});

const failureOf = (message: string | undefined): NoteFailure => {
  if (!message) return "generic";
  if (/stale/.test(message)) return "stale";
  if (/gone/.test(message)) return "gone";
  if (/past/.test(message)) return "past";
  if (/fetch|network/i.test(message)) return "offline";
  return "generic";
};

export async function loadNote(householdId: string): Promise<HouseNote | null> {
  const db = createBrowserSupabase();
  const { data, error } = await db.from("house_notes").select("body, author_id, until, version, updated_at").eq("household_id", householdId).maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as NoteRow | null;
  return row?.body ? fromRow({ ...row, body: row.body }) : null;
}

/** seenVersion: the note on screen when editing began (null: none). A newer one on the server is refused. */
export async function pinNote(body: string, until: DayKey | null, seenVersion: string | null): Promise<HouseNote | NoteFailure> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const db = createBrowserSupabase();
  const { data, error } = await db
    .rpc("pin_house_note", { note_body: body, note_until: until, seen_version: seenVersion })
    .then((answer) => answer, (thrown: Error) => ({ data: null, error: thrown }));
  const row = data as NoteRow | null;
  if (error || !row?.body) return failureOf(error?.message);
  return fromRow({ ...row, body: row.body });
}

export async function clearNote(seenVersion: string): Promise<true | NoteFailure> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  const db = createBrowserSupabase();
  const { error } = await db
    .rpc("clear_house_note", { seen_version: seenVersion })
    .then((answer) => answer, (thrown: Error) => ({ error: thrown }));
  return error ? failureOf(error.message) : true;
}

export function watchNote(householdId: string, onChange: () => void) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const channel = db
    .channel(`note-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "house_notes", filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe((status) => status === "SUBSCRIBED" && onChange());
  return () => {
    void db.removeChannel(channel);
  };
}

/** The house's imported events this parent may see, already cut down by the database (house_calendar, 0013). */
export async function loadHouseCalendar(from: DayKey, to: DayKey): Promise<CalendarRow[]> {
  const db = createBrowserSupabase();
  const { data, error } = await db.rpc("house_calendar", { from_day: from, to_day: to });
  if (error) throw new Error(error.message);
  return (data ?? []) as CalendarRow[];
}

/** The house's own word on an imported event: who takes part, what to prepare. The source isn't touched. */
export async function fixCalendarEvent(id: string, people: string[] | null, prep: string | null) {
  if (!supabaseConfigured()) return false;
  const db = createBrowserSupabase();
  const { error } = await db
    .rpc("fix_calendar_event", { event_id: id, taking_part: people, prep_note: prep })
    .then((answer) => answer, (thrown: Error) => ({ error: thrown }));
  return !error;
}
