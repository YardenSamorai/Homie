"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DayKey } from "./dates";
import type { HouseEvent, ShoppingItem } from "./household";
import { completeTask, uncompleteTask, type Member, type Task } from "./tasks";
import { announce } from "./supabase/activity";
import { removeEvent, removeShoppingItem, removeTask, saveEvent, saveShoppingItem, saveTask } from "./supabase/lists";

type NewTask = Pick<Task, "title" | "assigneeId" | "dueDate" | "recurrence">;
type NewShoppingItem = Pick<ShoppingItem, "name" | "note">;
type NewEvent = Pick<HouseEvent, "title" | "date" | "time" | "prep">;

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
  deleteTask: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  clearBought: () => void;
  addShoppingItem: (item: NewShoppingItem) => void;
  updateShoppingItem: (id: string, patch: NewShoppingItem) => void;
  deleteShoppingItem: (id: string) => void;
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
        const bought = get().shopping.filter((item) => item.checkedAt);
        set(({ shopping }) => ({ shopping: shopping.filter((item) => !item.checkedAt) }));
        for (const item of bought) void removeShoppingItem(item.id);
      },

      addShoppingItem: (item) => {
        const created: ShoppingItem = { ...item, id: crypto.randomUUID(), addedBy: get().currentUserId, checkedAt: null };
        set(({ shopping }) => ({ shopping: [created, ...shopping] }));
        void saveShoppingItem(created).then((ok) => ok && announce("shopping_added", created.id, created.name));
      },

      updateShoppingItem: (id, patch) => {
        const shopping = get().shopping.map((item) => (item.id === id ? { ...item, ...patch } : item));
        set({ shopping });
        const updated = shopping.find((item) => item.id === id);
        if (updated) void saveShoppingItem(updated);
      },

      deleteShoppingItem: (id) => {
        set(({ shopping }) => ({ shopping: shopping.filter((item) => item.id !== id) }));
        void removeShoppingItem(id);
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

/** The day selected on the Today screen, so "+" can default to it. */
export const useSelectedDay = create<{ day: DayKey | null; setDay: (day: DayKey | null) => void }>()((set) => ({
  day: null,
  setDay: (day) => set({ day }),
}));
