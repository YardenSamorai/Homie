"use client";

import type { HouseEvent, ShoppingItem } from "@/lib/household";
import type { Task } from "@/lib/tasks";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";
import { enqueue } from "./outbox";

/** Throws when any list fails to load, so a dropped connection never empties the screen. */
export async function loadHouseholdLists(householdId: string) {
  const db = createBrowserSupabase();
  const [shopping, tasks, events] = await Promise.all([
    db.from("shopping_items").select("id, name, quantity_note, added_by, checked_at, created_at").eq("household_id", householdId).order("created_at", { ascending: false }),
    db.from("tasks").select("id, title, assignee_id, due_date, recurrence, spawned_from_id, edited_at, completed_at").eq("household_id", householdId).is("deleted_at", null),
    db.from("events").select("id, title, date, time, prep_note, created_by").eq("household_id", householdId).is("deleted_at", null),
  ]);
  const failed = shopping.error ?? tasks.error ?? events.error;
  if (failed) throw failed;
  return {
    shopping: (shopping.data ?? []).map(
      (row): ShoppingItem => ({
        id: row.id,
        name: row.name,
        note: row.quantity_note,
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

/** Each change goes through the outbox: saved in order, kept while offline. Resolves true once it's on the server. */
export const saveShoppingItem = (item: ShoppingItem) => enqueue({ table: "shopping_items", action: "save", id: item.id, row: item });
export const removeShoppingItem = (id: string) => enqueue({ table: "shopping_items", action: "remove", id });
export const saveTask = (task: Task) => enqueue({ table: "tasks", action: "save", id: task.id, row: task });
export const removeTask = (id: string) => enqueue({ table: "tasks", action: "remove", id });
export const saveEvent = (event: HouseEvent) => enqueue({ table: "events", action: "save", id: event.id, row: event });
export const removeEvent = (id: string) => enqueue({ table: "events", action: "remove", id });
