import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A tiny stand-in for the house's Supabase project: shopping rows, the tombstones 0012 keeps for deleted
 * ones, and the trip functions. Enough to run the real outbox and store against it.
 */
const server = vi.hoisted(() => {
  type Row = Record<string, unknown> & { id: string };
  const state = {
    rows: new Map<string, Row>(),
    tombstones: new Set<string>(),
    trips: new Map<string, { id: string; items: string[] }>(),
    kept: new Set<string>(),
    products: new Map<string, Record<string, unknown>>(),
    rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
    failProducts: false,
    offline: false,
  };
  const result = (value: { data?: unknown; error?: unknown; status?: number }) => ({ data: null, error: null, status: 200, ...value });
  const offline = () => result({ error: { message: "Failed to fetch" }, status: 0 });

  const table = (name: string) => {
    let filterId: string | null = null;
    let action: { kind: "update" | "insert" | "delete" | "upsert"; payload?: Row } | null = null;
    const run = () => {
      if (state.offline) return offline();
      if (name === "shopping_products" || name === "shopping_kept_apart") {
        if (state.failProducts) return result({ error: { message: "denied", code: "42501" }, status: 403 });
        const payload = action?.payload as Record<string, string> | undefined;
        if (!action) return result({ data: name === "shopping_products" ? [...state.products.values()] : [...state.kept].map((pair_key) => ({ pair_key })) });
        if (name === "shopping_kept_apart" && payload) state.kept.add(payload.pair_key);
        if (name === "shopping_products" && payload) state.products.set(payload.item_key, payload);
        return result({});
      }
      if (name === "shopping_trips" || name === "shopping_groups") return result({ data: [] });
      if (name !== "shopping_items") return result({});
      if (action?.kind === "update") {
        const row = filterId ? state.rows.get(filterId) : undefined;
        if (!row) return result({ data: [] });
        state.rows.set(row.id, { ...row, ...action.payload });
        return result({ data: [{ id: row.id }] });
      }
      if (action?.kind === "insert") {
        const row = action.payload!;
        if (state.tombstones.has(row.id)) return result({ error: { message: "gone", code: "HM410" }, status: 400 });
        if (state.rows.has(row.id)) return result({ error: { message: "duplicate", code: "23505" }, status: 409 });
        state.rows.set(row.id, row);
        return result({});
      }
      if (action?.kind === "delete" && filterId) {
        state.rows.delete(filterId);
        state.tombstones.add(filterId);
      }
      return result({});
    };
    const builder = {
      update(payload: Row) {
        action = { kind: "update", payload };
        return builder;
      },
      insert(payload: Row) {
        action = { kind: "insert", payload };
        return builder;
      },
      upsert(payload: Row) {
        action = { kind: "upsert", payload };
        return builder;
      },
      delete() {
        action = { kind: "delete" };
        return builder;
      },
      eq(_column: string, value: string) {
        filterId = value;
        return builder;
      },
      select() {
        return builder;
      },
      order() {
        return builder;
      },
      limit() {
        return builder;
      },
      then(resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  };

  const db = {
    from: table,
    async rpc(name: string, args: Record<string, unknown>) {
      if (state.offline) return offline();
      state.rpcCalls.push({ name, args });
      if (name === "finish_shopping_trip") {
        const id = args.trip as string;
        if (!state.trips.has(id)) {
          const claimed = (args.item_ids as string[]).filter((itemId) => state.rows.get(itemId)?.checked_at && !state.rows.get(itemId)?.trip_id);
          if (claimed.length === 0) return result({ data: { status: "empty" } });
          state.trips.set(id, { id, items: claimed });
          for (const itemId of claimed) state.rows.set(itemId, { ...state.rows.get(itemId)!, trip_id: id });
        }
        return result({ data: { status: "done" } });
      }
      if (name === "undo_shopping_trip") {
        const trip = state.trips.get(args.trip as string);
        if (!trip) return result({ data: { status: "missing" } });
        for (const itemId of trip.items) state.rows.set(itemId, { ...state.rows.get(itemId)!, trip_id: null });
        return result({ data: { status: "done" } });
      }
      return result({});
    },
  };
  return { state, db };
});

vi.mock("./supabase/browser", () => ({ createBrowserSupabase: () => server.db }));
vi.mock("./supabase/env", () => ({ supabaseConfigured: () => true }));
vi.mock("./supabase/activity", () => ({ announce: async () => {} }));
vi.mock("./supabase/media", () => ({
  compressImage: async () => new Blob(),
  uploadShoppingPhoto: async () => "shopping/house/new.jpg",
  removeShoppingPhoto: vi.fn(async () => {}),
}));

const { useAuth } = await import("./auth/session");
const { useHousehold } = await import("./household-store");
const { flush, useOutbox, withPending } = await import("./supabase/outbox");
const { fromShoppingRow, loadShoppingExtras } = await import("./supabase/lists");
const { similarPairs } = await import("./similar");
const { planMerge, defaultChoice } = await import("./shopping-merge");

const settle = async () => {
  for (let i = 0; i < 5; i++) {
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

beforeEach(() => {
  server.state.rows.clear();
  server.state.tombstones.clear();
  server.state.trips.clear();
  server.state.kept.clear();
  server.state.products.clear();
  server.state.rpcCalls = [];
  server.state.failProducts = false;
  server.state.offline = false;
  useOutbox.setState({ queue: [] });
  useAuth.setState({
    session: { userId: "omer", email: "o@test", displayName: "Omer", householdId: "house", householdName: "Test", role: "member" },
  });
  useHousehold.getState().syncSelf({ id: "omer", name: "Omer", color: "var(--pink)" });
  useHousehold.setState({ listsLoaded: "house" });
});

describe("a row deleted on the other phone", () => {
  it("isn't re-created by a late save here, and leaves this phone too", async () => {
    const { id } = useHousehold.getState().addShoppingItem({ name: "לחם", note: null });
    await settle();
    expect(server.state.rows.has(id)).toBe(true);

    // Dana deletes it on her phone while Omer's phone is offline and edits it.
    server.state.rows.delete(id);
    server.state.tombstones.add(id);
    server.state.offline = true;
    useHousehold.getState().toggleShoppingItem(id);
    await settle();
    expect(useOutbox.getState().queue).toHaveLength(1);

    server.state.offline = false;
    await settle();
    expect(server.state.rows.has(id)).toBe(false);
    expect(useOutbox.getState().queue).toHaveLength(0);
    expect(useHousehold.getState().shopping.some((item) => item.id === id)).toBe(false);
  });
});

describe("the other parent adding the same item", () => {
  it("joins as someone who asked for it, once, on the server too", async () => {
    const { id } = useHousehold.getState().addShoppingItem({ name: "שמפו", note: null });
    await settle();
    useHousehold.setState({ currentUserId: "dana" });
    const again = useHousehold.getState().addShoppingItem({ name: "שמפו", note: null });
    useHousehold.getState().addShoppingItem({ name: "שמפו", note: null });
    await settle();
    expect(again).toMatchObject({ id, outcome: "exists" });
    expect(useHousehold.getState().shopping.find((item) => item.id === id)?.requestedBy).toEqual(["dana"]);
    expect(server.state.rows.get(id)?.requested_by).toEqual(["dana"]);
  });
});

describe("finishing a trip", () => {
  it("files only what's bought, once, and a second tap does nothing", async () => {
    const store = useHousehold.getState();
    const milk = store.addShoppingItem({ name: "חלב", note: null, quantity: 2, unit: "l" });
    const bread = store.addShoppingItem({ name: "לחם", note: null });
    const pesto = store.addShoppingItem({ name: "פסטו", note: null });
    useHousehold.getState().toggleShoppingItem(milk.id);
    useHousehold.getState().setMissing(pesto.id, true);
    await settle();

    const first = useHousehold.getState().finishTrip();
    const second = useHousehold.getState().finishTrip();
    expect(second).toBeNull();
    expect(first?.trip.items.map((line) => [line.name, line.quantity, line.unit])).toEqual([["חלב", 2, "l"]]);
    expect(first?.trip.missing.map((line) => line.name)).toEqual(["פסטו"]);
    expect(useHousehold.getState().shopping.map((item) => item.id).sort()).toEqual([bread.id, pesto.id].sort());

    // A reload that lands before the finish is sent doesn't bring the filed item back.
    const reloaded = withPending({ tasks: [], events: [], shopping: [...server.state.rows.values()].map((row) => ({ id: row.id }) as never) });
    expect(reloaded.shopping.map((row: { id: string }) => row.id)).not.toContain(milk.id);

    await settle();
    expect(server.state.rpcCalls.filter((call) => call.name === "finish_shopping_trip")).toHaveLength(1);
    expect(server.state.rows.get(milk.id)?.trip_id).toBe(first?.trip.id);
    expect(server.state.rows.get(pesto.id)?.trip_id).toBeUndefined();
  });

  it("retries the same trip after a dropped connection instead of making another", async () => {
    const milk = useHousehold.getState().addShoppingItem({ name: "חלב", note: null });
    useHousehold.getState().toggleShoppingItem(milk.id);
    await settle();
    server.state.offline = true;
    const done = useHousehold.getState().finishTrip()!;
    await settle();
    server.state.offline = false;
    await settle();
    await settle();
    expect(server.state.trips.size).toBe(1);
    expect(server.state.trips.has(done.trip.id)).toBe(true);
  });

  it("undone before it left the phone, never reaches the server", async () => {
    const milk = useHousehold.getState().addShoppingItem({ name: "חלב", note: null });
    useHousehold.getState().toggleShoppingItem(milk.id);
    await settle();
    server.state.offline = true;
    const done = useHousehold.getState().finishTrip()!;
    useHousehold.getState().undoTrip(done.trip.id, done.removed);
    expect(useOutbox.getState().queue.map((op) => op.action)).toEqual(["undo"]);
    expect(useHousehold.getState().shopping.map((item) => item.id)).toEqual([milk.id]);
    server.state.offline = false;
    await settle();
    expect(server.state.trips.size).toBe(0);
    expect(server.state.rows.get(milk.id)?.trip_id).toBeUndefined();
  });

  it("undone after it landed, puts the items back on the server", async () => {
    const milk = useHousehold.getState().addShoppingItem({ name: "חלב", note: null });
    useHousehold.getState().toggleShoppingItem(milk.id);
    await settle();
    const done = useHousehold.getState().finishTrip()!;
    await settle();
    useHousehold.getState().undoTrip(done.trip.id, done.removed);
    await settle();
    expect(server.state.rows.get(milk.id)?.trip_id).toBeNull();
    expect(useHousehold.getState().trips[0].undoneAt).not.toBeNull();
  });
});

describe("merging", () => {
  it("keeps both notes and the photo, and undo leaves a later edit alone", async () => {
    const store = useHousehold.getState();
    const a = store.addShoppingItem({ name: "חלב", note: "תנובה", quantity: 1, unit: "l" });
    useHousehold.setState(({ shopping }) => ({ shopping: shopping.map((item) => (item.id === a.id ? { ...item, photoPath: "p.jpg" } : item)) }));
    const b = useHousehold.getState().addShoppingItem({ name: "Milk", note: "3%", quantity: 500, unit: "ml" });
    const rows = useHousehold.getState().shopping;
    const plan = planMerge(rows.find((item) => item.id === a.id)!, rows.find((item) => item.id === b.id)!);
    const undo = useHousehold.getState().mergeShoppingItems(plan, defaultChoice(plan)!)!;
    const kept = useHousehold.getState().shopping;
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: a.id, quantity: 1.5, unit: "l", photoPath: "p.jpg" });
    expect(kept[0].note).toBe("תנובה · 3%");

    // The other parent changes the kept item before the undo.
    useHousehold.setState(({ shopping }) => ({ shopping: shopping.map((item) => ({ ...item, note: "של יאנה" })) }));
    undo();
    const after = useHousehold.getState().shopping;
    expect(after).toHaveLength(2);
    expect(after.find((item) => item.id === a.id)?.note).toBe("של יאנה");
  });

  it("undo right away restores both as they were", () => {
    const a = useHousehold.getState().addShoppingItem({ name: "ביצים", note: null, quantity: 12, unit: null });
    const b = useHousehold.getState().addShoppingItem({ name: "ביצה", note: null, quantity: 6, unit: null });
    const rows = useHousehold.getState().shopping;
    const plan = planMerge(rows.find((item) => item.id === a.id)!, rows.find((item) => item.id === b.id)!);
    const undo = useHousehold.getState().mergeShoppingItems(plan, defaultChoice(plan)!)!;
    expect(useHousehold.getState().shopping[0].quantity).toBe(18);
    undo();
    const after = useHousehold.getState().shopping;
    expect(after.map((item) => item.quantity).sort()).toEqual([12, 6].sort());
    expect(useOutbox.getState().queue.find((op) => op.id === b.id)?.action).toBe("save");
  });
});

describe("house habits", () => {
  it("puts a kept-apart pair back when the server refuses it", async () => {
    server.state.failProducts = true;
    const ok = await useHousehold.getState().keepApart("חלב", "חלב שיבולת שועל");
    expect(ok).toBe(false);
    expect(useHousehold.getState().keptApart).toEqual([]);
  });

  it("remembers a kept-apart pair when it lands", async () => {
    const ok = await useHousehold.getState().keepApart("חלב", "חלב שיבולת שועל");
    expect(ok).toBe(true);
    expect(useHousehold.getState().keptApart).toEqual(["חלב|חלב שיבולת שועל"]);
  });

  it("learns a corrected name for the house", async () => {
    const { id } = useHousehold.getState().addShoppingItem({ name: "חלב", note: null });
    useHousehold.getState().updateShoppingItem(id, {
      name: "חלב תנובה 3%",
      note: null,
      quantity: null,
      unit: null,
      substituteMode: null,
      substitute: null,
      taskId: null,
    });
    await settle();
    expect(useHousehold.getState().products["חלב"]?.renamedTo).toBe("חלב תנובה 3%");
  });

  it("keeps a kept-apart pair apart after a refresh, on the other phone too", async () => {
    const { addShoppingItem } = useHousehold.getState();
    addShoppingItem({ name: "עגבניות", note: null });
    addShoppingItem({ name: "עגבניה", note: null });
    expect(similarPairs(useHousehold.getState().shopping, new Set())).toHaveLength(1);
    await useHousehold.getState().keepApart("עגבניות", "עגבניה");
    // A fresh start: nothing local, everything from the server.
    useHousehold.setState({ keptApart: [], products: {} });
    useHousehold.getState().replaceExtras(await loadShoppingExtras("house"));
    const { shopping, keptApart } = useHousehold.getState();
    expect(keptApart).toHaveLength(1);
    expect(similarPairs(shopping, new Set(keptApart))).toEqual([]);
  });

  it("adds a corrected name as corrected, after a refresh too", async () => {
    const { id } = useHousehold.getState().addShoppingItem({ name: "חלב", note: null });
    useHousehold.getState().updateShoppingItem(id, { name: "חלב תנובה 3%", note: null, quantity: null, unit: null, substituteMode: null, substitute: null, taskId: null });
    await settle();
    useHousehold.getState().deleteShoppingItem(id);
    useHousehold.setState({ products: {} });
    useHousehold.getState().replaceExtras(await loadShoppingExtras("house"));
    const added = useHousehold.getState().addShoppingItem({ name: "חלב", note: null });
    expect(useHousehold.getState().shopping.find((item) => item.id === added.id)?.name).toBe("חלב תנובה 3%");
  });
});

describe("rows from before quantities", () => {
  const row = (note: string | null) => ({
    id: "r",
    name: "חלב",
    quantity: null,
    unit: null,
    quantity_note: note,
    photo_path: null,
    category: null,
    added_by: "dana",
    requested_by: null,
    checked_at: null,
    checked_by: null,
    missing_at: null,
    substitute_mode: null,
    substitute: null,
    event_id: null,
    task_id: null,
    created_at: "2026-11-01T10:00:00Z",
  });

  it("reads a note that's only an amount as the amount", () => {
    expect(fromShoppingRow(row("2 ליטר"))).toMatchObject({ quantity: 2, unit: "l", note: null });
  });

  it("keeps any other note exactly", () => {
    expect(fromShoppingRow(row("2 גדולים, של תנובה"))).toMatchObject({ quantity: null, unit: null, note: "2 גדולים, של תנובה" });
  });

  it("doesn't touch rows that already have an amount", () => {
    expect(fromShoppingRow({ ...row("2"), quantity: "3", unit: "pack" })).toMatchObject({ quantity: 3, unit: "pack", note: "2" });
  });
});
