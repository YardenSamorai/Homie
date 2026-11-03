import { describe, expect, it } from "vitest";
import { knownAisle } from "./aisles";
import { groceryPairs } from "./groceries";
import type { ShoppingItem, ShoppingTrip } from "./household";
import { formatAmount, mergeAmounts, readAmount, readLegacyNote } from "./quantity";
import { defaultChoice, mergedItem, planMerge } from "./shopping-merge";
import { parseItems } from "./shopping-parse";
import { suggestProducts } from "./shopping-suggest";
import { pairKey, similarKey, similarPairs } from "./similar";

const known = (name: string) => knownAisle(name) !== null;
const brief = (input: string) => parseItems(input, known).map(({ name, quantity, unit, unsure }) => ({ name, quantity, unit, unsure }));

describe("parseItems", () => {
  it("splits a Hebrew sentence with commas and a vav before a number", () => {
    expect(brief("2 חלב, לחם מלא ו־6 עגבניות")).toEqual([
      { name: "חלב", quantity: 2, unit: null, unsure: false },
      { name: "לחם מלא", quantity: null, unit: null, unsure: false },
      { name: "עגבניות", quantity: 6, unit: null, unsure: false },
    ]);
  });

  it("splits an English sentence", () => {
    expect(brief("2 milk, bread, 6 tomatoes")).toEqual([
      { name: "milk", quantity: 2, unit: null, unsure: false },
      { name: "bread", quantity: null, unit: null, unsure: false },
      { name: "tomatoes", quantity: 6, unit: null, unsure: false },
    ]);
  });

  it("reads a pasted list, one per line, without taking its numbering for quantities", () => {
    expect(brief("1. חלב\n2. 3 ביצים\n- קפה").map((item) => [item.name, item.quantity])).toEqual([
      ["חלב", null],
      ["ביצים", 3],
      ["קפה", null],
    ]);
  });

  it("keeps a single line with a leading number as one item", () => {
    expect(brief("2 חלב")).toEqual([{ name: "חלב", quantity: 2, unit: null, unsure: false }]);
  });

  it("splits a vav between two known products, but marks it for checking", () => {
    expect(brief("לחם וחלב")).toEqual([
      { name: "לחם", quantity: null, unit: null, unsure: false },
      { name: "חלב", quantity: null, unit: null, unsure: true },
    ]);
  });

  it("doesn't split words that begin with vav", () => {
    expect(brief("ביצים ורודות").map((item) => item.name)).toEqual(["ביצים ורודות"]);
    expect(brief("וניל")).toHaveLength(1);
    expect(brief("תמצית וניל").map((item) => item.name)).toEqual(["תמצית וניל"]);
  });

  it("splits a standalone vav or a hyphenated one", () => {
    expect(brief("לחם ו חלב").map((item) => item.name)).toEqual(["לחם", "חלב"]);
    expect(brief("פסטה ו-רוטב").map((item) => item.name)).toEqual(["פסטה", "רוטב"]);
  });

  it("splits 'and' only when it's clearly two products", () => {
    expect(brief("mac and cheese").map((item) => item.name)).toEqual(["mac and cheese"]);
    expect(brief("bread and 2 milk").map((item) => [item.name, item.quantity])).toEqual([
      ["bread", null],
      ["milk", 2],
    ]);
  });

  it("reads units in both languages", () => {
    expect(brief("2 ק״ג תפוחים, חצי קילו גבינה צהובה, milk 1 l, 500g cheese")).toEqual([
      { name: "תפוחים", quantity: 2, unit: "kg", unsure: false },
      { name: "גבינה צהובה", quantity: 0.5, unit: "kg", unsure: false },
      { name: "milk", quantity: 1, unit: "l", unsure: false },
      { name: "cheese", quantity: 500, unit: "g", unsure: false },
    ]);
  });
});

describe("readAmount", () => {
  it("leaves names with numbers that aren't quantities alone", () => {
    expect(readAmount("חלב 3%")).toMatchObject({ name: "חלב 3%", quantity: null });
    expect(readAmount("קולה 1.5")).toMatchObject({ name: "קולה 1.5", quantity: null });
    expect(readAmount("7up")).toMatchObject({ name: "7up", quantity: null });
  });

  it("reads fractions and multipliers", () => {
    expect(readAmount("1/2 אבטיח")).toMatchObject({ name: "אבטיח", quantity: 0.5 });
    expect(readAmount("½ kg cheese")).toMatchObject({ name: "cheese", quantity: 0.5, unit: "kg" });
    expect(readAmount("bread x2")).toMatchObject({ name: "bread", quantity: 2 });
    expect(readAmount("חלב 2 ליטר")).toMatchObject({ name: "חלב", quantity: 2, unit: "l" });
  });

  it("never reads a bare ל as liters", () => {
    expect(readAmount("2 ל חלב")).toMatchObject({ name: "ל חלב", unit: null });
    expect(readAmount("2 ל׳ חלב")).toMatchObject({ name: "חלב", quantity: 2, unit: "l" });
  });
});

describe("readLegacyNote", () => {
  it("converts only notes that are just an amount", () => {
    expect(readLegacyNote("2")).toEqual({ quantity: 2, unit: null });
    expect(readLegacyNote("2 ליטר")).toEqual({ quantity: 2, unit: "l" });
    expect(readLegacyNote("חצי קילו")).toEqual({ quantity: 0.5, unit: "kg" });
    expect(readLegacyNote("x3")).toEqual({ quantity: 3, unit: null });
    expect(readLegacyNote("500g")).toEqual({ quantity: 500, unit: "g" });
  });

  it("keeps everything else as a note", () => {
    for (const note of ["2 גדולים", "של תנובה", "2-3", "שתיים", "3%", "", null]) expect(readLegacyNote(note)).toBeNull();
  });
});

describe("mergeAmounts", () => {
  it("adds matching and convertible units", () => {
    expect(mergeAmounts({ quantity: 2, unit: null }, { quantity: 1, unit: "unit" })).toEqual({
      options: [{ quantity: 3, unit: null }, { quantity: 2, unit: null }, { quantity: 1, unit: "unit" }],
      pick: 0,
    });
    expect(mergeAmounts({ quantity: 1, unit: "kg" }, { quantity: 500, unit: "g" }).options[0]).toEqual({ quantity: 1.5, unit: "kg" });
    expect(mergeAmounts({ quantity: 250, unit: "ml" }, { quantity: 1, unit: "l" }).options[0]).toEqual({ quantity: 1250, unit: "ml" });
  });

  it("asks when units don't match", () => {
    const result = mergeAmounts({ quantity: 2, unit: "l" }, { quantity: 1, unit: "pack" });
    expect(result.pick).toBeNull();
    expect(result.options).toEqual([{ quantity: 2, unit: "l" }, { quantity: 1, unit: "pack" }]);
  });

  it("keeps the only amount there is", () => {
    expect(mergeAmounts({ quantity: null, unit: null }, { quantity: 2, unit: "kg" })).toEqual({ options: [{ quantity: 2, unit: "kg" }], pick: 0 });
  });
});

describe("formatAmount", () => {
  const labels = { one: { unit: "יח׳", pack: "אריזה", kg: "ק״ג", g: "גרם", l: "ליטר", ml: "מ״ל" }, many: { unit: "יח׳", pack: "אריזות", kg: "ק״ג", g: "גרם", l: "ליטר", ml: "מ״ל" } };
  it("writes short amounts", () => {
    expect(formatAmount({ quantity: 2, unit: null }, "he", labels)).toBe("2");
    expect(formatAmount({ quantity: 1, unit: "pack" }, "he", labels)).toBe("1 אריזה");
    expect(formatAmount({ quantity: 1.5, unit: "kg" }, "he", labels)).toBe("1.5 ק״ג");
    expect(formatAmount({ quantity: null, unit: null }, "he", labels)).toBeNull();
  });
});

const item = (over: Partial<ShoppingItem> & { id: string; name: string }): ShoppingItem => ({
  quantity: null,
  unit: null,
  note: null,
  photoPath: null,
  category: null,
  addedBy: "dana",
  requestedBy: [],
  checkedAt: null,
  checkedBy: null,
  missingAt: null,
  substituteMode: null,
  substitute: null,
  eventId: null,
  taskId: null,
  createdAt: "2026-11-01T10:00:00Z",
  ...over,
});

describe("similarity", () => {
  it("matches spelling, plurals, geresh and language", () => {
    expect(similarKey("קוטג'")).toBe(similarKey("קוטג"));
    expect(similarKey("עגבניה")).toBe(similarKey("עגבניות"));
    expect(similarKey("עגבנייה")).toBe(similarKey("עגבניה"));
    expect(similarKey("Milk")).toBe(similarKey("חלב"));
    expect(similarKey("tomatoes")).toBe(similarKey("tomato"));
  });

  it("keeps different products apart", () => {
    expect(similarKey("חלב")).not.toBe(similarKey("חלב שיבולת שועל"));
    expect(similarKey("milk")).not.toBe(similarKey("oat milk"));
    expect(similarKey("שמן")).not.toBe(similarKey("שמנת"));
  });

  it("has a Hebrew name for every English one", () => {
    expect(groceryPairs.every(([he, en]) => he && en)).toBe(true);
  });

  it("pairs near-duplicates, skips kept-apart pairs and different events", () => {
    const a = item({ id: "a", name: "חלב" });
    const b = item({ id: "b", name: "Milk" });
    expect(similarPairs([a, b], new Set()).map(([x, y]) => [x.id, y.id])).toEqual([["a", "b"]]);
    expect(similarPairs([a, b], new Set([pairKey("Milk", "חלב")]))).toEqual([]);
    const c = item({ id: "c", name: "עוגה", eventId: "e1" });
    const d = item({ id: "d", name: "עוגות", eventId: "e2" });
    expect(similarPairs([c, d], new Set())).toEqual([]);
  });
});

describe("planMerge", () => {
  it("keeps photos, both notes, every requester and the event", () => {
    const a = item({ id: "a", name: "חלב", quantity: 1, unit: "l", note: "תנובה", addedBy: "dana", createdAt: "2026-11-01T10:00:00Z" });
    const b = item({ id: "b", name: "חלב", quantity: 500, unit: "ml", note: "3%", photoPath: "p.jpg", addedBy: "omer", eventId: "e1" });
    const plan = planMerge(a, b);
    expect(plan.keep.id).toBe("b");
    expect(plan.notes).toEqual(["3% · תנובה", "3%", "תנובה"]);
    expect(plan.photos).toEqual(["p.jpg"]);
    const choice = defaultChoice(plan)!;
    expect(choice.amount).toEqual({ quantity: 1500, unit: "ml" });
    const merged = mergedItem(plan, choice);
    expect(merged).toMatchObject({ id: "b", quantity: 1500, unit: "ml", note: "3% · תנובה", photoPath: "p.jpg", eventId: "e1", requestedBy: ["dana"] });
  });

  it("offers either photo when both have one", () => {
    const plan = planMerge(item({ id: "a", name: "גבינה", photoPath: "a.jpg" }), item({ id: "b", name: "גבינה", photoPath: "b.jpg" }));
    expect(plan.photos).toEqual(["a.jpg", "b.jpg"]);
  });

  it("has no default when the units can't be added", () => {
    const plan = planMerge(item({ id: "a", name: "חלב", quantity: 2, unit: "l" }), item({ id: "b", name: "חלב", quantity: 1, unit: "pack" }));
    expect(defaultChoice(plan)).toBeNull();
  });
});

const trip = (id: string, finishedAt: string, names: string[], undoneAt: string | null = null): ShoppingTrip => ({
  id,
  finishedAt,
  finishedBy: "dana",
  undoneAt,
  missing: [],
  items: names.map((name) => ({ itemId: `${id}-${name}`, name, quantity: name === "חלב" ? 2 : null, unit: name === "חלב" ? "l" : null, note: null, category: null, checkedBy: "dana" })),
});

describe("suggestProducts", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");
  const starters = ["חלב", "לחם", "ביצים"];

  it("offers the starter list to a house without history", () => {
    const out = suggestProducts({ trips: [], products: [], onList: ["לחם"], starters, now });
    expect(out.map((s) => [s.name, s.reason.kind])).toEqual([
      ["חלב", "starter"],
      ["ביצים", "starter"],
    ]);
  });

  it("uses what the house actually bought, most overdue first, with a true reason", () => {
    const trips = [
      trip("t1", "2026-11-01T10:00:00Z", ["חלב", "קפה", "שמפו"]),
      trip("t2", "2026-11-08T10:00:00Z", ["חלב", "קפה"]),
      trip("t3", "2026-11-12T10:00:00Z", ["חלב"]),
      trip("t4", "2026-11-19T10:00:00Z", ["קפה", "שמפו"], "2026-11-19T11:00:00Z"),
    ];
    const out = suggestProducts({ trips, products: [], onList: [], starters, now });
    expect(out.map((s) => s.name)).toEqual(["קפה", "חלב"]);
    expect(out[0].reason).toEqual({ kind: "habit", lastDays: 12, everyDays: 7, times: 2 });
    expect(out[1]).toMatchObject({ quantity: 2, unit: "l", reason: { kind: "habit", lastDays: 8, times: 3 } });
  });

  it("doesn't offer what was just bought", () => {
    const fresh = [trip("t1", "2026-11-19T10:00:00Z", ["חלב"])];
    expect(suggestProducts({ trips: fresh, products: [], onList: [], starters, now }).map((s) => s.name)).toEqual(["לחם", "ביצים"]);
    expect(suggestProducts({ trips: fresh, products: [], onList: [], starters: ["Milk", "Bread"], now }).map((s) => s.name)).toEqual(["Bread"]);
    const weekly = [trip("t1", "2026-11-05T10:00:00Z", ["קפה"]), trip("t2", "2026-11-12T10:00:00Z", ["קפה"]), trip("t3", "2026-11-19T10:00:00Z", ["קפה"])];
    expect(suggestProducts({ trips: weekly, products: [], onList: [], starters, now })).toEqual([]);
  });

  it("skips what's on the list, near-duplicates of it, and dismissed products", () => {
    const trips = [trip("t1", "2026-11-01T10:00:00Z", ["חלב", "קפה"]), trip("t2", "2026-11-08T10:00:00Z", ["חלב", "קפה"])];
    const products = [{ key: "קפה", name: null, staple: false, quantity: null, unit: null, note: null, renamedTo: null, dismissedUntil: "2026-11-22T00:00:00Z" }];
    expect(suggestProducts({ trips, products, onList: ["Milk"], starters, now })).toEqual([]);
    const later = Date.parse("2026-11-23T00:00:00Z");
    expect(suggestProducts({ trips, products, onList: ["Milk"], starters, now: later }).map((s) => s.name)).toEqual(["קפה"]);
  });

  it("puts staples first with their usual amount", () => {
    const products = [{ key: "ביצים", name: "ביצים", staple: true, quantity: 12, unit: null, note: "L", renamedTo: null, dismissedUntil: null }];
    const out = suggestProducts({ trips: [], products, onList: [], starters, now });
    expect(out[0]).toMatchObject({ name: "ביצים", quantity: 12, note: "L", reason: { kind: "staple", lastDays: null } });
    const english = suggestProducts({ trips: [], products, onList: [], starters: ["Eggs", "Bread"], now });
    expect(english.map((s) => s.name)).toEqual(["ביצים", "Bread"]);
  });
});
