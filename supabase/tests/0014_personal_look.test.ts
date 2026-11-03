import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, freshDatabase, seedHouses } from "./harness";

type Ids = Awaited<ReturnType<typeof seedHouses>>;

let db: PGlite;
let ids: Ids;

const failure = async (work: () => Promise<unknown>) => {
  try {
    await work();
  } catch (error) {
    return (error as Error).message;
  }
  return null;
};

const asServer = async <T>(work: () => Promise<T>) => {
  await db.exec("set role service_role");
  try {
    return await work();
  } finally {
    await db.exec("reset role");
  }
};

const profile = async (id: string) =>
  (await db.query<{ prefs: Record<string, unknown> | null; prefs_rev: string; display_name: string | null }>("select prefs, prefs_rev::text, display_name from public.profiles where id = $1", [id])).rows[0];

beforeEach(async () => {
  db = await freshDatabase();
  ids = await seedHouses(db);
  await db.exec(`insert into public.profiles (id) values ('${ids.a}'), ('${ids.b}'), ('${ids.c}') on conflict (id) do nothing`);
});

describe("choices are written by the server only", () => {
  it("refuses a parent writing prefs directly, still lets them rename themselves, and counts each server write", async () => {
    const direct = await failure(() => asUser(db, ids.a, () => db.query(`update public.profiles set prefs = '{"v":2}' where id = $1`, [ids.a])));
    expect(direct).toContain("prefs");

    await asUser(db, ids.a, () => db.query("update public.profiles set display_name = 'Dana', prefs_rev = 99 where id = $1", [ids.a]));
    expect(await profile(ids.a)).toMatchObject({ display_name: "Dana", prefs_rev: "0" });

    await asServer(() => db.query(`update public.profiles set prefs = '{"v":2,"delivery":"digest"}' where id = $1`, [ids.a]));
    await asServer(() => db.query(`update public.profiles set prefs = '{"v":2,"delivery":"instant"}' where id = $1`, [ids.a]));
    expect(await profile(ids.a)).toMatchObject({ prefs: { v: 2, delivery: "instant" }, prefs_rev: "2" });
  });

  it("only lands a write made against the revision it read", async () => {
    await asServer(() => db.query(`update public.profiles set prefs = '{"v":2}' where id = $1`, [ids.a]));
    const stale = await asServer(() => db.query(`update public.profiles set prefs = '{"v":2,"x":1}' where id = $1 and prefs_rev = 0 returning id`, [ids.a]));
    expect(stale.rows).toEqual([]);
    const fresh = await asServer(() => db.query(`update public.profiles set prefs = '{"v":2,"x":1}' where id = $1 and prefs_rev = 1 returning id`, [ids.a]));
    expect(fresh.rows).toHaveLength(1);
  });

  it("refuses an oversized blob of choices", async () => {
    const big = JSON.stringify({ v: 2, junk: "x".repeat(40_000) });
    expect(await failure(() => asServer(() => db.query("update public.profiles set prefs = $1::jsonb where id = $2", [big, ids.a])))).toContain("prefs size");
  });
});

describe("sharing a look", () => {
  const offer = {
    theme: "warm",
    accent: { kind: "custom", hex: "#aa5533" },
    cards: "glass",
    density: "compact",
    text: "5",
    motion: "none",
    notify: { tasks: false },
    background: { kind: "photo", photo: { path: "backgrounds/a/x.webp" } },
  };

  it("keeps only what a look may carry, never a photo, and replaces an unanswered earlier offer", async () => {
    await asUser(db, ids.a, () => db.query("select public.share_look($1, $2)", [ids.b, JSON.stringify({ ...offer, theme: "clean" })]));
    await asUser(db, ids.a, () => db.query("select public.share_look($1, $2)", [ids.b, JSON.stringify(offer)]));
    const seen = await asUser(db, ids.b, async () => (await db.query<{ look: unknown; from_user: string }>("select look, from_user from public.theme_shares where answered_at is null")).rows);
    expect(seen).toEqual([{ from_user: ids.a, look: { theme: "warm", accent: { kind: "custom", hex: "#aa5533" }, cards: "glass", density: "compact" } }]);

    await asUser(db, ids.a, () => db.query("select public.share_look($1, $2)", [ids.b, JSON.stringify({ ...offer, background: { kind: "gradient", gradient: "sea", photo: { path: "p" } } })]));
    const latest = await asUser(db, ids.b, async () => (await db.query<{ look: { background: unknown } }>("select look from public.theme_shares where answered_at is null")).rows);
    expect(latest.map((row) => row.look.background)).toEqual([{ kind: "gradient", gradient: "sea" }]);
  });

  it("stays between the two parents of one house", async () => {
    expect(await failure(() => asUser(db, ids.a, () => db.query("select public.share_look($1, $2)", [ids.c, JSON.stringify(offer)])))).toContain("missing");
    expect(await failure(() => asUser(db, ids.a, () => db.query("select public.share_look($1, $2)", [ids.a, JSON.stringify(offer)])))).toContain("missing");
    await asUser(db, ids.a, () => db.query("select public.share_look($1, $2)", [ids.b, JSON.stringify(offer)]));
    expect(await asUser(db, ids.c, async () => (await db.query("select * from public.theme_shares")).rows)).toEqual([]);
    expect(
      await failure(() =>
        asUser(db, ids.b, () => db.query(`insert into public.theme_shares (household_id, from_user, to_user, look) values ($1, $2, $3, '{}')`, [ids.house, ids.b, ids.a])),
      ),
    ).not.toBeNull();
  });

  it("is answered only by its recipient, once", async () => {
    const id = await asUser(db, ids.a, async () => (await db.query<{ share_look: string }>("select public.share_look($1, $2)", [ids.b, JSON.stringify(offer)])).rows[0].share_look);
    await asUser(db, ids.a, () => db.query("select public.answer_look_share($1, true)", [id]));
    await asUser(db, ids.c, () => db.query("select public.answer_look_share($1, true)", [id]));
    const open = await db.query<{ answer: string | null }>("select answer from public.theme_shares where id = $1", [id]);
    expect(open.rows).toEqual([{ answer: null }]);

    await asUser(db, ids.b, () => db.query("select public.answer_look_share($1, false)", [id]));
    await asUser(db, ids.b, () => db.query("select public.answer_look_share($1, true)", [id]));
    const answered = await db.query<{ answer: string | null }>("select answer from public.theme_shares where id = $1", [id]);
    expect(answered.rows).toEqual([{ answer: "declined" }]);
  });
});

describe("what the server already sent", () => {
  it("is out of reach for signed-in parents", async () => {
    await db.query("insert into public.notify_state (user_id, morning_sent_on) values ($1, '2026-11-03')", [ids.a]);
    expect(await failure(() => asUser(db, ids.a, () => db.query("select * from public.notify_state")))).toContain("permission denied");
    expect(await failure(() => asUser(db, ids.a, () => db.query("delete from public.notify_state")))).toContain("permission denied");
    const kept = await asServer(async () => (await db.query("select user_id from public.notify_state")).rows);
    expect(kept).toEqual([{ user_id: ids.a }]);
  });
});

describe("background photos", () => {
  it("are visible to and removable by their owner only", async () => {
    // Supabase grants these on storage.objects; RLS is what decides.
    await db.exec("grant select, delete on storage.objects to authenticated");
    await db.query(
      `insert into storage.objects (bucket_id, name) values ('house-media', $1), ('house-media', $2)`,
      [`backgrounds/${ids.a}/one.webp`, `backgrounds/${ids.b}/two.webp`],
    );
    const mine = await asUser(db, ids.a, async () => (await db.query<{ name: string }>("select name from storage.objects where name like 'backgrounds/%'")).rows);
    expect(mine).toEqual([{ name: `backgrounds/${ids.a}/one.webp` }]);
    await asUser(db, ids.a, () => db.query("delete from storage.objects where name like 'backgrounds/%'"));
    const left = await db.query<{ name: string }>("select name from storage.objects order by name");
    expect(left.rows).toEqual([{ name: `backgrounds/${ids.b}/two.webp` }]);
  });
});

describe("house calendar", () => {
  it("names each event's calendar by a hash, and only when its details are shown", async () => {
    await db.exec(`
      insert into public.calendar_accounts (id, user_id, provider, subject, email) values
        ('20000000-0000-4000-8000-00000000000a', '${ids.a}', 'google', 'g-a', 'a@example.com');
      insert into public.calendar_sources (id, account_id, user_id, remote_id, source_key, name, selected, sharing, together) values
        ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'primary', 'sk1', 'Personal', true, 'details', false),
        ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'work', 'sk2', 'Work', true, 'busy', false);
      insert into public.calendar_events (id, source_id, household_id, owner_id, remote_id, fix_key, ical_uid, title, starts_at, ends_at, start_day, end_day, busy, marked_private, people, declined, link) values
        ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '${ids.house}', '${ids.a}', 'dentist', 'fx-1', 'u-1', 'Dentist', '2026-11-03 09:00+02', '2026-11-03 10:00+02', '2026-11-03', '2026-11-03', true, false, '{${ids.a}}', '{}', null),
        ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '${ids.house}', '${ids.a}', 'review', 'fx-2', 'u-2', 'Review', '2026-11-03 14:00+02', '2026-11-03 15:00+02', '2026-11-03', '2026-11-03', true, false, '{${ids.a}}', '{}', null);
    `);
    type Row = { title: string | null; detail: string; calendar_key: string | null };
    const partner = await asUser(db, ids.b, async () => (await db.query<Row>("select title, detail, calendar_key from public.house_calendar('2026-11-01', '2026-11-30')")).rows);
    expect(partner).toHaveLength(2);
    const shown = partner.find((row) => row.detail === "details")!;
    const busy = partner.find((row) => row.detail === "busy")!;
    expect(shown.calendar_key).toMatch(/^[0-9a-f]{32}$/);
    expect(busy).toMatchObject({ title: null, calendar_key: null });
    const owner = await asUser(db, ids.a, async () => (await db.query<Row>("select calendar_key from public.house_calendar('2026-11-01', '2026-11-30')")).rows);
    expect(new Set(owner.map((row) => row.calendar_key)).size).toBe(2);
    expect(owner.map((row) => row.calendar_key)).toContain(shown.calendar_key);
  });
});

describe("deleting an account", () => {
  it("isn't blocked by an event that names the parent as who goes, and keeps the event", async () => {
    await db.exec(`insert into public.events (id, household_id, title, date, attendee_id, created_by) values
      ('50000000-0000-4000-8000-000000000001', '${ids.house}', 'Dentist', '2026-11-03', '${ids.b}', '${ids.a}')`);
    await asUser(db, ids.b, () => db.query("select public.prepare_account_deletion()"));
    await db.query("delete from public.profiles where id = $1", [ids.b]);
    const event = (await db.query<{ attendee_id: string | null }>("select attendee_id from public.events where id = '50000000-0000-4000-8000-000000000001'")).rows;
    expect(event).toEqual([{ attendee_id: null }]);
  });
});
