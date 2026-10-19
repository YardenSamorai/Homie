"use client";

import { create } from "zustand";
import type { DayKey } from "./dates";
import type { HouseEvent, ShoppingItem } from "./household";
import { completeTask, uncompleteTask, type Member, type Task } from "./tasks";

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
  toggleTask: (task: Task, today: DayKey) => void;
  addTask: (task: NewTask) => void;
  toggleShoppingItem: (id: string) => void;
  clearBought: () => void;
  addShoppingItem: (item: NewShoppingItem) => void;
  addEvent: (event: NewEvent) => void;
};

const now = () => new Date().toISOString();

/** Client-side household data. Stands in for Supabase until the backend is wired (SPEC §9). */
export const useHousehold = create<HouseholdState>()((set) => ({
  currentUserId: "",
  members: [],
  tasks: [],
  shopping: [],
  events: [],

  syncSelf: (self) =>
    set({
      currentUserId: self?.id ?? "",
      members: self ? [self] : [],
    }),

  toggleTask: (task, today) =>
    set(({ tasks }) => ({
      tasks: task.completedAt
        ? uncompleteTask(tasks, task.id)
        : completeTask(tasks, task.id, today, now(), crypto.randomUUID()),
    })),

  addTask: (task) =>
    set(({ tasks }) => ({
      tasks: [...tasks, { ...task, id: crypto.randomUUID(), spawnedFromId: null, editedAt: null, completedAt: null }],
    })),

  toggleShoppingItem: (id) =>
    set(({ shopping }) => ({
      shopping: shopping.map((item) => (item.id === id ? { ...item, checkedAt: item.checkedAt ? null : now() } : item)),
    })),

  clearBought: () => set(({ shopping }) => ({ shopping: shopping.filter((item) => !item.checkedAt) })),

  addShoppingItem: (item) =>
    set(({ shopping, currentUserId }) => ({
      shopping: [{ ...item, id: crypto.randomUUID(), addedBy: currentUserId, checkedAt: null }, ...shopping],
    })),

  addEvent: (event) =>
    set(({ events, currentUserId }) => ({
      events: [...events, { ...event, id: crypto.randomUUID(), createdBy: currentUserId }],
    })),
}));

export type AddKind = "task" | "shopping" | "event";

type AddSheetState = {
  open: boolean;
  kind: AddKind;
  /** Day the new task or event defaults to. */
  day: DayKey | null;
  show: (kind: AddKind, day?: DayKey | null) => void;
  setOpen: (open: boolean) => void;
  setKind: (kind: AddKind) => void;
};

export const useAddSheet = create<AddSheetState>()((set) => ({
  open: false,
  kind: "task",
  day: null,
  show: (kind, day = null) => set({ open: true, kind, day }),
  setOpen: (open) => set({ open }),
  setKind: (kind) => set({ kind }),
}));

/** The day selected on the Today screen, so "+" can default to it. */
export const useSelectedDay = create<{ day: DayKey | null; setDay: (day: DayKey | null) => void }>()((set) => ({
  day: null,
  setDay: (day) => set({ day }),
}));
