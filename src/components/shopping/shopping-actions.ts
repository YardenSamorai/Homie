"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { looseKey } from "@/lib/aisles";
import { itemKey } from "@/lib/groceries";
import type { ShoppingItem } from "@/lib/household";
import { useHousehold, type NewShoppingItem } from "@/lib/household-store";

/** `action`: the button's label when it isn't "undo" (merging a near-duplicate). */
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

const pairKey = (a: ShoppingItem, b: ShoppingItem) => [itemKey(a.name), itemKey(b.name)].sort().join("|");

/** Pairs a parent said are different products, so they aren't offered for merging again on this phone. */
const useKeptApart = create<{ pairs: string[]; keep: (pair: string) => void }>()(
  persist((set) => ({ pairs: [], keep: (pair) => set(({ pairs }) => ({ pairs: [...pairs, pair].slice(-200) })) }), {
    name: "homie-kept-apart",
  }),
);

/** Items still to buy that look like the same product (קוטג' and קוטג, עגבניה and עגבניות), two at a time. */
export function useSimilarPairs(toBuy: ShoppingItem[]) {
  const kept = useKeptApart((s) => s.pairs);
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of toBuy) {
    const key = looseKey(item.name);
    if (key) groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()]
    .filter((items) => items.length > 1)
    .map((items) => [items[0], items[1]] as const)
    .filter(([a, b]) => !kept.includes(pairKey(a, b)));
}

/** Of two copies, the one worth keeping: the one with a photo, then with a note, then the older one. */
function keeper(a: ShoppingItem, b: ShoppingItem) {
  if (Boolean(a.photoPath) !== Boolean(b.photoPath)) return a.photoPath ? [a, b] : [b, a];
  if (Boolean(a.note) !== Boolean(b.note)) return a.note ? [a, b] : [b, a];
  const list = useHousehold.getState().shopping;
  return list.indexOf(a) > list.indexOf(b) ? [a, b] : [b, a];
}

/** The list's changes with what the screen says about them: duplicates found, and an undo for whatever leaves the list. */
export function useShoppingActions() {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const { say, flash } = useShoppingNotice.getState();

  /** Keeps one of the two; the other's note carries over when the kept one has none. */
  const merge = (firstId: string, secondId: string) => {
    const { shopping, updateShoppingItem, deleteShoppingItem, restoreShoppingItems } = useHousehold.getState();
    const first = shopping.find((row) => row.id === firstId);
    const second = shopping.find((row) => row.id === secondId);
    if (!first || !second) return;
    const [keep, drop] = keeper(first, second);
    if (!keep.note && drop.note) updateShoppingItem(keep.id, { name: keep.name, note: drop.note });
    const gone = deleteShoppingItem(drop.id);
    flash(keep.id);
    if (gone) say({ label: copy.merged, title: keep.name, undo: () => restoreShoppingItems([gone]) });
  };

  return {
    add(item: NewShoppingItem) {
      const { id, outcome, noteChanged } = useHousehold.getState().addShoppingItem(item);
      if (outcome === "added") {
        const { shopping } = useHousehold.getState();
        const key = looseKey(item.name);
        const similar = shopping.find((row) => row.id !== id && !row.checkedAt && looseKey(row.name) === key);
        if (similar) {
          flash(similar.id);
          say({ label: copy.similarOn, title: similar.name, action: copy.merge, undo: () => merge(similar.id, id) });
        }
        return;
      }
      flash(id);
      const label = outcome === "restored" ? copy.backOn : noteChanged ? copy.quantityUpdated : copy.alreadyOn;
      say({ label, title: item.note && noteChanged ? `${item.name} · ${item.note}` : item.name });
    },
    merge,
    keepApart(a: ShoppingItem, b: ShoppingItem) {
      useKeptApart.getState().keep(pairKey(a, b));
    },
    remove(id: string) {
      const { deleteShoppingItem, restoreShoppingItems } = useHousehold.getState();
      const gone = deleteShoppingItem(id);
      if (gone) say({ label: copy.deleted, title: gone.item.name, undo: () => restoreShoppingItems([gone]) });
    },
    clearBought() {
      const { clearBought, restoreShoppingItems } = useHousehold.getState();
      const gone = clearBought();
      if (gone.length === 0) return;
      say({
        label: gone.length === 1 ? copy.clearedOne : format(copy.cleared, { count: gone.length }),
        undo: () => restoreShoppingItems(gone),
      });
    },
    /** In the store a check takes the row off the screen, so it says so and can be taken back. */
    checkInStore(id: string) {
      const { shopping, toggleShoppingItem } = useHousehold.getState();
      const item = shopping.find((row) => row.id === id);
      if (!item || item.checkedAt) return;
      toggleShoppingItem(id);
      say({
        label: copy.inBasket,
        title: item.name,
        undo: () => {
          if (useHousehold.getState().shopping.find((row) => row.id === id)?.checkedAt) toggleShoppingItem(id);
        },
      });
    },
  };
}
