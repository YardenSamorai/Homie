"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth } from "@/lib/auth/session";
import type { HouseEvent, ShoppingItem } from "@/lib/household";
import type { Task } from "@/lib/tasks";
import { createBrowserSupabase } from "./browser";
import { supabaseConfigured } from "./env";

/**
 * SPEC §7.2–7.3: every change lands here first and is sent in order. Without a connection it waits
 * (and survives closing the app); when the server refuses it, the row says so and offers a retry.
 * Several changes to the same row collapse into the latest one: the last change wins.
 */
export type Op =
  | { table: "tasks"; action: "save"; id: string; row: Task }
  | { table: "shopping_items"; action: "save"; id: string; row: ShoppingItem }
  | { table: "events"; action: "save"; id: string; row: HouseEvent }
  | { table: "tasks" | "shopping_items" | "events"; action: "remove"; id: string };

type Queued = Op & { householdId: string; userId: string; state: "waiting" | "failed" };

type OutboxState = {
  queue: Queued[];
  put: (op: Queued) => void;
  done: (id: string) => void;
  mark: (id: string, state: Queued["state"]) => void;
};

export const useOutbox = create<OutboxState>()(
  persist(
    (set) => ({
      queue: [],
      put: (op) =>
        set(({ queue }) => {
          const at = queue.findIndex((item) => item.id === op.id);
          if (at === -1) return { queue: [...queue, op] };
          const next = [...queue];
          next[at] = op;
          return { queue: next };
        }),
      done: (id) => set(({ queue }) => ({ queue: queue.filter((item) => item.id !== id) })),
      mark: (id, state) => set(({ queue }) => ({ queue: queue.map((item) => (item.id === id ? { ...item, state } : item)) })),
    }),
    { name: "homie-outbox", skipHydration: true },
  ),
);

/** Whether a row still has a change on its way, or one the server refused. */
export const useRowState = (id: string) => useOutbox((s) => s.queue.find((item) => item.id === id)?.state ?? null);

class Offline extends Error {}

type Result = { error: { message?: string; code?: string } | null; status?: number };

/** No connection (retry by itself later) versus the server saying no (show it on the row). */
function check({ error, status }: Result) {
  if (!error) return;
  const network = status === 0 || /fetch|network|load failed|timed? ?out/i.test(error.message ?? "");
  if (network || (typeof navigator !== "undefined" && !navigator.onLine) || status === 401 || (status ?? 0) >= 500) throw new Offline();
  throw error;
}

async function send(op: Queued) {
  const db = createBrowserSupabase();
  if (op.action === "remove") {
    const query =
      op.table === "shopping_items"
        ? db.from(op.table).delete().eq("id", op.id)
        : db.from(op.table).update({ deleted_at: new Date().toISOString() }).eq("id", op.id);
    return check(await query);
  }
  // Update first: the insert policies only accept rows the signed-in parent created, so an upsert of the partner's row fails.
  if (op.table === "tasks") {
    const task = op.row;
    const fields = {
      title: task.title,
      assignee_id: task.assigneeId,
      due_date: task.dueDate,
      recurrence: task.recurrence,
      spawned_from_id: task.spawnedFromId,
      edited_at: task.editedAt,
      completed_at: task.completedAt,
    };
    const updated = await db.from("tasks").update(fields).eq("id", task.id).select("id");
    check(updated);
    if (updated.data?.length) return;
    return check(await db.from("tasks").insert({ ...fields, id: task.id, household_id: op.householdId, created_by: op.userId }));
  }
  if (op.table === "shopping_items") {
    const item = op.row;
    const fields = { name: item.name, quantity_note: item.note, checked_at: item.checkedAt };
    const updated = await db.from("shopping_items").update(fields).eq("id", item.id).select("id");
    check(updated);
    if (updated.data?.length) return;
    return check(await db.from("shopping_items").insert({ ...fields, id: item.id, household_id: op.householdId, added_by: item.addedBy }));
  }
  const event = op.row;
  const fields = { title: event.title, date: event.date, time: event.time, prep_note: event.prep };
  const updated = await db.from("events").update(fields).eq("id", event.id).select("id");
  check(updated);
  if (updated.data?.length) return;
  return check(await db.from("events").insert({ ...fields, id: event.id, household_id: op.householdId, created_by: event.createdBy }));
}

/** Waiting for each row's change to land: true once saved, false if the server refused it. */
const waiters = new Map<string, Array<(saved: boolean) => void>>();
const settle = (id: string, saved: boolean) => {
  waiters.get(id)?.forEach((resolve) => resolve(saved));
  waiters.delete(id);
};

let flushing = false;
let inFlight = 0;

/** Sends what's waiting, oldest first; stops at the first sign of no connection and tries again later. */
export async function flush() {
  if (flushing || !supabaseConfigured()) return;
  flushing = true;
  try {
    const session = useAuth.getState().session;
    for (;;) {
      const op = useOutbox.getState().queue.find((item) => item.state === "waiting");
      if (!op) break;
      // Queued under another account or house (signed out, removed): it can never be sent from here.
      if (op.userId !== session?.userId || op.householdId !== session?.householdId) {
        useOutbox.getState().done(op.id);
        settle(op.id, false);
        continue;
      }
      inFlight += 1;
      try {
        await send(op);
        // A newer change to the same row may have arrived while this one was on its way; it goes next.
        const current = useOutbox.getState().queue.find((item) => item.id === op.id);
        if (current === op) {
          useOutbox.getState().done(op.id);
          settle(op.id, true);
        }
      } catch (error) {
        if (error instanceof Offline) break;
        useOutbox.getState().mark(op.id, "failed");
        settle(op.id, false);
      } finally {
        inFlight -= 1;
      }
    }
  } finally {
    flushing = false;
  }
}

/** Queues a change and starts sending. Resolves when it's saved (possibly much later) or refused. */
export function enqueue(op: Op): Promise<boolean> {
  const session = useAuth.getState().session;
  if (!supabaseConfigured() || !session?.householdId || !session.userId) return Promise.resolve(false);
  const queued = { ...op, householdId: session.householdId, userId: session.userId, state: "waiting" } as Queued;
  useOutbox.getState().put(queued);
  const promise = new Promise<boolean>((resolve) => waiters.set(op.id, [...(waiters.get(op.id) ?? []), resolve]));
  void flush();
  return promise;
}

export function retry(id: string) {
  useOutbox.getState().mark(id, "waiting");
  void flush();
}

/** True while something is being sent right now: a reload that started before it may be stale. */
export const sending = () => inFlight > 0;

/** Server lists with this phone's unsent changes laid on top, so a reload never undoes them. */
export function withPending<T extends { tasks: Task[]; shopping: ShoppingItem[]; events: HouseEvent[] }>(lists: T): T {
  const queue = useOutbox.getState().queue;
  if (queue.length === 0) return lists;
  const lay = <R extends { id: string }>(rows: R[], table: Op["table"]) => {
    let next = rows;
    for (const op of queue) {
      if (op.table !== table) continue;
      if (op.action === "remove") next = next.filter((row) => row.id !== op.id);
      else {
        const row = op.row as unknown as R;
        if (next.some((known) => known.id === op.id)) next = next.map((known) => (known.id === op.id ? row : known));
        // The shopping list shows the newest first; the others sort themselves.
        else next = table === "shopping_items" ? [row, ...next] : [...next, row];
      }
    }
    return next;
  };
  return { ...lists, tasks: lay(lists.tasks, "tasks"), shopping: lay(lists.shopping, "shopping_items"), events: lay(lists.events, "events") };
}

/** Once per app start: load what was waiting when the app closed, and keep sending as the connection comes and goes. */
export function startOutbox() {
  void Promise.resolve(useOutbox.persist.rehydrate()).then(() => flush());
  const kick = () => void flush();
  window.addEventListener("online", kick);
  document.addEventListener("visibilitychange", kick);
  // A connection that comes back without an "online" event (a captive portal, a flaky signal).
  const timer = window.setInterval(() => {
    if (useOutbox.getState().queue.some((item) => item.state === "waiting")) kick();
  }, 15_000);
  return () => {
    window.removeEventListener("online", kick);
    document.removeEventListener("visibilitychange", kick);
    window.clearInterval(timer);
  };
}
