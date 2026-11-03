import { describe, expect, it } from "vitest";
import { asUser, freshDatabase, seedHouses } from "./harness";

describe("local database", () => {
  it("applies every migration and keeps houses apart", async () => {
    const db = await freshDatabase();
    const ids = await seedHouses(db);
    const seen = await asUser(db, ids.a, () => db.query<{ id: string }>("select id from public.households"));
    expect(seen.rows.map((row) => row.id)).toEqual([ids.house]);
  }, 60_000);
});
