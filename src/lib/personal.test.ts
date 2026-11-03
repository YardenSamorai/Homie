import { describe, expect, it } from "vitest";
import type { AgendaEntry, CalendarItem } from "./agenda";
import { railColor, startingColor } from "./calendar-colors";
import { contrast, normalizeHex, readableOn } from "./color";
import { defaultHomeLayout, homeRegions, isDefaultLayout, moveRegion, readHomeLayout } from "./home-layout";
import { accentPresets, accentSet, defaultLook, isCustomized, lookFromDevice, lookThemes, lookTokens, palettes, readLook, withTheme, type Look } from "./look";
import { applyChanges, changesBetween, defaultPrefs, readPrefs, validChange } from "./prefs";
import { inQuiet, instantOf, localTime, morningDue, quietJustEnded } from "./routine";
import { offerOf, withOffer } from "./supabase/look-shares";

const A = "00000000-0000-4000-8000-00000000000a";
const PHOTO = `backgrounds/${A}/11111111-1111-4111-8111-111111111111.webp`;

describe("color", () => {
  it("measures contrast the WCAG way and reads only real hex colors", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBeCloseTo(1, 5);
    expect(normalizeHex("3a7d5c")).toBe("#3a7d5c");
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    for (const bad of ["", "#12", "red", "#12345g", "url(x)", "#1234567"]) expect(normalizeHex(bad)).toBeNull();
  });

  it("moves any color just far enough to be readable on every background given", () => {
    for (const hex of ["#ffff00", "#ffffff", "#000000", "#00ff88", "#3a7d5c", "#ff0000", "#1f2d28"]) {
      for (const backgrounds of [["#f8f7f2", "#ffffff"], ["#121614", "#1c2420"]]) {
        const out = readableOn(hex, backgrounds);
        for (const bg of backgrounds) expect(contrast(out, bg)).toBeGreaterThanOrEqual(4.5);
      }
    }
    expect(readableOn("#1f2d28", ["#ffffff"])).toBe("#1f2d28");
  });
});

describe("looks", () => {
  it("keeps every accent readable on its theme in light and dark, with readable text on the accent", () => {
    const accents: Look["accent"][] = [{ kind: "theme" }, ...accentPresets.map((id) => ({ kind: "preset", id }) as const), { kind: "custom", hex: "#ffee00" }, { kind: "custom", hex: "#101010" }, { kind: "custom", hex: "#7a3cff" }];
    for (const theme of lookThemes) {
      for (const accent of accents) {
        const set = accentSet({ theme, accent });
        const { light, dark } = palettes[theme];
        expect(contrast(set.accent[0], light.surface), `${theme} ${JSON.stringify(accent)} light`).toBeGreaterThanOrEqual(accent.kind === "custom" ? 4.5 : 3);
        expect(contrast(set.accent[1], dark.surface), `${theme} ${JSON.stringify(accent)} dark`).toBeGreaterThanOrEqual(accent.kind === "custom" ? 4.5 : 3);
        if (accent.kind === "custom") {
          expect(contrast(set.ink[0], set.accent[0])).toBeGreaterThanOrEqual(4.5);
          expect(contrast(set.ink[1], set.accent[1])).toBeGreaterThanOrEqual(4.5);
        }
      }
    }
    expect(accentSet({ theme: "nature", accent: { kind: "custom", hex: "#ffee00" } }).adjusted).toBe(true);
  });

  it("reads anything stored as a drawable look, dropping unknown fields and foreign photos", () => {
    expect(readLook(null)).toEqual(defaultLook);
    const read = readLook({ theme: "warm", mode: "dark", text: "9", motion: "fast", css: "body{}", accent: { kind: "custom", hex: "javascript:" }, background: { kind: "photo", photo: { path: "../../etc" } } });
    expect(read).toMatchObject({ theme: "warm", mode: "dark", text: defaultLook.text, motion: "full", accent: { kind: "theme" } });
    expect(read.background).toMatchObject({ kind: "gradient", photo: null });
    expect("css" in read).toBe(false);
    const own = readLook({ background: { kind: "photo", photo: { path: PHOTO, x: 140, zoom: 9, veil: 3 } } });
    expect(own.background).toMatchObject({ kind: "photo", photo: { path: PHOTO, x: 100, zoom: 2.5, veil: 45 } });
  });

  it("changes only what a theme owns, and says when it was adjusted afterwards", () => {
    const mine: Look = { ...defaultLook, text: "4", bold: true, motion: "none", density: "compact", font: "rubik", mode: "dark" };
    const warm = withTheme(mine, "warm");
    expect(warm).toMatchObject({ theme: "warm", text: "4", bold: true, motion: "none", density: "compact", font: "rubik", mode: "dark", cards: "solid" });
    expect(isCustomized(warm)).toBe(false);
    expect(isCustomized({ ...warm, cards: "glass" })).toBe(true);
    expect(isCustomized({ ...warm, accent: { kind: "preset", id: "plum" } })).toBe(true);
  });

  it("carries a device's old choices into the first saved look", () => {
    expect(lookFromDevice({ theme: "dark", text: "3", tint: "coral", bold: "1" })).toMatchObject({ mode: "dark", text: "3", bold: true, accent: { kind: "preset", id: "coral" } });
    expect(lookFromDevice({ theme: null, text: null, tint: "sage", bold: null })).toMatchObject({ mode: "light", text: "2", bold: false, accent: { kind: "theme" } });
  });

  it("turns a look into attributes and variables only, nothing free-form", () => {
    const tokens = lookTokens({ ...defaultLook, background: { ...defaultLook.background, kind: "photo", photo: { path: PHOTO, x: 20, y: 80, zoom: 1.5, blur: 4, veil: 60 } } });
    expect(tokens.attrs).toMatchObject({ theme: "light", look: "nature", bg: "photo", bold: "0", art: "1" });
    expect(tokens.vars["--bg-x"]).toBe("20%");
    for (const value of Object.values(tokens.vars)) expect(value).not.toMatch(/[;{}]|url\(/);
  });
});

describe("sharing a look", () => {
  it("offers only the theme, accent, cards, a built-in background and maybe density", () => {
    const photoLook = readLook({ theme: "warm", cards: "glass", density: "compact", text: "5", background: { kind: "photo", photo: { path: PHOTO } } });
    expect(offerOf(photoLook, false)).toEqual({ theme: "warm", accent: { kind: "theme" }, cards: "glass", background: null });
    expect(offerOf(photoLook, true).density).toBe("compact");
  });

  it("lays an offer over the receiver's own look, keeping their type, motion and photo out of it", () => {
    const mine: Look = { ...defaultLook, text: "5", bold: true, motion: "none", font: "frank", mode: "dark", background: { ...defaultLook.background, scope: "main" } };
    const offered = withOffer(mine, { theme: "clean", accent: { kind: "preset", id: "teal" }, cards: "outline", background: { kind: "gradient", gradient: "sea" } });
    expect(offered).toMatchObject({ theme: "clean", accent: { kind: "preset", id: "teal" }, cards: "outline", text: "5", bold: true, motion: "none", font: "frank", mode: "dark", density: "regular" });
    expect(offered.background).toEqual({ kind: "gradient", gradient: "sea", scope: "main", photo: null });
    expect(withOffer(mine, { theme: "warm", accent: { kind: "theme" }, cards: "solid", background: null }).background.kind).toBe("gradient");
  });
});

describe("prefs", () => {
  it("carries the first version's morning hour over and fills everything else in", () => {
    const old = readPrefs({ notify: { shopping: false }, morning: { on: true, hour: 7 } });
    expect(old.morning).toEqual({ on: true, time: "07:00", days: [0, 1, 2, 3, 4, 5, 6] });
    expect(old.notify.shopping).toBe(false);
    expect(old.notify.tasks).toBe(true);
    expect(old.look).toEqual(defaultLook);
    expect(readPrefs({ timezone: "Mars/Olympus", quiet: { start: "25:00", days: [1, 1, 9] } })).toMatchObject({ timezone: null, quiet: { start: "22:00", days: [1] } });
  });

  it("accepts only known sections at their own depth, with plain keys", () => {
    expect(validChange({ path: ["look", "accent"], value: {} })).toBe(true);
    expect(validChange({ path: ["calendarColors", "people", A], value: "#112233" })).toBe(true);
    expect(validChange({ path: ["look", "accent", "hex"], value: "#112233" })).toBe(false);
    expect(validChange({ path: ["__proto__", "x"], value: 1 })).toBe(false);
    expect(validChange({ path: ["look", "constructor.prototype"], value: 1 })).toBe(false);
    expect(validChange({ path: ["admin"], value: true })).toBe(false);
    expect(validChange({ path: [], value: 1 })).toBe(false);
  });

  it("merges two devices' saves field by field instead of one overwriting the other", () => {
    const start = defaultPrefs;
    const phone = { ...start, look: { ...start.look, theme: "warm" as const } };
    const laptop = { ...start, quiet: { ...start.quiet, on: true }, look: { ...start.look, text: "4" as const } };
    const afterPhone = applyChanges(start, changesBetween(start, phone));
    const afterBoth = applyChanges(afterPhone, changesBetween(start, laptop));
    expect(afterBoth.look.theme).toBe("warm");
    expect(afterBoth.look.text).toBe("4");
    expect(afterBoth.quiet.on).toBe(true);
  });

  it("round-trips any change and removes a calendar color set back to normal", () => {
    const colored = applyChanges(defaultPrefs, [{ path: ["calendarColors", "people", A], value: "#aa3355" }]);
    expect(colored.calendarColors.people[A]).toBe("#aa3355");
    expect(applyChanges(colored, changesBetween(colored, defaultPrefs))).toEqual(defaultPrefs);
    expect(applyChanges(colored, [{ path: ["calendarColors", "people", "not-a-person"], value: "#aa3355" }]).calendarColors.people).toEqual({ [A]: "#aa3355" });
  });
});

describe("routine", () => {
  const zone = "Asia/Jerusalem";
  const quiet = { on: true, start: "22:00", end: "07:00", days: [5] };

  it("keeps a window that crosses midnight with the evening it starts on", () => {
    const at = (iso: string) => localTime(new Date(iso), zone);
    expect(inQuiet(quiet, at("2026-11-06T21:00:00Z"))).toBe(true);
    expect(inQuiet(quiet, at("2026-11-07T04:30:00Z"))).toBe(true);
    expect(inQuiet(quiet, at("2026-11-07T05:00:00Z"))).toBe(false);
    expect(inQuiet(quiet, at("2026-11-05T21:00:00Z"))).toBe(false);
    expect(inQuiet({ ...quiet, start: "07:00", end: "07:00" }, at("2026-11-06T21:00:00Z"))).toBe(false);
  });

  it("finds the quiet window that just ended, once", () => {
    const ended = quietJustEnded(quiet, new Date("2026-11-07T05:20:00Z"), zone);
    expect(ended?.from.toISOString()).toBe("2026-11-06T20:00:00.000Z");
    expect(ended?.to.toISOString()).toBe("2026-11-07T05:00:00.000Z");
    expect(quietJustEnded(quiet, new Date("2026-11-07T04:50:00Z"), zone)).toBeNull();
    expect(quietJustEnded(quiet, new Date("2026-11-07T09:00:00Z"), zone)).toBeNull();
  });

  it("places a time skipped by the clock just after the jump", () => {
    expect(instantOf("2026-11-03", 8 * 60, zone).toISOString()).toBe("2026-11-03T06:00:00.000Z");
    const skipped = instantOf("2026-03-08", 2 * 60 + 30, "America/New_York");
    expect(localTime(skipped, "America/New_York")).toMatchObject({ day: "2026-03-08", minutes: 3 * 60 + 30 });
  });

  it("sends the morning summary once a local day, on chosen days, even across a clock change", () => {
    const runs = (from: string, hours: number, morning: { on: boolean; time: string; days: number[] }, tz: string) => {
      let sentOn: string | null = null;
      let sent = 0;
      for (let t = new Date(from).getTime(); t < new Date(from).getTime() + hours * 3_600_000; t += 15 * 60_000) {
        const local = localTime(new Date(t), tz);
        if (morningDue(morning, local, sentOn)) {
          sent += 1;
          sentOn = local.day;
        }
      }
      return sent;
    };
    expect(runs("2026-11-01T03:00:00Z", 6, { on: true, time: "01:30", days: [0] }, "America/New_York")).toBe(1);
    expect(runs("2026-10-24T20:00:00Z", 48, { on: true, time: "08:00", days: [0, 1, 2, 3, 4, 5, 6] }, zone)).toBe(2);
    expect(runs("2026-11-02T00:00:00Z", 24 * 7, { on: true, time: "08:00", days: [1, 3] }, zone)).toBe(2);
    expect(runs("2026-11-02T00:00:00Z", 24, { on: false, time: "08:00", days: [1] }, zone)).toBe(0);
  });
});

describe("home layout", () => {
  it("keeps a stored order, drops what it doesn't know, and slots new regions in at their default place", () => {
    const read = readHomeLayout({ order: ["tasks", "tasks", "note", "weather"], hidden: ["members", "x"], compact: ["tasks", "agenda"] });
    expect(read.order).toEqual(["tasks", "shopping", "tomorrow", "activity", "note", "members", "agenda"]);
    expect(read.order).toHaveLength(homeRegions.length);
    expect(read.hidden).toEqual(["members"]);
    expect(read.compact).toEqual(["agenda"]);
    expect(readHomeLayout(null)).toEqual(defaultHomeLayout);
  });

  it("moves one step at a time and knows when it's back to the default", () => {
    const moved = moveRegion(defaultHomeLayout, "agenda", -1);
    expect(moved.order.slice(0, 3)).toEqual(["note", "agenda", "members"]);
    expect(moveRegion(defaultHomeLayout, "note", -1)).toBe(defaultHomeLayout);
    expect(isDefaultLayout(moved)).toBe(false);
    expect(isDefaultLayout(moveRegion(moved, "agenda", 1))).toBe(true);
  });
});

describe("calendar colors", () => {
  const item = { calendarKey: "0123456789abcdef0123456789abcdef" } as CalendarItem;
  const entry = (kind: "home" | "calendar", busy = false) => ({ kind, busy, item: kind === "calendar" ? item : undefined }) as AgendaEntry;

  it("colors by person or by calendar, and a busy block stays neutral", () => {
    const byPerson = { by: "person" as const, people: {}, calendars: {} };
    expect(railColor(entry("calendar"), byPerson, "#123456")).toBe("#123456");
    expect(railColor(entry("calendar", true), byPerson, "#123456")).toBe("var(--separator)");
    const byCalendar = { by: "calendar" as const, people: {}, calendars: { home: "#aa0000" } };
    expect(railColor(entry("home"), byCalendar, null)).toBe("#aa0000");
    expect(railColor(entry("calendar"), byCalendar, "#123456")).toBe(startingColor(item.calendarKey!));
    expect(railColor(entry("calendar"), { ...byCalendar, calendars: { [item.calendarKey!]: "#00aa00" } }, null)).toBe("#00aa00");
  });
});
