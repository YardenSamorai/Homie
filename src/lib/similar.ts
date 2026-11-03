import { looseKey } from "./aisles";
import { groceryPairs, itemKey } from "./groceries";
import type { ShoppingItem } from "./household";

/** Spelling that varies between people: עגבנייה and עגבניה, תוות and תות. */
const spell = (key: string) => key.replace(/יי/g, "י").replace(/וו/g, "ו");

/** The same common product in either language ("חלב", "Milk") shares one key. */
const across = new Map<string, string>();
groceryPairs.forEach(([he, en], index) => {
  across.set(spell(looseKey(he)), `#${index}`);
  across.set(spell(looseKey(en)), `#${index}`);
});

/**
 * Two names that are probably the same product: case, niqqud, geresh, final letters, plurals, doubled
 * letters and the language aside. Every word counts, so "חלב" and "חלב שיבולת שועל" stay apart.
 */
export function similarKey(name: string) {
  const key = spell(looseKey(name));
  return across.get(key) ?? key;
}

/** The order-free key of two products a parent said are different. */
export const pairKey = (a: string, b: string) => [itemKey(a), itemKey(b)].sort().join("|");

/**
 * Items still to buy that look like the same product, two at a time. Not offered: a pair the house said
 * is different, and two items for two different events (two occasions may each need their own).
 */
export function similarPairs(toBuy: ShoppingItem[], keptApart: ReadonlySet<string>) {
  const groups = new Map<string, ShoppingItem[]>();
  for (const item of toBuy) {
    const key = similarKey(item.name);
    if (key) groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const pairs: [ShoppingItem, ShoppingItem][] = [];
  for (const items of groups.values()) {
    outer: for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const [a, b] = [items[i], items[j]];
        if (keptApart.has(pairKey(a.name, b.name))) continue;
        if (a.eventId && b.eventId && a.eventId !== b.eventId) continue;
        pairs.push([a, b]);
        break outer;
      }
    }
  }
  return pairs;
}
