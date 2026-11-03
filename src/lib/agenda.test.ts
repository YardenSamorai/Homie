import { describe, expect, it } from "vitest";
import he from "@/i18n/dictionaries/he.json";
import en from "@/i18n/dictionaries/en.json";
import { agendaFor, foldBusy, happeningNow, matchesFilter, mergeCopies, pickForToday, stillOn, type CalendarRow } from "./agenda";
import { summarizeToday } from "./day-story";
import type { HouseEvent } from "./household";

const at = (day: number, hour: number, minute = 0) => new Date(2026, 10, day, hour, minute).toISOString();

const row = (over: Partial<CalendarRow>): CalendarRow => ({
  id: "r1",
  owner_id: "me",
  detail: "details",
  provider: "google",
  source_name: "Work",
  title: "Standup",
  all_day: false,
  starts_at: at(3, 9),
  ends_at: at(3, 9, 30),
  start_day: "2026-11-03",
  end_day: "2026-11-03",
  tentative: false,
  people: ["me"],
  fixed: false,
  prep: null,
  link: null,
  match_key: null,
  ...over,
});

const homeEvent = (over: Partial<HouseEvent>): HouseEvent =>
  ({ id: "h1", title: "Dinner", date: "2026-11-03", time: "19:00", prep: null, attendeeId: null, ...over }) as HouseEvent;

describe("mergeCopies", () => {
  it("joins two copies of one meeting only on the same match key, the viewer's copy first", () => {
    const items = mergeCopies(
      [
        row({ id: "theirs", owner_id: "partner", people: ["partner"], match_key: "k1", source_name: "Family", link: "https://a" }),
        row({ id: "mine", owner_id: "me", people: ["me"], match_key: "k1", link: "https://b" }),
      ],
      "me",
    );
    expect(items).toHaveLength(1);
    expect(items[0].ids).toEqual(["mine", "theirs"]);
    expect(items[0].people.sort()).toEqual(["me", "partner"]);
    expect(items[0].link).toBe("https://b");
    expect(items[0].sourceName).toBe("Work");
  });

  it("never merges on title and time alone, and never merges busy blocks", () => {
    const items = mergeCopies(
      [
        row({ id: "a", match_key: null }),
        row({ id: "b", owner_id: "partner", match_key: null }),
        row({ id: "c", owner_id: "partner", detail: "busy", title: null, match_key: null }),
      ],
      "me",
    );
    expect(items.map((item) => item.id).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("agendaFor", () => {
  it("puts a meeting that crosses midnight on both days, the second as a continuation", () => {
    const items = mergeCopies([row({ starts_at: at(3, 22), ends_at: at(4, 1, 30), end_day: "2026-11-04" })], "me");
    const first = agendaFor("2026-11-03", [], items);
    const second = agendaFor("2026-11-04", [], items);
    expect(first[0]).toMatchObject({ start: 22 * 60, end: 24 * 60, startLabel: "22:00", endLabel: null, continues: false });
    expect(second[0]).toMatchObject({ start: 0, end: 90, startLabel: null, endLabel: "01:30", continues: true });
  });

  it("doesn't spill a meeting that ends exactly at midnight into the next day", () => {
    const items = mergeCopies([row({ starts_at: at(3, 23), ends_at: at(4, 0) })], "me");
    expect(agendaFor("2026-11-04", [], items)).toEqual([]);
    expect(agendaFor("2026-11-03", [], items)[0]).toMatchObject({ start: 23 * 60, end: 24 * 60 });
  });

  it("shows an all-day event on each of its days, first, and a home event with an hour's length", () => {
    const items = mergeCopies(
      [row({ id: "trip", all_day: true, starts_at: null, ends_at: null, start_day: "2026-11-02", end_day: "2026-11-04", title: "Trip" })],
      "me",
    );
    const day = agendaFor("2026-11-03", [homeEvent({ time: "07:30" })], items);
    expect(day.map((entry) => entry.title)).toEqual(["Trip", "Dinner"]);
    expect(day[0]).toMatchObject({ allDay: true, continues: true });
    expect(day[1]).toMatchObject({ kind: "home", start: 7 * 60 + 30, end: 8 * 60 + 30 });
    expect(agendaFor("2026-11-05", [], items)).toEqual([]);
  });

  it("knows what's over, what's on now and what's still ahead", () => {
    const [entry] = agendaFor("2026-11-03", [], mergeCopies([row({})], "me"));
    expect(stillOn(entry, 9 * 60 + 10)).toBe(true);
    expect(happeningNow(entry, 9 * 60 + 10)).toBe(true);
    expect(stillOn(entry, 9 * 60 + 30)).toBe(false);
    expect(happeningNow(entry, 8 * 60)).toBe(false);
  });
});

describe("foldBusy and pickForToday", () => {
  const busy = (id: string, owner: string, from: number, to: number) =>
    row({ id, owner_id: owner, detail: "busy", title: null, people: [owner], starts_at: at(3, from), ends_at: at(3, to) });

  it("folds one person's touching busy blocks into one stretch, never another person's", () => {
    const entries = agendaFor("2026-11-03", [], mergeCopies([busy("1", "p", 9, 10), busy("2", "p", 10, 12), busy("3", "q", 11, 12), busy("4", "p", 14, 15)], "me"));
    const folded = foldBusy(entries);
    expect(folded.map((entry) => [entry.people[0], entry.startLabel, entry.endLabel])).toEqual([
      ["p", "09:00", "12:00"],
      ["q", "11:00", "12:00"],
      ["p", "14:00", "15:00"],
    ]);
  });

  it("keeps the viewer's own things when the day is full of someone else's meetings", () => {
    const theirs = [8, 9, 10, 11, 12].map((hour) => row({ id: `t${hour}`, owner_id: "p", people: ["p"], starts_at: at(3, hour), ends_at: at(3, hour, 45) }));
    const entries = agendaFor("2026-11-03", [homeEvent({ time: "19:00" })], mergeCopies(theirs, "me"));
    const { shown, hidden } = pickForToday(entries, "me", 4);
    expect(shown.map((entry) => entry.title)).toContain("Dinner");
    expect(shown).toHaveLength(4);
    expect(hidden).toBe(2);
    expect(shown.map((entry) => entry.start)).toEqual([...shown.map((entry) => entry.start)].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });
});

describe("matchesFilter", () => {
  const members = ["me", "p"];
  const [mine, both] = agendaFor(
    "2026-11-03",
    [],
    mergeCopies([row({ id: "m" }), row({ id: "b", people: ["me", "p"], starts_at: at(3, 11), ends_at: at(3, 12) })], "me"),
  );
  const [house] = agendaFor("2026-11-03", [homeEvent({ attendeeId: null })], []);

  it("reads 'shared' as everyone taking part and 'everyone' as all the viewer may see", () => {
    expect(matchesFilter(mine, "shared", "me", members)).toBe(false);
    expect(matchesFilter(both, "shared", "me", members)).toBe(true);
    expect(matchesFilter(house, "shared", "me", members)).toBe(true);
    expect(matchesFilter(mine, { member: "p" }, "me", members)).toBe(false);
    expect(matchesFilter(both, { member: "p" }, "me", members)).toBe(true);
    expect([mine, both, house].every((entry) => matchesFilter(entry, "all", "me", members))).toBe(true);
    expect(matchesFilter(mine, "me", "me", members)).toBe(true);
  });
});

describe("summarizeToday", () => {
  it("says what's left, when the next thing is, and the shopping, in one short line", () => {
    const line = summarizeToday({ open: 2, done: 1, next: { start: "19:00", end: null, now: false }, shopping: 4, copy: he.today });
    expect(line.text).toBe("2 משימות להיום · האירוע הבא ב־19:00 · 4 פריטים לקנות");
    expect(line.marks).toEqual(["2 משימות", "19:00", "4 פריטים"]);
  });

  it("covers a finished day, a meeting on now, and leaves out what isn't there", () => {
    expect(summarizeToday({ open: 0, done: 3, next: null, shopping: 0, copy: he.today }).text).toBe("כל המשימות של היום בוצעו");
    expect(summarizeToday({ open: 0, done: 0, next: { start: "14:00", end: "15:00", now: true }, shopping: 1, copy: en.today }).text).toBe(
      "no tasks today · in an event until 15:00 · one item to buy",
    );
    expect(summarizeToday({ open: 1, done: 0, next: { start: "14:00", end: null, now: true }, shopping: 0, copy: en.today }).text).toBe(
      "one task today · the 14:00 event is on now",
    );
  });
});
