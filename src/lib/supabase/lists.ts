"use client";

import { useAuth } from "@/lib/auth/session";
import type { HouseEvent, ShoppingItem } from "@/lib/household";
import type { Task } from "@/lib/tasks";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

type Remote = { db: ReturnType<typeof createBrowserSupabase>; householdId: string; userId: string };

function remote(): Remote | null {
  if (!supabaseConfigured()) return null;
  const session = useAuth.getState().session;
  if (!session?.householdId || !session.userId) return null;
  return { db: createBrowserSupabase(), householdId: session.householdId, userId: session.userId };
}

let pending = 0;
let settled: Array<() => void> = [];

/** Every write goes through here, so a reload never lands on top of a change that is still saving. Resolves false if it didn't save. */
function write(work: (ctx: Remote) => Promise<unknown>): Promise<boolean> {
  const ctx = remote();
  if (!ctx) return Promise.resolve(false);
  pending += 1;
  return work(ctx)
    .then(() => true)
    .catch(() => false)
    .finally(() => {
      pending -= 1;
      if (pending === 0) {
        const waiting = settled;
        settled = [];
        waiting.forEach((resolve) => resolve());
      }
    });
}

/** Supabase reports failures in the result rather than throwing. */
async function saved(query: PromiseLike<{ error: unknown }>) {
  const { error } = await query;
  if (error) throw error;
}

export const writesPending = () => pending > 0;
export const writesSettled = () => (pending === 0 ? Promise.resolve() : new Promise<void>((resolve) => settled.push(resolve)));

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
        time: row.time,
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

/** Update first: the insert policy only accepts rows added by the signed-in parent, so an upsert of the partner's item fails. */
export function saveShoppingItem(item: ShoppingItem) {
  return write(async (ctx) => {
    const fields = { name: item.name, quantity_note: item.note, checked_at: item.checkedAt };
    const updated = await ctx.db.from("shopping_items").update(fields).eq("id", item.id).select("id");
    if (updated.error) throw updated.error;
    if (updated.data.length > 0) return;
    await saved(ctx.db.from("shopping_items").insert({ ...fields, id: item.id, household_id: ctx.householdId, added_by: item.addedBy }));
  });
}

export function removeShoppingItem(id: string) {
  return write((ctx) => saved(ctx.db.from("shopping_items").delete().eq("id", id)));
}

export function saveTask(task: Task) {
  return write(async (ctx) => {
    const fields = {
      title: task.title,
      assignee_id: task.assigneeId,
      due_date: task.dueDate,
      recurrence: task.recurrence,
      spawned_from_id: task.spawnedFromId,
      edited_at: task.editedAt,
      completed_at: task.completedAt,
    };
    const updated = await ctx.db.from("tasks").update(fields).eq("id", task.id).select("id");
    if (updated.error) throw updated.error;
    if (updated.data.length > 0) return;
    await saved(ctx.db.from("tasks").insert({ ...fields, id: task.id, household_id: ctx.householdId, created_by: ctx.userId }));
  });
}

export function removeTask(id: string) {
  return write((ctx) => saved(ctx.db.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id)));
}

export function saveEvent(event: HouseEvent) {
  return write(async (ctx) => {
    const fields = { title: event.title, date: event.date, time: event.time, prep_note: event.prep };
    const updated = await ctx.db.from("events").update(fields).eq("id", event.id).select("id");
    if (updated.error) throw updated.error;
    if (updated.data.length > 0) return;
    await saved(ctx.db.from("events").insert({ ...fields, id: event.id, household_id: ctx.householdId, created_by: event.createdBy }));
  });
}

export function removeEvent(id: string) {
  return write((ctx) => saved(ctx.db.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id)));
}
