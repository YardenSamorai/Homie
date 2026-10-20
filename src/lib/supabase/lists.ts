"use client";

import { useAuth } from "@/lib/auth/session";
import type { HouseEvent, ShoppingItem } from "@/lib/household";
import type { Task } from "@/lib/tasks";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

function remote() {
  if (!supabaseConfigured()) return null;
  const session = useAuth.getState().session;
  if (!session?.householdId || !session.userId) return null;
  return { db: createBrowserSupabase(), householdId: session.householdId, userId: session.userId };
}

export async function loadHouseholdLists(householdId: string) {
  const db = createBrowserSupabase();
  const [shopping, tasks, events] = await Promise.all([
    db.from("shopping_items").select("id, name, quantity_note, added_by, checked_at, created_at").eq("household_id", householdId).order("created_at", { ascending: false }),
    db.from("tasks").select("id, title, assignee_id, due_date, recurrence, spawned_from_id, edited_at, completed_at").eq("household_id", householdId).is("deleted_at", null),
    db.from("events").select("id, title, date, time, prep_note, created_by").eq("household_id", householdId).is("deleted_at", null),
  ]);
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

export function watchHouseholdLists(householdId: string, onChange: () => void) {
  if (!supabaseConfigured()) return () => {};
  const db = createBrowserSupabase();
  const channel = db
    .channel(`house-${householdId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "shopping_items", filter: `household_id=eq.${householdId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter: `household_id=eq.${householdId}` }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "events", filter: `household_id=eq.${householdId}` }, onChange)
    .subscribe();
  return () => {
    void db.removeChannel(channel);
  };
}

export async function saveShoppingItem(item: ShoppingItem) {
  const ctx = remote();
  if (!ctx) return;
  await ctx.db.from("shopping_items").upsert({
    id: item.id,
    household_id: ctx.householdId,
    name: item.name,
    quantity_note: item.note,
    checked_at: item.checkedAt,
    added_by: item.addedBy,
  });
}

export async function removeShoppingItem(id: string) {
  const ctx = remote();
  if (!ctx) return;
  await ctx.db.from("shopping_items").delete().eq("id", id);
}

export async function saveTask(task: Task) {
  const ctx = remote();
  if (!ctx) return;
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
  if (updated.data && updated.data.length > 0) return;
  await ctx.db.from("tasks").insert({
    ...fields,
    id: task.id,
    household_id: ctx.householdId,
    created_by: ctx.userId,
  });
}

export async function removeTask(id: string) {
  const ctx = remote();
  if (!ctx) return;
  await ctx.db.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}

export async function saveEvent(event: HouseEvent) {
  const ctx = remote();
  if (!ctx) return;
  const fields = { title: event.title, date: event.date, time: event.time, prep_note: event.prep };
  const updated = await ctx.db.from("events").update(fields).eq("id", event.id).select("id");
  if (updated.data && updated.data.length > 0) return;
  await ctx.db.from("events").insert({
    ...fields,
    id: event.id,
    household_id: ctx.householdId,
    created_by: event.createdBy,
  });
}

export async function removeEvent(id: string) {
  const ctx = remote();
  if (!ctx) return;
  await ctx.db.from("events").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}
