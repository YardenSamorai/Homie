import { itemKey } from "./groceries";
import type { ProductMemo, ShoppingTrip } from "./household";
import type { Unit } from "./quantity";
import { similarKey } from "./similar";

const DAY = 86_400_000;
/** A starter bought this recently isn't offered again. */
const RECENT_DAYS = 3;

/** Why a product is offered, in words that are true: it's a staple, or when it was last bought. */
export type SuggestionReason =
  | { kind: "staple"; lastDays: number | null }
  | { kind: "habit"; lastDays: number; everyDays: number | null; times: number }
  | { kind: "starter" };

export type Suggestion = {
  key: string;
  name: string;
  quantity: number | null;
  unit: Unit | null;
  note: string | null;
  reason: SuggestionReason;
};

type Bought = { name: string; quantity: number | null; unit: Unit | null; note: string | null; dates: number[] };

/** Each product the house actually bought (finished trips, not undone ones), with every date it was bought. */
export function purchaseHistory(trips: ShoppingTrip[]) {
  const byKey = new Map<string, Bought>();
  const done = trips.filter((trip) => !trip.undoneAt).sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  for (const trip of done) {
    const at = Date.parse(trip.finishedAt);
    const seen = new Set<string>();
    for (const line of trip.items) {
      const key = itemKey(line.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const known = byKey.get(key);
      // The latest purchase sets the name and the usual amount: what the house chose most recently.
      byKey.set(key, { name: line.name, quantity: line.quantity, unit: line.unit, note: line.note, dates: [...(known?.dates ?? []), at] });
    }
  }
  return byKey;
}

const days = (ms: number) => Math.max(0, Math.floor(ms / DAY));

/**
 * What to offer adding, best first. A new house gets the starter list; once it has bought a product on two
 * trips, its habits take over, most overdue first. Staples always come first. Never offered: what's already
 * on the list (or a near-duplicate of it), what was just bought, and what someone dismissed until that time passes.
 */
export function suggestProducts({
  trips,
  products,
  onList,
  starters,
  now,
}: {
  trips: ShoppingTrip[];
  products: ProductMemo[];
  onList: string[];
  starters: string[];
  now: number;
}): Suggestion[] {
  const listed = new Set(onList.map(similarKey));
  const memo = new Map(products.map((product) => [product.key, product]));
  const hidden = (key: string, name: string) => {
    const until = memo.get(key)?.dismissedUntil;
    return listed.has(similarKey(name)) || (until !== null && until !== undefined && Date.parse(until) > now);
  };
  const history = purchaseHistory(trips);
  const lastBought = new Map<string, number>();
  for (const bought of history.values()) {
    const key = similarKey(bought.name);
    lastBought.set(key, Math.max(lastBought.get(key) ?? 0, bought.dates.at(-1)!));
  }
  const out: Suggestion[] = [];
  // By similarity, so "Eggs" from the starters doesn't repeat the house's "ביצים".
  const taken = new Set<string>();
  const push = (suggestion: Suggestion) => {
    const same = similarKey(suggestion.name);
    if (taken.has(same) || hidden(suggestion.key, suggestion.name)) return;
    taken.add(same);
    out.push(suggestion);
  };

  for (const product of products) {
    if (!product.staple) continue;
    const bought = history.get(product.key);
    const last = bought?.dates.at(-1);
    push({
      key: product.key,
      name: product.renamedTo ?? product.name ?? bought?.name ?? product.key,
      quantity: product.quantity ?? bought?.quantity ?? null,
      unit: product.quantity !== null ? product.unit : (bought?.unit ?? null),
      note: product.note ?? bought?.note ?? null,
      reason: { kind: "staple", lastDays: last !== undefined ? days(now - last) : null },
    });
  }

  const habits = [...history.entries()]
    .filter(([, bought]) => bought.dates.length >= 2)
    .map(([key, bought]) => {
      const last = bought.dates.at(-1)!;
      const gaps = bought.dates.slice(1).map((at, i) => at - bought.dates[i]);
      const every = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      // How far along its usual gap it is: 1 means "about when it's usually bought again".
      const due = every > 0 ? (now - last) / every : 0;
      return { key, bought, last, every, due };
    })
    .sort((a, b) => b.due - a.due || b.bought.dates.length - a.bought.dates.length);

  // Not yet halfway to its usual gap: the house most likely still has it.
  for (const { key, bought, last, every, due } of habits) {
    if (due < 0.5) continue;
    const memoName = memo.get(key)?.renamedTo;
    push({
      key,
      name: memoName ?? bought.name,
      quantity: bought.quantity,
      unit: bought.unit,
      note: bought.note,
      reason: { kind: "habit", lastDays: days(now - last), everyDays: every >= DAY ? Math.round(every / DAY) : null, times: bought.dates.length },
    });
  }

  if (habits.length === 0) {
    for (const name of starters) {
      const last = lastBought.get(similarKey(name));
      if (last !== undefined && now - last < RECENT_DAYS * DAY) continue;
      push({ key: itemKey(name), name, quantity: null, unit: null, note: null, reason: { kind: "starter" } });
    }
  }
  return out;
}

/** How long a dismissed suggestion stays away. */
export const DISMISS_DAYS = 3;
