"use client";

import { isAisle, type Aisle } from "@/lib/aisles";
import type { HouseEvent, ShoppingItem } from "@/lib/household";
import type { Task } from "@/lib/tasks";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";
import { enqueue } from "./outbox";

/** Throws when any list fails to load, so a dropped connection never empties the screen. */
export async function loadHouseholdLists(householdId: string) {
  const db = createBrowserSupabase();
  const [shopping, tasks, events] = await Promise.all([
    db.from("shopping_items").select("id, name, quantity_note, photo_path, category, added_by, checked_at, created_at").eq("household_id", householdId).order("created_at", { ascending: false }),
    db.from("tasks").select("id, title, assignee_id, due_date, recurrence, spawned_from_id, edited_at, completed_at").eq("household_id", householdId).is("deleted_at", null),
    db.from("events").select("id, title, date, time, prep_note, attendee_id, created_by").eq("household_id", householdId).is("deleted_at", null),
  ]);
  const failed = shopping.error ?? tasks.error ?? events.error;
  if (failed) throw failed;
  return {
    shopping: (shopping.data ?? []).map(
      (row): ShoppingItem => ({
        id: row.id,
        name: row.name,
        note: row.quantity_note,
        photoPath: row.photo_path,
        category: isAisle(row.category) ? row.category : null,
        addedBy: row.added_by,
        checkedAt: row.checked_at,
      }),
    ),
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

/**
 * Calls onChange whenever the other parent (or this one, on another device) changes a list,
 * and once more after every (re)connect, since changes made while disconnected are never replayed.
 */
export function watchHouseholdLists(
  householdId: string,
  { onChange, knowsShoppingItem }: { onChange: () => void; knowsShoppingItem: (id: string) => boolean },
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
    .subscribe((status) => {
      if (status === "SUBSCRIBED") onChange();
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

/** Each change goes through the outbox: saved in order, kept while offline. Resolves true once it's on the server. */
export const saveShoppingItem = (item: ShoppingItem) => enqueue({ table: "shopping_items", action: "save", id: item.id, row: item });
export const removeShoppingItem = (id: string, holdMs = 0) => enqueue({ table: "shopping_items", action: "remove", id }, holdMs);
export const saveTask = (task: Task) => enqueue({ table: "tasks", action: "save", id: task.id, row: task });
export const removeTask = (id: string) => enqueue({ table: "tasks", action: "remove", id });
export const saveEvent = (event: HouseEvent) => enqueue({ table: "events", action: "save", id: event.id, row: event });
export const removeEvent = (id: string) => enqueue({ table: "events", action: "remove", id });
