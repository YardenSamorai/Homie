"use client";

import { create } from "zustand";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useHousehold, type NewShoppingItem } from "@/lib/household-store";

export type ShoppingNotice = { id: string; label: string; title?: string; undo?: () => void };

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

/** The list's changes with what the screen says about them: duplicates found, and an undo for whatever leaves the list. */
export function useShoppingActions() {
  const { dict } = useI18n();
  const copy = dict.shopping;
  const { say, flash } = useShoppingNotice.getState();

  return {
    add(item: NewShoppingItem) {
      const { id, outcome, noteChanged } = useHousehold.getState().addShoppingItem(item);
      if (outcome === "added") return;
      flash(id);
      const label = outcome === "restored" ? copy.backOn : noteChanged ? copy.quantityUpdated : copy.alreadyOn;
      say({ label, title: item.note && noteChanged ? `${item.name} · ${item.note}` : item.name });
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
