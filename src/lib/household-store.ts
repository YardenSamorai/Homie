"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth } from "./auth/session";
import { addDays, type DayKey } from "./dates";
import { itemKey } from "./groceries";
import type { HouseEvent, ShoppingItem } from "./household";
import { completeTask, uncompleteTask, type Member, type Task } from "./tasks";
import { announce } from "./supabase/activity";
import { compressImage, removeShoppingPhoto, uploadShoppingPhoto } from "./supabase/media";
import { removeEvent, removeShoppingItem, removeTask, saveEvent, saveShoppingItem, saveTask } from "./supabase/lists";

type NewTask = Pick<Task, "title" | "assigneeId" | "dueDate" | "recurrence">;
export type NewShoppingItem = Pick<ShoppingItem, "name" | "note"> & { photo?: File | null };
/** What adding did: a new row, or the same item found already on the list (still to buy, or back from the cart). */
export type AddedItem = { id: string; outcome: "added" | "exists" | "restored"; noteChanged: boolean };
/** A removed row and where it stood, so an undo puts it back in place. */
export type RemovedItem = { item: ShoppingItem; at: number };

/** Removals wait this long before leaving the phone, longer than the undo toast stays. */
const UNDO_HOLD_MS = 5000;
type NewEvent = Pick<HouseEvent, "title" | "date" | "time" | "prep" | "attendeeId">;

/** SPEC §8: first parent indigo, second pink. */
export const MEMBER_COLORS = ["var(--indigo)", "var(--pink)"] as const;

type HouseholdState = {
  currentUserId: string;
  members: Member[];
  tasks: Task[];
  shopping: ShoppingItem[];
  events: HouseEvent[];
  syncSelf: (self: Member | null) => void;
  setRoster: (currentUserId: string, members: Member[]) => void;
  setMemberPhoto: (id: string, photoPath: string | null, photo: string | null) => void;
  replaceLists: (lists: { tasks: Task[]; shopping: ShoppingItem[]; events: HouseEvent[] }) => void;
  toggleTask: (task: Task, today: DayKey) => void;
  addTask: (task: NewTask) => void;
  updateTask: (id: string, patch: NewTask) => void;
  /** Moves an overdue task to tomorrow. It stays open. */
  postponeTask: (id: string, today: DayKey) => void;
  deleteTask: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  clearBought: () => RemovedItem[];
  addShoppingItem: (item: NewShoppingItem) => AddedItem;
  updateShoppingItem: (id: string, patch: NewShoppingItem) => void;
  deleteShoppingItem: (id: string) => RemovedItem | null;
  restoreShoppingItems: (removed: RemovedItem[]) => void;
  addEvent: (event: NewEvent) => void;
  updateEvent: (id: string, patch: NewEvent) => void;
  deleteEvent: (id: string) => void;
};

const now = () => new Date().toISOString();

/**
 * The household's lists on this device: changes apply here first, then go out through the outbox;
 * HouseholdSync keeps them live. Kept on the phone too, so the app opens on the last lists even offline.
 */
export const useHousehold = create<HouseholdState>()(
  persist(
    (set, get) => ({
      currentUserId: "",
      members: [],
      tasks: [],
      shopping: [],
      events: [],

      syncSelf: (self) =>
        set({
          currentUserId: self?.id ?? "",
          members: self ? [self] : [],
          tasks: [],
          shopping: [],
          events: [],
        }),

      setRoster: (currentUserId, members) => set({ currentUserId, members }),

      setMemberPhoto: (id, photoPath, photo) =>
        set(({ members }) => ({ members: members.map((member) => (member.id === id ? { ...member, photoPath, photo } : member)) })),

      replaceLists: (lists) => set(lists),

      toggleTask: (task, today) => {
        const previous = get().tasks;
        const tasks = task.completedAt
          ? uncompleteTask(previous, task.id)
          : completeTask(previous, task.id, today, now(), crypto.randomUUID());
        set({ tasks });
        // Unchanged tasks keep their identity; resaving them would overwrite the partner's newer edits.
        const before = new Map(previous.map((item) => [item.id, item]));
        const kept = new Set(tasks.map((item) => item.id));
        for (const item of tasks) {
          if (before.get(item.id) === item) continue;
          const save = saveTask(item);
          if (item.id === task.id && item.completedAt) void save.then((ok) => ok && announce("task_done", item.id, item.title));
        }
        for (const item of previous) if (!kept.has(item.id)) void removeTask(item.id);
      },

      addTask: (task) => {
        const created: Task = { ...task, id: crypto.randomUUID(), spawnedFromId: null, editedAt: null, completedAt: null };
        set(({ tasks }) => ({ tasks: [...tasks, created] }));
        const kind = created.assigneeId !== get().currentUserId ? "task_assigned" : "task_added";
        void saveTask(created).then((ok) => ok && announce(kind, created.id, created.title));
      },

      updateTask: (id, patch) => {
        const before = get().tasks.find((task) => task.id === id);
        const tasks = get().tasks.map((task) => (task.id === id ? { ...task, ...patch, editedAt: now() } : task));
        set({ tasks });
        const updated = tasks.find((task) => task.id === id);
        if (!updated) return;
        const save = saveTask(updated);
        // Handed to the other parent: they hear about it, as if it were new to them.
        const handedOver = before && before.assigneeId !== updated.assigneeId && updated.assigneeId !== get().currentUserId;
        if (handedOver) void save.then((ok) => ok && announce("task_assigned", updated.id, updated.title));
      },

      postponeTask: (id, today) => {
        const task = get().tasks.find((item) => item.id === id);
        if (!task?.dueDate || task.dueDate >= today || task.completedAt) return;
        get().updateTask(id, {
          title: task.title,
          assigneeId: task.assigneeId,
          dueDate: addDays(today, 1),
          recurrence: task.recurrence,
        });
      },

      deleteTask: (id) => {
        set(({ tasks }) => ({ tasks: tasks.filter((task) => task.id !== id) }));
        void removeTask(id);
      },

      toggleShoppingItem: (id) => {
        const shopping = get().shopping.map((item) =>
          item.id === id ? { ...item, checkedAt: item.checkedAt ? null : now() } : item,
        );
        set({ shopping });
        const updated = shopping.find((item) => item.id === id);
        if (!updated) return;
        const save = saveShoppingItem(updated);
        if (updated.checkedAt) void save.then((ok) => ok && announce("shopping_bought", updated.id, updated.name));
      },

      clearBought: () => {
        const removed = get()
          .shopping.map((item, at) => ({ item, at }))
          .filter(({ item }) => item.checkedAt);
        set(({ shopping }) => ({ shopping: shopping.filter((item) => !item.checkedAt) }));
        for (const { item } of removed) dropShoppingItem(item);
        return removed;
      },

      addShoppingItem: (item) => {
        const key = itemKey(item.name);
        const match = get().shopping.find((row) => itemKey(row.name) === key);
        if (match) {
          const noteChanged = item.note !== null && item.note !== match.note;
          const back = match.checkedAt !== null;
          if (noteChanged || back || item.photo) {
            const next: ShoppingItem = { ...match, note: noteChanged ? item.note : match.note, checkedAt: null };
            set(({ shopping }) => ({ shopping: shopping.map((row) => (row.id === match.id ? next : row)) }));
            const save = saveItemWithPhoto(next, item.photo);
            if (back) void save.then((ok) => ok && announce("shopping_added", next.id, next.name));
          }
          return { id: match.id, outcome: back ? "restored" : "exists", noteChanged };
        }
        const created: ShoppingItem = {
          id: crypto.randomUUID(),
          name: item.name,
          note: item.note,
          photoPath: null,
          addedBy: get().currentUserId,
          checkedAt: null,
        };
        set(({ shopping }) => ({ shopping: [created, ...shopping] }));
        void saveItemWithPhoto(created, item.photo).then((ok) => ok && announce("shopping_added", created.id, created.name));
        return { id: created.id, outcome: "added", noteChanged: false };
      },

      updateShoppingItem: (id, patch) => {
        const before = get().shopping.find((item) => item.id === id);
        if (!before) return;
        const next: ShoppingItem = { ...before, name: patch.name, note: patch.note };
        set(({ shopping }) => ({ shopping: shopping.map((item) => (item.id === id ? next : item)) }));
        void saveItemWithPhoto(next, patch.photo, patch.photo !== undefined);
      },

      deleteShoppingItem: (id) => {
        const at = get().shopping.findIndex((item) => item.id === id);
        if (at === -1) return null;
        const item = get().shopping[at];
        set(({ shopping }) => ({ shopping: shopping.filter((row) => row.id !== id) }));
        dropShoppingItem(item);
        return { item, at };
      },

      restoreShoppingItems: (removed) => {
        const shopping = [...get().shopping];
        for (const { item, at } of [...removed].sort((a, b) => a.at - b.at)) {
          if (shopping.some((row) => row.id === item.id)) continue;
          shopping.splice(Math.min(at, shopping.length), 0, item);
          // Replaces the removal still waiting in the outbox, so the row never leaves the server.
          void saveShoppingItem(item);
        }
        set({ shopping });
      },

      addEvent: (event) => {
        const created: HouseEvent = { ...event, id: crypto.randomUUID(), createdBy: get().currentUserId };
        set(({ events }) => ({ events: [...events, created] }));
        void saveEvent(created).then((ok) => ok && announce("event_added", created.id, created.title));
      },

      updateEvent: (id, patch) => {
        const events = get().events.map((event) => (event.id === id ? { ...event, ...patch } : event));
        set({ events });
        const updated = events.find((event) => event.id === id);
        if (updated) void saveEvent(updated);
      },

      deleteEvent: (id) => {
        set(({ events }) => ({ events: events.filter((event) => event.id !== id) }));
        void removeEvent(id);
      },
    }),
    {
      name: "homie-house",
      // Read after the first paint (HouseholdSync), so the server's empty first render matches the client's.
      skipHydration: true,
      partialize: ({ currentUserId, members, tasks, shopping, events }) => ({ currentUserId, members, tasks, shopping, events }),
    },
  ),
);

export type AddKind = "task" | "shopping" | "event";
export type EditTarget = { kind: AddKind; id: string };

type AddSheetState = {
  open: boolean;
  kind: AddKind;
  /** Day the new task or event defaults to. */
  day: DayKey | null;
  edit: EditTarget | null;
  show: (kind: AddKind, day?: DayKey | null) => void;
  showEdit: (target: EditTarget) => void;
  setOpen: (open: boolean) => void;
  setKind: (kind: AddKind) => void;
};

export const useAddSheet = create<AddSheetState>()((set) => ({
  open: false,
  kind: "task",
  day: null,
  edit: null,
  show: (kind, day = null) => set({ open: true, kind, day, edit: null }),
  showEdit: (edit) => set({ open: true, kind: edit.kind, day: null, edit }),
  setOpen: (open) => set(open ? { open } : { open: false, edit: null }),
  setKind: (kind) => set({ kind }),
}));

/** Sends the removal after the undo window; the photo goes only once the row is really gone. */
function dropShoppingItem(item: ShoppingItem) {
  void removeShoppingItem(item.id, UNDO_HOLD_MS).then((ok) => {
    const back = useHousehold.getState().shopping.some((row) => row.id === item.id);
    if (ok && !back && item.photoPath) void removeShoppingPhoto(item.photoPath);
  });
}

/** Uploads a product photo when one was picked, then saves the row. A failed photo never blocks the name. */
async function saveItemWithPhoto(item: ShoppingItem, photo?: File | null, replace = Boolean(photo)) {
  const saved = await saveShoppingItem(item);
  if (!replace) return saved;
  const house = useAuth.getState().session?.householdId;
  try {
    if (photo && !house) throw new Error("no house");
    const photoPath = photo ? await uploadShoppingPhoto(house!, await compressImage(photo, { side: 1200 })) : null;
    if (item.photoPath && item.photoPath !== photoPath) void removeShoppingPhoto(item.photoPath);
    useHousehold.setState(({ shopping }) => ({
      shopping: shopping.map((row) => (row.id === item.id ? { ...row, photoPath } : row)),
    }));
    await saveShoppingItem({ ...item, photoPath });
  } catch {
    // The name is already saved. The photo can be added again.
  }
  return saved;
}

/** The day selected on the Today screen, so "+" can default to it. */
export const useSelectedDay = create<{ day: DayKey | null; setDay: (day: DayKey | null) => void }>()((set) => ({
  day: null,
  setDay: (day) => set({ day }),
}));
