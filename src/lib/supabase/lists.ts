"use client";

import { isAisle, type Aisle } from "@/lib/aisles";
import type { GroupLine, HouseEvent, ProductMemo, ShoppingGroup, ShoppingItem, ShoppingTrip, SubstituteMode, TripLine } from "@/lib/household";
import { isUnit, readLegacyNote } from "@/lib/quantity";
import type { Task } from "@/lib/tasks";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";
import { check, enqueue } from "./outbox";

const SHOPPING_COLUMNS =
  "id, name, quantity, unit, quantity_note, photo_path, category, added_by, requested_by, checked_at, checked_by, missing_at, substitute_mode, substitute, event_id, task_id, created_at";

type ShoppingRow = {
  id: string;
  name: string;
  quantity: number | string | null;
  unit: string | null;
  quantity_note: string | null;
  photo_path: string | null;
  category: string | null;
  added_by: string;
  requested_by: string[] | null;
  checked_at: string | null;
  checked_by: string | null;
  missing_at: string | null;
  substitute_mode: string | null;
  substitute: string | null;
  event_id: string | null;
  task_id: string | null;
  created_at: string;
};

const substituteModes: SubstituteMode[] = ["allowed", "none", "specific"];
const toNumber = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

/**
 * A row as the app holds it. A row from before quantities existed whose note is only an amount ("2 ליטר")
 * shows as that amount; it's written back split on its next save. Any other note stays exactly as it was.
 */
export function fromShoppingRow(row: ShoppingRow): ShoppingItem {
  let quantity = toNumber(row.quantity);
  let unit = isUnit(row.unit) ? row.unit : null;
  let note = row.quantity_note;
  if (quantity === null && unit === null) {
    const legacy = readLegacyNote(note);
    if (legacy) {
      ({ quantity, unit } = legacy);
      note = null;
    }
  }
  return {
    id: row.id,
    name: row.name,
    quantity,
    unit,
    note,
    photoPath: row.photo_path,
    category: isAisle(row.category) ? row.category : null,
    addedBy: row.added_by,
    requestedBy: row.requested_by ?? [],
    checkedAt: row.checked_at,
    checkedBy: row.checked_by,
    missingAt: row.missing_at,
    substituteMode: substituteModes.includes(row.substitute_mode as SubstituteMode) ? (row.substitute_mode as SubstituteMode) : null,
    substitute: row.substitute,
    eventId: row.event_id,
    taskId: row.task_id,
    createdAt: row.created_at,
  };
}

/** Throws when any list fails to load, so a dropped connection never empties the screen. */
export async function loadHouseholdLists(householdId: string) {
  const db = createBrowserSupabase();
  const [shopping, tasks, events] = await Promise.all([
    // Items filed under a finished trip are history, not the list.
    db.from("shopping_items").select(SHOPPING_COLUMNS).eq("household_id", householdId).is("trip_id", null).order("created_at", { ascending: false }),
    db.from("tasks").select("id, title, assignee_id, due_date, recurrence, spawned_from_id, edited_at, completed_at").eq("household_id", householdId).is("deleted_at", null),
    db.from("events").select("id, title, date, time, prep_note, attendee_id, created_by").eq("household_id", householdId).is("deleted_at", null),
  ]);
  const failed = shopping.error ?? tasks.error ?? events.error;
  if (failed) throw failed;
  return {
    shopping: ((shopping.data ?? []) as ShoppingRow[]).map(fromShoppingRow),
    tasks: (tasks.data ?? []).map(
      (row): Task => ({
        id: row.id,
        title: row.title,
        assigneeId: row.assignee_id,
        dueDate: row.due_date,
        recurrence: row.recurrence,
        spawnedFromId: row.spawned_from_id,
        editedAt: row.edited_at,
        completedAt: row.completed_at,
      }),
    ),
    events: (events.data ?? []).map(
      (row): HouseEvent => ({
        id: row.id,
        title: row.title,
        date: row.date,
        // Postgres sends "19:30:00"; the app shows and edits "19:30".
        time: row.time ? String(row.time).slice(0, 5) : null,
        prep: row.prep_note,
        attendeeId: row.attendee_id,
        createdBy: row.created_by,
      }),
    ),
  };
}

const TRIPS_KEPT = 60;

type TripRow = { id: string; finished_at: string; finished_by: string | null; undone_at: string | null; items: unknown; missing: unknown };

function fromTripRow(row: TripRow): ShoppingTrip {
  const lines = Array.isArray(row.items) ? (row.items as Record<string, unknown>[]) : [];
  const missing = Array.isArray(row.missing) ? (row.missing as Record<string, unknown>[]) : [];
  return {
    id: row.id,
    finishedAt: row.finished_at,
    finishedBy: row.finished_by,
    undoneAt: row.undone_at,
    items: lines.map(
      (line): TripLine => ({
        itemId: String(line.item_id ?? ""),
        name: String(line.name ?? ""),
        quantity: toNumber(line.quantity),
        unit: isUnit(line.unit) ? line.unit : null,
        note: typeof line.note === "string" ? line.note : null,
        category: isAisle(line.category) ? line.category : null,
        checkedBy: typeof line.checked_by === "string" ? line.checked_by : null,
      }),
    ),
    missing: missing.map((line) => ({ itemId: String(line.item_id ?? ""), name: String(line.name ?? "") })),
  };
}

const groupLines = (value: unknown): GroupLine[] =>
  (Array.isArray(value) ? (value as Record<string, unknown>[]) : [])
    .filter((line) => typeof line.name === "string" && line.name.trim())
    .map((line) => ({
      name: String(line.name).trim(),
      quantity: toNumber(line.quantity),
      unit: isUnit(line.unit) ? line.unit : null,
      note: typeof line.note === "string" && line.note.trim() ? line.note.trim() : null,
    }));

export type ShoppingExtras = {
  trips: ShoppingTrip[];
  products: ProductMemo[];
  keptApart: string[];
  groups: ShoppingGroup[];
};

/** The house's shopping history and habits. Throws when it can't be read, so what's on screen stays. */
export async function loadShoppingExtras(householdId: string): Promise<ShoppingExtras> {
  const db = createBrowserSupabase();
  const [trips, products, kept, groups] = await Promise.all([
    db.from("shopping_trips").select("id, finished_at, finished_by, undone_at, items, missing").eq("household_id", householdId).order("finished_at", { ascending: false }).limit(TRIPS_KEPT),
    db.from("shopping_products").select("item_key, name, staple, quantity, unit, note, renamed_to, dismissed_until").eq("household_id", householdId),
    db.from("shopping_kept_apart").select("pair_key").eq("household_id", householdId),
    db.from("shopping_groups").select("id, name, items").eq("household_id", householdId).order("created_at"),
  ]);
  const failed = trips.error ?? products.error ?? kept.error ?? groups.error;
  if (failed) throw failed;
  return {
    trips: ((trips.data ?? []) as TripRow[]).map(fromTripRow),
    products: (products.data ?? []).map((row) => ({
      key: row.item_key,
      name: row.name,
      staple: row.staple,
      quantity: toNumber(row.quantity),
      unit: isUnit(row.unit) ? row.unit : null,
      note: row.note,
      renamedTo: row.renamed_to,
      dismissedUntil: row.dismissed_until,
    })),
    keptApart: (kept.data ?? []).map((row) => row.pair_key),
    groups: (groups.data ?? []).map((row) => ({ id: row.id, name: row.name, items: groupLines(row.items) })),
  };
}

/**
 * Calls onChange whenever the other parent (or this one, on another device) changes a list,
 * and once more after every (re)connect, since changes made while disconnected are never replayed.
 */
export function watchHouseholdLists(
  householdId: string,
  {
    onChange,
    onExtras,
    knowsShoppingItem,
  }: { onChange: () => void; onExtras: () => void; knowsShoppingItem: (id: string) => boolean },
) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const house = `household_id=eq.${householdId}`;
  const channel = db
    .channel(`house-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: house }, onChange)
    // Postgres can't filter deletes, so they arrive for every house; only reload for items on this list.
    .on("postgres_changes", { event: "DELETE", schema: "public", table: "shopping_items" }, (payload) => {
      const id = (payload.old as { id?: string }).id;
      if (id && knowsShoppingItem(id)) onChange();
    })
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: house }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: house }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_trips", filter: house }, onExtras)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_products", filter: house }, onExtras)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_kept_apart", filter: house }, onExtras)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_groups", filter: house }, onExtras)
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        onChange();
        onExtras();
      }
    });
  return () => {
    void db.removeChannel(channel);
  };
}

/** The roster changes when the invited parent joins. Its own channel, so a project without 0003 keeps list sync. */
export function watchHouseholdMembers(householdId: string, onChange: () => void) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const channel = db
    .channel(`members-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "household_members", filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

/** Where this house puts each product it has bought before, by item key. Empty when it can't be read. */
export async function loadAisleMemory(householdId: string): Promise<Record<string, Aisle>> {
  const { data, error } = await createBrowserSupabase()
    .from("shopping_categories")
    .select("item_key, category")
    .eq("household_id", householdId);
  if (error) return {};
  return Object.fromEntries((data ?? []).flatMap((row) => (isAisle(row.category) ? [[row.item_key, row.category]] : [])));
}

/** A parent put a product in an aisle: from now on it goes there, for both of them. */
export async function rememberAisle(householdId: string, key: string, aisle: Aisle) {
  if (!supabaseConfigured()) return;
  await createBrowserSupabase()
    .from("shopping_categories")
    .upsert(
      { household_id: householdId, item_key: key, category: aisle, source: "user", updated_at: new Date().toISOString() },
      { onConflict: "household_id,item_key" },
    );
}

/** Asks the server (the house's memory, then the AI) where these products go. Missing names stay unplaced. */
export async function askAisles(names: string[]): Promise<Record<string, Aisle>> {
  if (!supabaseConfigured() || names.length === 0) return {};
  const response = await fetch("/api/shopping/aisles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ names }),
  });
  if (!response.ok) return {};
  const body = (await response.json().catch(() => ({}))) as { aisles?: Record<string, unknown> };
  return Object.fromEntries(Object.entries(body.aisles ?? {}).filter((entry): entry is [string, Aisle] => isAisle(entry[1])));
}

/**
 * Direct writes for the house's habits: they need a connection, and resolve false when they didn't land,
 * so the screen can put things back. Without Supabase (the demo) they stay on this phone and count as saved.
 */
async function write(run: (db: ReturnType<typeof createBrowserSupabase>) => PromiseLike<{ error: unknown }>) {
  if (!supabaseConfigured()) return true;
  try {
    const { error } = await run(createBrowserSupabase());
    return !error;
  } catch {
    return false;
  }
}

export const saveProduct = (householdId: string, memo: ProductMemo) =>
  write((db) =>
    db.from("shopping_products").upsert(
      {
        household_id: householdId,
        item_key: memo.key,
        name: memo.name,
        staple: memo.staple,
        quantity: memo.quantity,
        unit: memo.unit,
        note: memo.note,
        renamed_to: memo.renamedTo,
        dismissed_until: memo.dismissedUntil,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,item_key" },
    ),
  );

export const keepApartOnServer = (householdId: string, pairKey: string) =>
  write((db) => db.from("shopping_kept_apart").upsert({ household_id: householdId, pair_key: pairKey }, { onConflict: "household_id,pair_key", ignoreDuplicates: true }));

export const saveGroup = (householdId: string, userId: string, group: ShoppingGroup, isNew: boolean) =>
  write((db) =>
    isNew
      ? db.from("shopping_groups").insert({ id: group.id, household_id: householdId, name: group.name, items: group.items, created_by: userId })
      : db.from("shopping_groups").update({ name: group.name, items: group.items, updated_at: new Date().toISOString() }).eq("id", group.id),
  );

export const removeGroup = (id: string) => write((db) => db.from("shopping_groups").delete().eq("id", id));

/** Puts a finished trip's items back on the list. Needs a connection; false when it didn't happen. */
export async function undoTripOnServer(tripId: string): Promise<boolean> {
  if (!supabaseConfigured()) return true;
  try {
    const result = await createBrowserSupabase().rpc("undo_shopping_trip", { trip: tripId });
    check(result);
    return (result.data as { status?: string } | null)?.status === "done";
  } catch {
    return false;
  }
}

/** Each change goes through the outbox: saved in order, kept while offline. Resolves true once it's on the server. */
export const saveShoppingItem = (item: ShoppingItem) => enqueue({ table: "shopping_items", action: "save", id: item.id, row: item });
export const removeShoppingItem = (id: string, holdMs = 0) => enqueue({ table: "shopping_items", action: "remove", id }, holdMs);
export const finishTripOnServer = (tripId: string, itemIds: string[]) => enqueue({ table: "shopping_trips", action: "finish", id: tripId, itemIds });
export const saveTask = (task: Task) => enqueue({ table: "tasks", action: "save", id: task.id, row: task });
export const removeTask = (id: string) => enqueue({ table: "tasks", action: "remove", id });
export const saveEvent = (event: HouseEvent) => enqueue({ table: "events", action: "save", id: event.id, row: event });
export const removeEvent = (id: string) => enqueue({ table: "events", action: "remove", id });
