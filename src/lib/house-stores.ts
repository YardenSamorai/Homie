"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CalendarItem } from "./agenda";
import type { DayKey } from "./dates";
import type { HouseNote } from "./supabase/house-extras";

/**
 * The pinned note, kept on the device so Today opens with it. `owner` names the person and house it was read for;
 * anything else in storage is dropped rather than shown.
 */
type NoteState = {
  owner: string | null;
  note: HouseNote | null;
  set: (owner: string, note: HouseNote | null) => void;
  clear: () => void;
};

export const useHouseNote = create<NoteState>()(
  persist(
    (set) => ({
      owner: null,
      note: null,
      set: (owner, note) => set({ owner, note }),
      clear: () => set({ owner: null, note: null }),
    }),
    { name: "homie-note", skipHydration: true },
  ),
);

/** Whether a note still shows on a day: through its last day, or until someone takes it down. */
export const noteShows = (note: HouseNote | null, today: DayKey | null): note is HouseNote =>
  Boolean(note && today && (note.until === null || note.until >= today));

export type CalendarStatus = "idle" | "loading" | "ready" | "failed";

/** Connected calendars as this parent may see them, for the days around today. */
type CalendarState = {
  owner: string | null;
  items: CalendarItem[];
  loadedAt: number | null;
  status: CalendarStatus;
  set: (owner: string, items: CalendarItem[]) => void;
  setStatus: (status: CalendarStatus) => void;
  clear: () => void;
};

export const useCalendarItems = create<CalendarState>()(
  persist(
    (set) => ({
      owner: null,
      items: [],
      loadedAt: null,
      status: "idle",
      set: (owner, items) => set({ owner, items, loadedAt: Date.now(), status: "ready" }),
      setStatus: (status) => set({ status }),
      clear: () => set({ owner: null, items: [], loadedAt: null, status: "idle" }),
    }),
    { name: "homie-calendars", skipHydration: true, partialize: ({ owner, items, loadedAt }) => ({ owner, items, loadedAt }) },
  ),
);

/** Signing out or deleting the account: nothing read for this person stays on the device. */
export function forgetHouseExtras() {
  useHouseNote.getState().clear();
  useCalendarItems.getState().clear();
}
