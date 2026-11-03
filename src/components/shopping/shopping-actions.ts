"use client";

import { create } from "zustand";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { ShoppingItem } from "@/lib/household";
import { useHousehold, type NewShoppingItem } from "@/lib/household-store";
import { planMerge, type MergeChoice, type MergePlan } from "@/lib/shopping-merge";
import { pairKey, similarKey, similarPairs } from "@/lib/similar";

/** `action`: the button's label when it isn't "undo". */
export type ShoppingNotice = { id: string; label: string; title?: string; action?: string; undo?: () => void };

type NoticeState = {
  notice: ShoppingNotice | null;
  /** Rows lit for a moment: the item someone just tried to add again, or one the other parent added. */
  flashed: Record<string, number>;
  say: (notice: Omit<ShoppingNotice, "id">) => void;
  dismiss: () => void;
  flash: (id: string, scroll?: boolean) => void;
};

export const rowId = (id: string) => `shop-${id}`;

export const useShoppingNotice = create<NoticeState>()((set) => ({
  notice: null,
  flashed: {},
  say: (notice) => set({ notice: { ...notice, id: crypto.randomUUID() } }),
  dismiss: () => set({ notice: null }),
  flash: (id, scroll = true) => {
    const nonce = Math.random();
    set(({ flashed }) => ({ flashed: { ...flashed, [id]: nonce } }));
    window.setTimeout(() => {
      set(({ flashed }) => {
        if (flashed[id] !== nonce) return {};
        const rest = { ...flashed };
        delete rest[id];
        return { flashed: rest };
      });
    }, 2000);
    if (scroll) requestAnimationFrame(() => document.getElementById(rowId(id))?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  },
}));

/** The merge being looked at before it happens: which two, and what the result will be. */
export const useMergeSheet = create<{ plan: MergePlan | null; open: (a: ShoppingItem, b: ShoppingItem) => void; close: () => void }>()(
  (set) => ({
    plan: null,
    open: (a, b) => set({ plan: planMerge(a, b) }),
    close: () => set({ plan: null }),
  }),
);

/** Items still to buy that look like the same product, two at a time, minus the pairs the house kept apart. */
export function useSimilarPairs(toBuy: ShoppingItem[]) {
  const kept = useHousehold((s) => s.keptApart);
  return similarPairs(toBuy, new Set(kept));
}

/** The list's changes with what the screen says about them: duplicates found, and an undo for whatever leaves the list. */
export function useShoppingActions() {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const { say, flash } = useShoppingNotice.getState();

  const failed = () => say({ label: copy.needsConnection });

  const add = (item: NewShoppingItem) => {
    const { id, outcome, changed } = useHousehold.getState().addShoppingItem(item);
    if (outcome === "added") {
      // A near-duplicate gets the list's "looks like the same product" card, not a toast as well: both light up.
      const { shopping, keptApart } = useHousehold.getState();
      const key = similarKey(item.name);
      const similar = shopping.find(
        (row) => row.id !== id && !row.checkedAt && similarKey(row.name) === key && !keptApart.includes(pairKey(row.name, item.name)),
      );
      if (similar) flash(similar.id);
      return;
    }
    flash(id);
    const label = outcome === "restored" ? copy.backOn : changed ? copy.quantityUpdated : copy.alreadyOn;
    say({ label, title: useHousehold.getState().shopping.find((row) => row.id === id)?.name ?? item.name });
  };

  return {
    add,
    /** Several at once (a sentence, a group, a past trip): one toast for all of them. */
    addMany(items: NewShoppingItem[]) {
      if (items.length === 1) return add(items[0]);
      const { addShoppingItem } = useHousehold.getState();
      const results = items.map((item) => addShoppingItem(item));
      const added = results.filter((result) => result.outcome !== "exists" || result.changed).length;
      if (added === 0) return say({ label: copy.alreadyOn });
      say({ label: added === 1 ? copy.addedOne : format(copy.addedMany, { count: added }) });
    },
    merge(plan: MergePlan, choice: MergeChoice) {
      const undo = useHousehold.getState().mergeShoppingItems(plan, choice);
      if (!undo) return;
      flash(plan.keep.id);
      say({ label: copy.merged, title: plan.keep.name, undo });
    },
    async keepApart(a: ShoppingItem, b: ShoppingItem) {
      if (!(await useHousehold.getState().keepApart(a.name, b.name))) failed();
    },
    remove(id: string) {
      const { deleteShoppingItem, restoreShoppingItems } = useHousehold.getState();
      const gone = deleteShoppingItem(id);
      if (gone) say({ label: copy.deleted, title: gone.item.name, undo: () => restoreShoppingItems([gone]) });
    },
    /** In the store a check takes the row off the screen, so it says so and can be taken back. */
    checkInStore(id: string) {
      const { shopping, toggleShoppingItem } = useHousehold.getState();
      const item = shopping.find((row) => row.id === id);
      if (!item || item.checkedAt) return;
      toggleShoppingItem(id);
      const checkedAt = useHousehold.getState().shopping.find((row) => row.id === id)?.checkedAt;
      say({
        label: copy.inBasket,
        title: item.name,
        undo: () => {
          // Only this check: if it was already unchecked or checked again since, the newer state stays.
          if (useHousehold.getState().shopping.find((row) => row.id === id)?.checkedAt === checkedAt) toggleShoppingItem(id);
        },
      });
    },
    missing(id: string) {
      const { shopping, setMissing } = useHousehold.getState();
      const item = shopping.find((row) => row.id === id);
      if (!item) return;
      setMissing(id, true);
      say({ label: copy.missingSaid, title: item.name, undo: () => useHousehold.getState().setMissing(id, false) });
    },
    finish() {
      const { finishTrip, undoTrip } = useHousehold.getState();
      const done = finishTrip();
      if (!done) return false;
      const count = done.trip.items.length;
      say({
        label: copy.finished,
        title: count === 1 ? copy.finishedOne : format(copy.finishedCount, { count }),
        undo: () => {
          undoTrip(done.trip.id, done.removed);
          say({ label: copy.tripUndoneToast });
        },
      });
      return true;
    },
    undoTrip(tripId: string) {
      useHousehold.getState().undoTrip(tripId);
      say({ label: copy.tripUndoneToast });
    },
    async setStaple(name: string, on: boolean) {
      if (!(await useHousehold.getState().setStaple(name, on))) failed();
    },
    async dismiss(key: string, name: string) {
      if (!(await useHousehold.getState().dismissSuggestion(key, name))) failed();
    },
    failed,
  };
}
