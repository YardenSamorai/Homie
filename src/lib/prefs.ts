import type { ActivityKind } from "./activity";

/** What a parent hears about, grouped as Settings shows it. */
export const notifyKinds = ["tasks", "done", "shopping", "bought", "events", "stories"] as const;
export type NotifyKind = (typeof notifyKinds)[number];

export const morningHours = [7, 8, 9] as const;

/** One parent's choices, stored in profiles.prefs so every device and the server read the same. */
export type Prefs = {
  notify: Record<NotifyKind, boolean>;
  morning: { on: boolean; hour: number };
  newTask: { assignee: "me" | "partner"; due: "today" | "none" };
};

export const defaultPrefs: Prefs = {
  notify: { tasks: true, done: true, shopping: true, bought: true, events: true, stories: true },
  morning: { on: true, hour: 8 },
  newTask: { assignee: "me", due: "today" },
};

/** Whatever is stored, filled in with the defaults: a missing or malformed value never turns something off. */
export function readPrefs(raw: unknown): Prefs {
  const value = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof Prefs, Record<string, unknown>>>;
  const notify = { ...defaultPrefs.notify };
  for (const kind of notifyKinds) if (typeof value.notify?.[kind] === "boolean") notify[kind] = value.notify[kind] as boolean;
  const hour = Number(value.morning?.hour);
  return {
    notify,
    morning: {
      on: typeof value.morning?.on === "boolean" ? (value.morning.on as boolean) : defaultPrefs.morning.on,
      hour: (morningHours as readonly number[]).includes(hour) ? hour : defaultPrefs.morning.hour,
    },
    newTask: {
      assignee: value.newTask?.assignee === "partner" ? "partner" : "me",
      due: value.newTask?.due === "none" ? "none" : "today",
    },
  };
}

/** Which switch in Settings covers a kind of activity. A task handed to you counts as a new task. */
export function notifyKindOf(kind: ActivityKind): NotifyKind {
  switch (kind) {
    case "task_added":
    case "task_assigned":
      return "tasks";
    case "task_done":
      return "done";
    case "shopping_added":
      return "shopping";
    case "shopping_bought":
      return "bought";
    case "event_added":
      return "events";
    case "story_added":
      return "stories";
  }
}
