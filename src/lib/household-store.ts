"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useAuth } from "./auth/session";
import { addDays, type DayKey } from "./dates";
import { knownAisle, type Aisle } from "./aisles";
import { itemKey } from "./groceries";
import type { HouseEvent, ProductMemo, ShoppingGroup, ShoppingItem, ShoppingTrip, SubstituteMode } from "./household";
import type { Unit } from "./quantity";
import { mergedItem, type MergeChoice, type MergePlan } from "./shopping-merge";
import { DISMISS_DAYS } from "./shopping-suggest";
import { pairKey } from "./similar";
import { completeTask, uncompleteTask, type Member, type Task } from "./tasks";
import { announce } from "./supabase/activity";
import { compressImage, removeShoppingPhoto, uploadShoppingPhoto } from "./supabase/media";
import { enqueue, onGone, useOutbox } from "./supabase/outbox";
import {
  finishTripOnServer,
  keepApartOnServer,
  rememberAisle,
  removeEvent,
  removeGroup,
  removeShoppingItem,
  removeTask,
  saveEvent,
  saveGroup,
  saveProduct,
  saveShoppingItem,
  saveTask,
  type ShoppingExtras,
} from "./supabase/lists";

type NewTask = Pick<Task, "title" | "assigneeId" | "dueDate" | "recurrence">;

/**
 * A product to put on the list. `aisle`: a parent chose it, so the house remembers it for this product.
 * An amount or a note that's left out (undefined) leaves the one already on the list alone.
 */
export type NewShoppingItem = {
  name: string;
  note: string | null;
  quantity?: number | null;
  unit?: Unit | null;
  photo?: File | null;
  aisle?: Aisle;
  eventId?: string | null;
  taskId?: string | null;
  substituteMode?: SubstituteMode | null;
  substitute?: string | null;
};

/** Everything the item sheet can change. A new photo is a file; null removes it; undefined keeps it. */
export type ShoppingPatch = {
  name: string;
  note: string | null;
  quantity: number | null;
  unit: Unit | null;
  photo?: File | null;
  aisle?: Aisle;
  substituteMode: SubstituteMode | null;
  substitute: string | null;
  taskId: string | null;
};

/** What adding did: a new row, or the same item found already on the list (still to buy, or back from the cart). */
export type AddedItem = { id: string; outcome: "added" | "exists" | "restored"; changed: boolean };
/** A removed row and where it stood, so an undo puts it back in place. */
export type RemovedItem = { item: ShoppingItem; at: number };
/** A trip just finished on this phone, with the rows it took off the list, so an undo can put them straight back. */
export type FinishedTrip = { trip: ShoppingTrip; removed: RemovedItem[] };

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
  /** Where this house puts each product, by item key: the AI's answers and the parents' own choices. */
  aisleMemory: Record<string, Aisle>;
  /** Finished shopping trips, newest first (undone ones too, marked). */
  trips: ShoppingTrip[];
  /** What the house knows about each product, by item key: staples, usual amounts, corrections, dismissals. */
  products: Record<string, ProductMemo>;
  /** Pairs of names a parent said are different products. */
  keptApart: string[];
  groups: ShoppingGroup[];
  /** The house whose lists came from the server since the app opened: nothing changes rows by itself before that. */
  listsLoaded: string | null;
  syncSelf: (self: Member | null) => void;
  setAisleMemory: (memory: Record<string, Aisle>) => void;
  /** Puts items that have no aisle yet into the aisles found for their names (by item key). */
  placeItems: (found: Record<string, Aisle>) => void;
  setRoster: (currentUserId: string, members: Member[]) => void;
  setMemberPhoto: (id: string, photoPath: string | null, photo: string | null) => void;
  replaceLists: (lists: { tasks: Task[]; shopping: ShoppingItem[]; events: HouseEvent[] }, householdId?: string) => void;
  replaceExtras: (extras: ShoppingExtras) => void;
  toggleTask: (task: Task, today: DayKey) => void;
  addTask: (task: NewTask) => void;
  updateTask: (id: string, patch: NewTask) => void;
  /** Moves an overdue task to tomorrow. It stays open. */
  postponeTask: (id: string, today: DayKey) => void;
  deleteTask: (id: string) => void;
  toggleShoppingItem: (id: string) => void;
  /** "Not found" in the store: it stays to buy and isn't counted as bought. */
  setMissing: (id: string, missing: boolean) => void;
  addShoppingItem: (item: NewShoppingItem) => AddedItem;
  updateShoppingItem: (id: string, patch: ShoppingPatch) => void;
  deleteShoppingItem: (id: string) => RemovedItem | null;
  restoreShoppingItems: (removed: RemovedItem[]) => void;
  /** Keeps one of two near-duplicates as chosen; the returned undo leaves alone what someone changed since. */
  mergeShoppingItems: (plan: MergePlan, choice: MergeChoice) => (() => void) | null;
  /** Files what's in the cart under a new trip. Null when nothing is bought. */
  finishTrip: () => FinishedTrip | null;
  /** Takes a trip back: its items return to the list as they are now. */
  undoTrip: (tripId: string, removed?: RemovedItem[]) => void;
  setStaple: (name: string, staple: boolean) => Promise<boolean>;
  dismissSuggestion: (key: string, name: string) => Promise<boolean>;
  keepApart: (a: string, b: string) => Promise<boolean>;
  saveShoppingGroup: (group: ShoppingGroup) => Promise<boolean>;
  deleteShoppingGroup: (id: string) => Promise<boolean>;
  addEvent: (event: NewEvent) => void;
  updateEvent: (id: string, patch: NewEvent) => void;
  deleteEvent: (id: string) => void;
};

const now = () => new Date().toISOString();

const blankMemo = (key: string): ProductMemo => ({
  key,
  name: null,
  staple: false,
  quantity: null,
  unit: null,
  note: null,
  renamedTo: null,
  dismissedUntil: null,
});

const sameRow = (a: ShoppingItem, b: ShoppingItem) => JSON.stringify(a) === JSON.stringify(b);

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
      aisleMemory: {},
      trips: [],
      products: {},
      keptApart: [],
      groups: [],
      listsLoaded: null,

      syncSelf: (self) =>
        set({
          currentUserId: self?.id ?? "",
          members: self ? [self] : [],
          tasks: [],
          shopping: [],
          events: [],
          aisleMemory: {},
          trips: [],
          products: {},
          keptApart: [],
          groups: [],
          listsLoaded: null,
        }),

      setAisleMemory: (memory) => set(({ aisleMemory }) => ({ aisleMemory: { ...aisleMemory, ...memory } })),

      placeItems: (found) => {
        const placed: ShoppingItem[] = [];
        const shopping = get().shopping.map((item) => {
          const aisle = item.category ? undefined : found[itemKey(item.name)];
          if (!aisle) return item;
          const next = { ...item, category: aisle };
          placed.push(next);
          return next;
        });
        set(({ aisleMemory }) => ({ shopping, aisleMemory: { ...aisleMemory, ...found } }));
        for (const item of placed) void saveShoppingItem(item);
      },

      setRoster: (currentUserId, members) => set({ currentUserId, members }),

      setMemberPhoto: (id, photoPath, photo) =>
        set(({ members }) => ({ members: members.map((member) => (member.id === id ? { ...member, photoPath, photo } : member)) })),

      replaceLists: (lists, householdId) => set({ ...lists, ...(householdId ? { listsLoaded: householdId } : {}) }),

      replaceExtras: (extras) => {
        // A finish or an undo still waiting in the outbox isn't on the server yet; the history shows it meanwhile.
        const queue = useOutbox.getState().queue;
        const pending = new Set(queue.flatMap((op) => (op.action === "finish" || op.action === "undo" ? [op.id] : [])));
        const undoing = new Set(queue.flatMap((op) => (op.action === "undo" ? [op.id] : [])));
        const local = get().trips.filter((trip) => pending.has(trip.id) && !extras.trips.some((known) => known.id === trip.id));
        const server = extras.trips.map((trip) => (undoing.has(trip.id) && !trip.undoneAt ? { ...trip, undoneAt: now() } : trip));
        set({
          trips: [...local, ...server],
          products: Object.fromEntries(extras.products.map((memo) => [memo.key, memo])),
          keptApart: extras.keptApart,
          groups: extras.groups,
        });
      },

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
        const me = get().currentUserId;
        const shopping = get().shopping.map((item) =>
          item.id !== id
            ? item
            : item.checkedAt
              ? { ...item, checkedAt: null, checkedBy: null }
              : { ...item, checkedAt: now(), checkedBy: me, missingAt: null },
        );
        set({ shopping });
        const updated = shopping.find((item) => item.id === id);
        if (!updated) return;
        const save = saveShoppingItem(updated);
        if (updated.checkedAt) void save.then((ok) => ok && announce("shopping_bought", updated.id, updated.name));
      },

      setMissing: (id, missing) => {
        const item = get().shopping.find((row) => row.id === id);
        if (!item || Boolean(item.missingAt) === missing) return;
        const next: ShoppingItem = { ...item, missingAt: missing ? now() : null, checkedAt: null, checkedBy: null };
        set(({ shopping }) => ({ shopping: shopping.map((row) => (row.id === id ? next : row)) }));
        void saveShoppingItem(next);
      },

      addShoppingItem: (input) => {
        // A name the house corrected before ("חלב" → "חלב תנובה 3%") comes back corrected.
        const renamedTo = get().products[itemKey(input.name)]?.renamedTo;
        const item = renamedTo ? { ...input, name: renamedTo } : input;
        const key = itemKey(item.name);
        if (item.aisle) learnAisle(key, item.aisle);
        const match = get().shopping.find((row) => itemKey(row.name) === key);
        if (match) {
          const noteChanged = item.note !== null && item.note !== match.note;
          const amountChanged =
            item.quantity !== undefined && item.quantity !== null && (item.quantity !== match.quantity || (item.unit ?? null) !== match.unit);
          const back = match.checkedAt !== null;
          const moved = item.aisle !== undefined && item.aisle !== match.category;
          const linked = Boolean(item.eventId && !match.eventId) || Boolean(item.taskId && !match.taskId);
          // The other parent asking for it too: their face joins the row.
          const me = get().currentUserId;
          const asks = !back && me !== "" && me !== match.addedBy && !match.requestedBy.includes(me);
          if (noteChanged || amountChanged || back || item.photo || moved || linked || asks) {
            const next: ShoppingItem = {
              ...match,
              requestedBy: asks ? [...match.requestedBy, me] : match.requestedBy,
              note: noteChanged ? item.note : match.note,
              quantity: amountChanged ? (item.quantity ?? null) : match.quantity,
              unit: amountChanged ? (item.unit ?? null) : match.unit,
              category: item.aisle ?? match.category ?? null,
              eventId: match.eventId ?? item.eventId ?? null,
              taskId: match.taskId ?? item.taskId ?? null,
              checkedAt: null,
              checkedBy: null,
            };
            set(({ shopping }) => ({ shopping: shopping.map((row) => (row.id === match.id ? next : row)) }));
            const save = saveItemWithPhoto(next, item.photo);
            if (back) void save.then((ok) => ok && announce("shopping_added", next.id, next.name));
          }
          return { id: match.id, outcome: back ? "restored" : "exists", changed: noteChanged || amountChanged };
        }
        const created: ShoppingItem = {
          id: crypto.randomUUID(),
          name: item.name,
          quantity: item.quantity ?? null,
          unit: item.quantity ? (item.unit ?? null) : null,
          note: item.note,
          photoPath: null,
          category: item.aisle ?? aisleOf(item.name),
          addedBy: get().currentUserId,
          requestedBy: [],
          checkedAt: null,
          checkedBy: null,
          missingAt: null,
          substituteMode: item.substituteMode ?? null,
          substitute: item.substituteMode === "specific" ? (item.substitute ?? null) : null,
          eventId: item.eventId ?? null,
          taskId: item.taskId ?? null,
          createdAt: now(),
        };
        set(({ shopping }) => ({ shopping: [created, ...shopping] }));
        void saveItemWithPhoto(created, item.photo).then((ok) => ok && announce("shopping_added", created.id, created.name));
        return { id: created.id, outcome: "added", changed: false };
      },

      updateShoppingItem: (id, patch) => {
        const before = get().shopping.find((item) => item.id === id);
        if (!before) return;
        if (patch.aisle) learnAisle(itemKey(patch.name), patch.aisle);
        // A new name may be a different product: it's placed again unless a parent chose the aisle.
        const renamed = itemKey(patch.name) !== itemKey(before.name);
        if (renamed) learnRename(before.name, patch.name);
        const category = patch.aisle ?? (renamed ? aisleOf(patch.name) : (before.category ?? null));
        const next: ShoppingItem = {
          ...before,
          name: patch.name,
          note: patch.note,
          quantity: patch.quantity,
          unit: patch.quantity ? patch.unit : null,
          category,
          substituteMode: patch.substituteMode,
          substitute: patch.substituteMode === "specific" ? patch.substitute : null,
          taskId: patch.taskId,
        };
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

      mergeShoppingItems: (plan, choice) => {
        const { shopping } = get();
        const keep = shopping.find((row) => row.id === plan.keep.id);
        const drop = shopping.find((row) => row.id === plan.drop.id);
        if (!keep || !drop) return null;
        const merged = mergedItem({ ...plan, keep, drop }, choice);
        set({ shopping: shopping.map((row) => (row.id === keep.id ? merged : row)) });
        void saveShoppingItem(merged);
        const gone = get().deleteShoppingItem(drop.id);
        // The kept row's own photo, when the other one's was chosen, goes once the merge is final.
        if (keep.photoPath && keep.photoPath !== merged.photoPath) dropPhotoLater(keep.photoPath);
        return () => {
          if (gone) get().restoreShoppingItems([gone]);
          const current = get().shopping.find((row) => row.id === keep.id);
          // Changed since (the other parent edited it): their version stays; only the merged-away row comes back.
          if (!current || !sameRow(current, merged)) return;
          set(({ shopping: rows }) => ({ shopping: rows.map((row) => (row.id === keep.id ? keep : row)) }));
          void saveShoppingItem(keep);
        };
      },

      finishTrip: () => {
        const { shopping, currentUserId } = get();
        const removed = shopping.map((item, at) => ({ item, at })).filter(({ item }) => item.checkedAt);
        if (removed.length === 0) return null;
        const trip: ShoppingTrip = {
          id: crypto.randomUUID(),
          finishedAt: now(),
          finishedBy: currentUserId,
          undoneAt: null,
          items: removed.map(({ item }) => ({
            itemId: item.id,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            note: item.note,
            category: item.category ?? null,
            checkedBy: item.checkedBy,
          })),
          missing: shopping.filter((item) => item.missingAt && !item.checkedAt).map((item) => ({ itemId: item.id, name: item.name })),
        };
        const filed = new Set(removed.map(({ item }) => item.id));
        set(({ trips }) => ({ shopping: shopping.filter((item) => !filed.has(item.id)), trips: [trip, ...trips] }));
        void finishTripOnServer(trip.id, [...filed]);
        return { trip, removed };
      },

      undoTrip: (tripId, removed) => {
        set(({ trips }) => ({ trips: trips.map((trip) => (trip.id === tripId ? { ...trip, undoneAt: now() } : trip)) }));
        // Same id as the finish: if that hasn't left the phone yet, this replaces it and nothing is filed at all.
        void enqueue({ table: "shopping_trips", action: "undo", id: tripId });
        if (!removed) return;
        const shopping = [...get().shopping];
        for (const { item, at } of [...removed].sort((a, b) => a.at - b.at)) {
          if (!shopping.some((row) => row.id === item.id)) shopping.splice(Math.min(at, shopping.length), 0, item);
        }
        set({ shopping });
      },

      setStaple: (name, staple) => {
        const key = itemKey(name);
        const memo = get().products[key] ?? blankMemo(key);
        return writeMemo({ ...memo, name: memo.name ?? name, staple });
      },

      dismissSuggestion: (key, name) => {
        const memo = get().products[key] ?? blankMemo(key);
        const until = new Date(Date.now() + DISMISS_DAYS * 86_400_000).toISOString();
        return writeMemo({ ...memo, name: memo.name ?? name, dismissedUntil: until });
      },

      keepApart: async (a, b) => {
        const pair = pairKey(a, b);
        if (get().keptApart.includes(pair)) return true;
        set(({ keptApart }) => ({ keptApart: [...keptApart, pair] }));
        const house = useAuth.getState().session?.householdId;
        const ok = house ? await keepApartOnServer(house, pair) : true;
        if (!ok) set(({ keptApart }) => ({ keptApart: keptApart.filter((known) => known !== pair) }));
        return ok;
      },

      saveShoppingGroup: async (group) => {
        const before = get().groups;
        const isNew = !before.some((known) => known.id === group.id);
        set({ groups: isNew ? [...before, group] : before.map((known) => (known.id === group.id ? group : known)) });
        const session = useAuth.getState().session;
        const ok = session?.householdId ? await saveGroup(session.householdId, session.userId, group, isNew) : true;
        if (!ok) set({ groups: before });
        return ok;
      },

      deleteShoppingGroup: async (id) => {
        const before = get().groups;
        set({ groups: before.filter((group) => group.id !== id) });
        const ok = useAuth.getState().session?.householdId ? await removeGroup(id) : true;
        if (!ok) set({ groups: before });
        return ok;
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
      version: 1,
      // Items saved by the app before quantities existed get the new fields empty.
      migrate: (persisted) => {
        const state = persisted as { shopping?: Partial<ShoppingItem>[] };
        state.shopping = (state.shopping ?? []).map((item) => ({
          quantity: null,
          unit: null,
          requestedBy: [],
          checkedBy: null,
          missingAt: null,
          substituteMode: null,
          substitute: null,
          eventId: null,
          taskId: null,
          createdAt: new Date(0).toISOString(),
          ...item,
        }));
        return state as HouseholdState;
      },
      // Read after the first paint (HouseholdSync), so the server's empty first render matches the client's.
      skipHydration: true,
      partialize: ({ currentUserId, members, tasks, shopping, events, aisleMemory, trips, products, keptApart, groups }) => ({
        currentUserId,
        members,
        tasks,
        shopping,
        events,
        aisleMemory,
        trips,
        products,
        keptApart,
        groups,
      }),
    },
  ),
);

// A save that came back "deleted elsewhere": the row leaves this phone too instead of lingering.
onGone((table, id) => {
  if (table !== "shopping_items") return;
  useHousehold.setState(({ shopping }) => ({ shopping: shopping.filter((item) => item.id !== id) }));
});

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

/** The aisle a name goes to without asking anyone: what this house chose before, then the built-in dictionary. */
export function aisleOf(name: string): Aisle | null {
  return useHousehold.getState().aisleMemory[itemKey(name)] ?? knownAisle(name);
}

function learnAisle(key: string, aisle: Aisle) {
  useHousehold.setState(({ aisleMemory }) => ({ aisleMemory: { ...aisleMemory, [key]: aisle } }));
  const house = useAuth.getState().session?.householdId;
  if (house) void rememberAisle(house, key, aisle).catch(() => {});
}

/** Saves what the house knows about a product; on failure the screen goes back to what it was. */
async function writeMemo(memo: ProductMemo) {
  const before = useHousehold.getState().products[memo.key];
  useHousehold.setState(({ products }) => ({ products: { ...products, [memo.key]: memo } }));
  const house = useAuth.getState().session?.householdId;
  const ok = house ? await saveProduct(house, memo) : true;
  if (!ok) {
    useHousehold.setState(({ products }) => {
      const next = { ...products };
      if (before) next[memo.key] = before;
      else delete next[memo.key];
      return { products: next };
    });
  }
  return ok;
}

/** A parent corrected a name: typing the old one offers the new one first, for both of them. */
function learnRename(from: string, to: string) {
  const key = itemKey(from);
  const { products } = useHousehold.getState();
  const memo = products[key] ?? blankMemo(key);
  void writeMemo({ ...memo, name: memo.name ?? from, renamedTo: to });
  // Renamed back to a name that itself pointed elsewhere: that name is wanted as typed now.
  const target = products[itemKey(to)];
  if (target?.renamedTo) void writeMemo({ ...target, renamedTo: null });
}

const photoInUse = (path: string) => useHousehold.getState().shopping.some((row) => row.photoPath === path);

/** A photo nothing points to anymore, deleted once the undo window has passed. */
function dropPhotoLater(path: string) {
  setTimeout(() => {
    if (!photoInUse(path)) void removeShoppingPhoto(path);
  }, UNDO_HOLD_MS + 1000);
}

/** Sends the removal after the undo window; the photo goes only once the row is really gone and nothing else shows it. */
function dropShoppingItem(item: ShoppingItem) {
  void removeShoppingItem(item.id, UNDO_HOLD_MS).then((ok) => {
    const back = useHousehold.getState().shopping.some((row) => row.id === item.id);
    if (ok && !back && item.photoPath && !photoInUse(item.photoPath)) void removeShoppingPhoto(item.photoPath);
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
    const current = useHousehold.getState().shopping.find((row) => row.id === item.id);
    if (!current) return saved;
    const next = { ...current, photoPath };
    useHousehold.setState(({ shopping }) => ({ shopping: shopping.map((row) => (row.id === item.id ? next : row)) }));
    await saveShoppingItem(next);
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
