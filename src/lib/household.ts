import type { Aisle } from "./aisles";
import type { DayKey } from "./dates";
import type { Unit } from "./quantity";

/** Whether the shopper may bring something else when it's missing: anything close, nothing, or one named product. */
export type SubstituteMode = "allowed" | "none" | "specific";

export type ShoppingItem = {
  id: string;
  name: string;
  /** How many, and of what ("2", "1.5 ק״ג"). Empty when the list doesn't say. */
  quantity: number | null;
  unit: Unit | null;
  /** Free text: a brand, a size, "the one in the blue pack". */
  note: string | null;
  /** A photo of the exact product, private to the house. */
  photoPath: string | null;
  /** Supermarket aisle; empty until the dictionary, the house's memory or the AI places it. */
  category?: Aisle | null;
  addedBy: string;
  /** Who else asked for it, when two requests were merged into this one. */
  requestedBy: string[];
  checkedAt: string | null;
  checkedBy: string | null;
  /** Looked for in the store and not found: still to buy, not bought. */
  missingAt: string | null;
  substituteMode: SubstituteMode | null;
  substitute: string | null;
  /** The event or task it's for. The item stays if they're deleted. */
  eventId: string | null;
  taskId: string | null;
  createdAt: string;
};

/** One product in a finished trip, as it was bought. */
export type TripLine = {
  itemId: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  note: string | null;
  category: Aisle | null;
  checkedBy: string | null;
};

export type ShoppingTrip = {
  id: string;
  finishedAt: string;
  finishedBy: string | null;
  undoneAt: string | null;
  items: TripLine[];
  /** What wasn't found that time. */
  missing: { itemId: string; name: string }[];
};

/** What the house knows about one product, by item key. */
export type ProductMemo = {
  key: string;
  name: string | null;
  staple: boolean;
  quantity: number | null;
  unit: Unit | null;
  note: string | null;
  /** The name a parent corrected this one to; offered first when it's typed again. */
  renamedTo: string | null;
  dismissedUntil: string | null;
};

export type GroupLine = { name: string; quantity: number | null; unit: Unit | null; note: string | null };
export type ShoppingGroup = { id: string; name: string; items: GroupLine[] };

export type HouseEvent = {
  id: string;
  title: string;
  date: DayKey;
  /** `HH:MM`, or null for an all-day event. */
  time: string | null;
  /** What the household needs to get ready beforehand. */
  prep: string | null;
  /** Who is going. Null means the house didn't say. */
  attendeeId: string | null;
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
