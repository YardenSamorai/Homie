import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";
import { asUser, freshDatabase, seedHouses } from "./harness";

type Ids = Awaited<ReturnType<typeof seedHouses>>;
type Row = { id: string; detail: string; title: string | null; people: string[]; prep: string | null; link: string | null; source_name: string | null };

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

const calendarOf = (viewer: string) =>
  asUser(db, viewer, async () => (await db.query<Row>("select * from public.house_calendar('2026-11-01', '2026-11-30')")).rows);

/** Service-side setup, as the sync job would write it: one account per parent, calendars with their choices. */
async function seedCalendars() {
  await db.exec(`
    insert into public.calendar_accounts (id, user_id, provider, subject, email) values
      ('20000000-0000-4000-8000-00000000000a', '${ids.a}', 'google', 'g-a', 'a@example.com'),
      ('20000000-0000-4000-8000-00000000000b', '${ids.b}', 'microsoft', 'm-b', 'b@work.example');
    insert into public.calendar_sources (id, account_id, user_id, remote_id, source_key, name, selected, sharing, together) values
      ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'primary', 'sk1', 'Personal', true, 'details', false),
      ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'work', 'sk2', 'Work', true, 'busy', false),
      ('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'hidden', 'sk3', 'Hidden', false, null, false),
      ('30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'diary', 'sk4', 'Diary', true, 'private', false),
      ('30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-00000000000a', '${ids.a}', 'family', 'sk5', 'Family', true, 'details', true),
      ('30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-00000000000b', '${ids.b}', 'calendar', 'sk6', 'Calendar', true, 'details', false);
    insert into public.calendar_events (id, source_id, household_id, owner_id, remote_id, fix_key, ical_uid, title, starts_at, ends_at, start_day, end_day, busy, marked_private, people, declined, link) values
      ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '${ids.house}', '${ids.a}', 'dentist', 'fx-dentist', 'u-dentist', 'Dentist', '2026-11-03 09:00+02', '2026-11-03 10:00+02', '2026-11-03', '2026-11-03', true, false, '{${ids.a}}', '{}', 'https://calendar.google.com/x'),
      ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '${ids.house}', '${ids.a}', 'doctor', 'fx-doctor', 'u-doctor', 'Therapy', '2026-11-03 12:00+02', '2026-11-03 13:00+02', '2026-11-03', '2026-11-03', true, true, '{${ids.a}}', '{}', 'https://calendar.google.com/y'),
      ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '${ids.house}', '${ids.a}', 'sync', 'fx-sync', 'u-sync', 'Board review', '2026-11-03 14:00+02', '2026-11-03 15:00+02', '2026-11-03', '2026-11-03', true, false, '{${ids.a}}', '{}', 'https://calendar.google.com/z'),
      ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', '${ids.house}', '${ids.a}', 'free', 'fx-free', 'u-free', 'Optional talk', '2026-11-03 16:00+02', '2026-11-03 17:00+02', '2026-11-03', '2026-11-03', false, false, '{${ids.a}}', '{}', null),
      ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000003', '${ids.house}', '${ids.a}', 'q', 'fx-q', null, 'Not chosen', '2026-11-04 09:00+02', '2026-11-04 10:00+02', '2026-11-04', '2026-11-04', true, false, '{${ids.a}}', '{}', null),
      ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000004', '${ids.house}', '${ids.a}', 'r', 'fx-r', null, 'Secret', '2026-11-04 11:00+02', '2026-11-04 12:00+02', '2026-11-04', '2026-11-04', true, false, '{${ids.a}}', '{}', null),
      ('40000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000005', '${ids.house}', '${ids.a}', 'dinner', 'fx-dinner', 'u-dinner', 'Family dinner', '2026-11-05 19:00+02', '2026-11-05 21:00+02', '2026-11-05', '2026-11-05', true, false, '{${ids.a}}', '{${ids.b}}', null),
      ('40000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000002', '${ids.house}', '${ids.a}', 'm-a', 'fx-m-a', 'u-meeting', 'Joint meeting', '2026-11-06 10:00+02', '2026-11-06 11:00+02', '2026-11-06', '2026-11-06', true, false, '{${ids.a},${ids.b}}', '{}', null),
      ('40000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000006', '${ids.house}', '${ids.b}', 'm-b', 'fx-m-b', 'u-meeting', 'Joint meeting', '2026-11-06 10:00+02', '2026-11-06 11:00+02', '2026-11-06', '2026-11-06', true, false, '{${ids.a},${ids.b}}', '{}', null);
  `);
}

beforeEach(async () => {
  db = await freshDatabase();
  ids = await seedHouses(db);
});

describe("pinned house note", () => {
  it("lets both parents edit, refuses an edit made over a newer note, and stays inside the house", async () => {
    const first = await asUser(db, ids.a, async () =>
      (await db.query<{ version: string }>("select version from public.pin_house_note('Plumber at 10', null, null)")).rows[0],
    );
    const seen = await asUser(db, ids.b, async () => (await db.query<{ body: string; version: string }>("select body, version from public.house_notes")).rows);
    expect(seen).toEqual([{ body: "Plumber at 10", version: first.version }]);

    await asUser(db, ids.b, () => db.query("select public.pin_house_note('Plumber at 11', null, $1)", [first.version]));
    const stale = await failure(() => asUser(db, ids.a, () => db.query("select public.pin_house_note('Plumber at 9', null, $1)", [first.version])));
    expect(stale).toContain("stale");
    const fresh = await failure(() => asUser(db, ids.a, () => db.query("select public.pin_house_note('Another', null, null)")));
    expect(fresh).toContain("stale");
    expect(await failure(() => asUser(db, ids.a, () => db.query("select public.clear_house_note($1)", [first.version])))).toContain("stale");

    const stranger = await asUser(db, ids.c, async () => (await db.query("select * from public.house_notes")).rows);
    expect(stranger).toEqual([]);
    expect(await failure(() => asUser(db, ids.c, () => db.exec("update public.house_notes set body = 'x'")))).toBeNull();
    const after = await asUser(db, ids.a, async () => (await db.query<{ body: string }>("select body from public.house_notes")).rows);
    expect(after).toEqual([{ body: "Plumber at 11" }]);
  });

  it("refuses a date that has passed, says 'gone' when the note was taken down, and replaces an expired one", async () => {
    expect(await failure(() => asUser(db, ids.a, () => db.query("select public.pin_house_note('Old', '2000-01-01', null)")))).toContain("past");
    const pinned = await asUser(db, ids.a, async () => (await db.query<{ version: string }>("select version from public.pin_house_note('Hi', null, null)")).rows[0]);
    await asUser(db, ids.b, () => db.query("select public.clear_house_note($1)", [pinned.version]));
    expect(await failure(() => asUser(db, ids.a, () => db.query("select public.pin_house_note('Hi again', null, $1)", [pinned.version])))).toContain("gone");

    await asUser(db, ids.a, () => db.query("select public.pin_house_note('Today only', null, null)"));
    await db.exec(`update public.house_notes set until = current_date - 2`);
    await asUser(db, ids.b, () => db.query("select public.pin_house_note('New day', null, null)"));
    const rows = await asUser(db, ids.a, async () => (await db.query<{ body: string; author_id: string }>("select body, author_id from public.house_notes")).rows);
    expect(rows).toEqual([{ body: "New day", author_id: ids.b }]);
  });
});

describe("imported calendars", () => {
  beforeEach(seedCalendars);

  it("gives the other parent details, a busy block or nothing, per calendar and per event", async () => {
    const rows = await calendarOf(ids.b);
    const byId = new Map(rows.map((row) => [row.id, row]));

    const dentist = byId.get("40000000-0000-4000-8000-000000000001")!;
    expect(dentist).toMatchObject({ detail: "details", title: "Dentist", source_name: "Personal", link: "https://calendar.google.com/x" });

    // Private at the source, inside a calendar shared in full: still only a busy block.
    const therapy = byId.get("40000000-0000-4000-8000-000000000002")!;
    expect(therapy).toMatchObject({ detail: "busy", title: null, link: null, source_name: null, prep: null, people: [ids.a] });

    const work = byId.get("40000000-0000-4000-8000-000000000003")!;
    expect(work).toMatchObject({ detail: "busy", title: null, link: null, people: [ids.a] });

    // Free time in a busy-only calendar isn't a block; not chosen and private calendars give nothing.
    for (const hidden of ["004", "005", "006"]) expect(byId.has(`40000000-0000-4000-8000-000000000${hidden}`)).toBe(false);

    expect(JSON.stringify(rows)).not.toMatch(/Therapy|Board review|Secret|Not chosen|Optional talk/);
  });

  it("never lets the other parent read the raw rows, the corrections or the tokens", async () => {
    await db.exec(`insert into public.calendar_secrets (account_id, sealed) values ('20000000-0000-4000-8000-00000000000a', 'v1.sealed')`);
    const raw = await asUser(db, ids.b, async () => (await db.query<{ title: string }>("select title from public.calendar_events")).rows);
    expect(raw.map((row) => row.title)).toEqual(["Joint meeting"]);
    expect(await failure(() => asUser(db, ids.b, () => db.query("select * from public.calendar_secrets")))).toMatch(/permission denied/);
    expect(await failure(() => asUser(db, ids.a, () => db.query("select * from public.calendar_secrets")))).toMatch(/permission denied/);
    expect(await failure(() => asUser(db, ids.a, () => db.query("select * from public.calendar_sync_state")))).toMatch(/permission denied/);
    expect(await failure(() => asUser(db, ids.b, () => db.query("select * from public.calendar_event_fixes")))).toMatch(/permission denied/);
    const accounts = await asUser(db, ids.b, async () => (await db.query<{ email: string }>("select email from public.calendar_accounts")).rows);
    expect(accounts).toEqual([{ email: "b@work.example" }]);
    expect(await failure(() => asUser(db, ids.b, () => db.exec("update public.calendar_sources set sharing = 'details'")))).toMatch(/permission denied/);
  });

  it("shows another house nothing", async () => {
    expect(await calendarOf(ids.c)).toEqual([]);
  });

  it("shows the owner every chosen event in full", async () => {
    const titles = (await calendarOf(ids.a)).map((row) => row.title).sort();
    expect(titles).toEqual(["Board review", "Dentist", "Family dinner", "Joint meeting", "Joint meeting", "Optional talk", "Secret", "Therapy"]);
  });

  it("counts both parents in on a house calendar, except whoever declined", async () => {
    const dinner = (await calendarOf(ids.a)).find((row) => row.id === "40000000-0000-4000-8000-000000000007")!;
    expect(dinner.people).toEqual([ids.a]);
    await db.exec(`update public.calendar_events set declined = '{}' where id = '40000000-0000-4000-8000-000000000007'`);
    const again = (await calendarOf(ids.a)).find((row) => row.id === "40000000-0000-4000-8000-000000000007")!;
    expect([...again.people].sort()).toEqual([ids.a, ids.b].sort());
  });

  it("leaves out a busy copy of a meeting the viewer already sees in full", async () => {
    const rows = await calendarOf(ids.b);
    const meeting = rows.filter((row) => row.id === "40000000-0000-4000-8000-000000000008" || row.id === "40000000-0000-4000-8000-000000000009");
    expect(meeting.map((row) => row.id)).toEqual(["40000000-0000-4000-8000-000000000009"]);

    // Without the other parent in the viewer's own copy, the busy block is real information and stays.
    await db.exec(`update public.calendar_events set people = '{${ids.b}}' where id = '40000000-0000-4000-8000-000000000009'`);
    const apart = (await calendarOf(ids.b)).filter((row) => row.id.endsWith("08") || row.id.endsWith("09"));
    expect(apart.map((row) => row.detail).sort()).toEqual(["busy", "details"]);
  });

  it("keeps the house's corrections to itself and to who may see the event", async () => {
    await asUser(db, ids.b, () =>
      db.query("select public.fix_calendar_event($1, $2, $3)", ["40000000-0000-4000-8000-000000000001", [ids.a, ids.b, ids.c], "Bring the forms"]),
    );
    const dentist = (await calendarOf(ids.a)).find((row) => row.id === "40000000-0000-4000-8000-000000000001")!;
    expect(dentist.prep).toBe("Bring the forms");
    expect([...dentist.people].sort()).toEqual([ids.a, ids.b].sort());

    const busy = await failure(() =>
      asUser(db, ids.b, () => db.query("select public.fix_calendar_event($1, $2, $3)", ["40000000-0000-4000-8000-000000000002", [ids.b], "x"])),
    );
    expect(busy).toContain("missing");
    const stranger = await failure(() =>
      asUser(db, ids.c, () => db.query("select public.fix_calendar_event($1, $2, $3)", ["40000000-0000-4000-8000-000000000001", [ids.c], "x"])),
    );
    expect(stranger).toMatch(/missing|auth/);

    await asUser(db, ids.a, () => db.query("select public.fix_calendar_event($1, null, '')", ["40000000-0000-4000-8000-000000000001"]));
    const cleared = (await calendarOf(ids.a)).find((row) => row.id === "40000000-0000-4000-8000-000000000001")!;
    expect(cleared).toMatchObject({ prep: null, fixed: false, people: [ids.a] });
  });

  it("asks for an explicit choice, only from the owner, and turning a calendar off removes what it brought", async () => {
    const sk1 = "30000000-0000-4000-8000-000000000001";
    expect(await failure(() => asUser(db, ids.a, () => db.query("select public.choose_calendar($1, true, null, null)", ["30000000-0000-4000-8000-000000000003"])))).toContain("sharing");
    expect(await failure(() => asUser(db, ids.b, () => db.query("select public.choose_calendar($1, true, 'details', false)", [sk1])))).toContain("missing");

    await asUser(db, ids.a, () => db.query("select public.fix_calendar_event($1, null, 'Forms')", ["40000000-0000-4000-8000-000000000001"]));
    await asUser(db, ids.a, () => db.query("select public.choose_calendar($1, false, null, null)", [sk1]));
    const left = await db.query<{ n: number }>(`select count(*)::int as n from public.calendar_events where source_id = '${sk1}'`);
    const fixes = await db.query<{ n: number }>(`select count(*)::int as n from public.calendar_event_fixes where source_key = 'sk1'`);
    expect([left.rows[0].n, fixes.rows[0].n]).toEqual([0, 0]);
  });

  it("takes back what a parent imported when they leave or are removed", async () => {
    await asUser(db, ids.a, () => db.query("select public.remove_household_member($1)", [ids.b]));
    const theirs = await db.query<{ n: number }>(`select count(*)::int as n from public.calendar_events where owner_id = '${ids.b}'`);
    const sources = await db.query<{ selected: boolean; sharing: string | null }>(`select selected, sharing from public.calendar_sources where user_id = '${ids.b}'`);
    expect(theirs.rows[0].n).toBe(0);
    expect(sources.rows).toEqual([{ selected: false, sharing: null }]);
    expect((await calendarOf(ids.b)).length).toBe(0);
    expect((await calendarOf(ids.a)).every((row) => row.id !== "40000000-0000-4000-8000-000000000009")).toBe(true);

    await asUser(db, ids.a, () => db.query("select public.leave_household()"));
    const mine = await db.query<{ n: number }>(`select count(*)::int as n from public.calendar_events where owner_id = '${ids.a}'`);
    expect(mine.rows[0].n).toBe(0);
  });
});
