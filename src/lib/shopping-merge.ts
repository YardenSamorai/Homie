import type { ShoppingItem } from "./household";
import { mergeAmounts, type Amount } from "./quantity";

export type MergePlan = {
  keep: ShoppingItem;
  drop: ShoppingItem;
  /** What the merged amount can be; `pick` is null when the units don't add up and a parent must choose. */
  amounts: { options: Amount[]; pick: number | null };
  /** The note choices: one, or each and both together when they differ. */
  notes: string[];
  /** The photos there are to keep; the first is kept unless a parent picks the other. */
  photos: string[];
};

export type MergeChoice = { amount: Amount; note: string | null; photoPath: string | null };

/** Of two copies, the one worth keeping: the one with a photo, then with a note, then the older one. */
export function keeper(a: ShoppingItem, b: ShoppingItem): [ShoppingItem, ShoppingItem] {
  if (Boolean(a.photoPath) !== Boolean(b.photoPath)) return a.photoPath ? [a, b] : [b, a];
  if (Boolean(a.note) !== Boolean(b.note)) return a.note ? [a, b] : [b, a];
  return a.createdAt <= b.createdAt ? [a, b] : [b, a];
}

export function planMerge(a: ShoppingItem, b: ShoppingItem): MergePlan {
  const [keep, drop] = keeper(a, b);
  const amounts = mergeAmounts(
    { quantity: keep.quantity, unit: keep.unit },
    { quantity: drop.quantity, unit: drop.unit },
  );
  const written = [keep.note, drop.note].map((note) => note?.trim() ?? "").filter(Boolean);
  const notes = written.length === 2 && written[0] !== written[1] ? [`${written[0]} · ${written[1]}`, written[0], written[1]] : [...new Set(written)];
  const photos = [...new Set([keep.photoPath, drop.photoPath].filter((path): path is string => Boolean(path)))];
  return { keep, drop, amounts, notes, photos };
}

/** The choice shown first: the sum (or the only amount), both notes, the kept item's photo. Null amount: must choose. */
export function defaultChoice(plan: MergePlan): MergeChoice | null {
  if (plan.amounts.pick === null) return null;
  return { amount: plan.amounts.options[plan.amounts.pick], note: plan.notes[0] ?? null, photoPath: plan.photos[0] ?? null };
}

/**
 * The kept item after merging: everyone who asked for either, the event or task either was for, and
 * whatever the dropped one had that the kept one didn't (aisle, substitute preference).
 */
export function mergedItem(plan: MergePlan, choice: MergeChoice): ShoppingItem {
  const { keep, drop } = plan;
  const askers = new Set([...keep.requestedBy, drop.addedBy, ...drop.requestedBy]);
  askers.delete(keep.addedBy);
  const substitute = keep.substituteMode ? keep : drop;
  return {
    ...keep,
    quantity: choice.amount.quantity,
    unit: choice.amount.unit,
    note: choice.note,
    photoPath: choice.photoPath,
    category: keep.category ?? drop.category ?? null,
    requestedBy: [...askers],
    substituteMode: substitute.substituteMode,
    substitute: substitute.substitute,
    eventId: keep.eventId ?? drop.eventId,
    taskId: keep.taskId ?? drop.taskId,
    missingAt: keep.missingAt && drop.missingAt ? keep.missingAt : null,
  };
}
