import type { DayKey } from "./dates";

export type ShoppingItem = {
  id: string;
  name: string;
  /** Free-text quantity or note, e.g. "2 ליטר". */
  note: string | null;
  addedBy: string;
  checkedAt: string | null;
};

export type HouseEvent = {
  id: string;
  title: string;
  date: DayKey;
  /** `HH:MM`, or null for an all-day event. */
  time: string | null;
  /** What the household needs to get ready beforehand. */
  prep: string | null;
  createdBy: string;
};

/** Events within this many days that have prep notes show up under "to prepare". */
export const PREP_WINDOW_DAYS = 14;

export function sortEvents(a: HouseEvent, b: HouseEvent) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.time === b.time) return 0;
  if (a.time === null) return -1;
  if (b.time === null) return 1;
  return a.time < b.time ? -1 : 1;
}
