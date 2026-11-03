"use client";

import type { Aisle } from "./aisles";
import { itemKey } from "./groceries";
import { aisleOf, useHousehold } from "./household-store";
import { askAisles } from "./supabase/lists";

/**
 * Keeps every item on the list in an aisle: what the dictionary or the house already knows lands at once,
 * the rest goes to the server in one batch. Each name is asked about once per app start, so a missing
 * AI key or a dropped connection never turns into a loop; those items wait under "other".
 */
export function startAislePlacing() {
  const asked = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;

  const place = () => {
    const { shopping, placeItems, listsLoaded } = useHousehold.getState();
    // Until this session's list arrives, the rows on the phone may be stale: saving them could undo a change.
    if (!listsLoaded) return;
    const unplaced = shopping.filter((item) => !item.category);
    if (unplaced.length === 0) return;

    const known: Record<string, Aisle> = {};
    const ask = new Map<string, string>();
    for (const item of unplaced) {
      const key = itemKey(item.name);
      const aisle = aisleOf(item.name);
      if (aisle) known[key] = aisle;
      else if (!asked.has(key)) ask.set(key, item.name);
    }
    if (Object.keys(known).length > 0) placeItems(known);
    if (ask.size === 0) return;

    for (const key of ask.keys()) asked.add(key);
    void askAisles([...ask.values()])
      .then((found) => {
        if (!alive) return;
        const byKey = Object.fromEntries(Object.entries(found).map(([name, aisle]) => [itemKey(name), aisle]));
        if (Object.keys(byKey).length > 0) useHousehold.getState().placeItems(byKey);
      })
      .catch(() => {});
  };

  const soon = () => {
    clearTimeout(timer);
    timer = setTimeout(place, 500);
  };
  soon();
  const stop = useHousehold.subscribe((state, prev) => {
    if (state.shopping !== prev.shopping || state.aisleMemory !== prev.aisleMemory || state.listsLoaded !== prev.listsLoaded) soon();
  });
  return () => {
    alive = false;
    clearTimeout(timer);
    stop();
  };
}
