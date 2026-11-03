import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { daysOf, fromGoogle, fromGraph, takingPart, type RemoteEvent } from "./normalize";
import { planBatch } from "./plan";
import { grantedEnough, ProviderError, readChanges } from "./providers";
import { seal, unseal } from "./seal";

const timed = (change: ReturnType<typeof fromGoogle>) => change as RemoteEvent;

describe("Google events", () => {
  it("keeps the instant of a timed event and the dates of an all-day one", () => {
    const meeting = timed(
      fromGoogle({ id: "a", start: { dateTime: "2026-03-27T10:00:00+02:00" }, end: { dateTime: "2026-03-27T11:30:00+02:00" } }),
    );
    expect([meeting.startsAt, meeting.endsAt, meeting.allDay]).toEqual(["2026-03-27T08:00:00.000Z", "2026-03-27T09:30:00.000Z", false]);

    const holiday = timed(fromGoogle({ id: "b", start: { date: "2026-11-03" }, end: { date: "2026-11-04" } }));
    expect([holiday.allDay, holiday.startDay, holiday.endDay, holiday.startsAt]).toEqual([true, "2026-11-03", "2026-11-03", null]);
    const trip = timed(fromGoogle({ id: "c", start: { date: "2026-12-30" }, end: { date: "2027-01-02" } }));
    expect([trip.startDay, trip.endDay]).toEqual(["2026-12-30", "2027-01-01"]);
  });

  it("reads privacy, free time and the owner's own answer", () => {
    const event = timed(
      fromGoogle({
        id: "d",
        summary: "  Doctor  ",
        visibility: "private",
        transparency: "transparent",
        start: { dateTime: "2026-11-03T09:00:00Z" },
        end: { dateTime: "2026-11-03T10:00:00Z" },
        attendees: [
          { email: "Me@Example.com", self: true, responseStatus: "tentative" },
          { email: "room@resource.calendar.google.com", resource: true, responseStatus: "accepted" },
        ],
        iCalUID: "uid-1",
        recurringEventId: "series",
        htmlLink: "https://www.google.com/calendar/event?eid=x",
      }),
    );
    expect(event).toMatchObject({
      title: "Doctor",
      markedPrivate: true,
      busy: false,
      tentative: true,
      myResponse: "tentative",
      icalUid: "uid-1",
      seriesId: "series",
      attendees: [{ email: "me@example.com", response: "tentative" }],
    });
    expect(timed(fromGoogle({ id: "e", visibility: "confidential", organizer: { self: true }, start: { date: "2026-11-03" } }))).toMatchObject({
      markedPrivate: true,
      myResponse: "organizer",
    });
  });

  it("treats cancellations and working-location chips as gone", () => {
    expect(fromGoogle({ id: "x", status: "cancelled" })).toEqual({ remoteId: "x", removed: true });
    expect(fromGoogle({ id: "y", eventType: "workingLocation", start: { date: "2026-11-03" } })).toEqual({ remoteId: "y", removed: true });
  });
});

describe("Outlook events", () => {
  it("reads UTC times and finds the day of an all-day event however midnight was shifted", () => {
    const meeting = timed(
      fromGraph({ id: "m", start: { dateTime: "2026-11-03T08:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-11-03T09:00:00.0000000", timeZone: "UTC" } }),
    );
    expect([meeting.startsAt, meeting.endsAt]).toEqual(["2026-11-03T08:00:00.000Z", "2026-11-03T09:00:00.000Z"]);

    const israel = timed(
      fromGraph({ id: "h", isAllDay: true, start: { dateTime: "2026-11-02T22:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-11-03T22:00:00.0000000", timeZone: "UTC" } }),
    );
    expect([israel.startDay, israel.endDay]).toEqual(["2026-11-03", "2026-11-03"]);
    const newYork = timed(
      fromGraph({ id: "n", isAllDay: true, start: { dateTime: "2026-11-03T05:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-11-05T05:00:00.0000000", timeZone: "UTC" } }),
    );
    expect([newYork.startDay, newYork.endDay]).toEqual(["2026-11-03", "2026-11-04"]);
    const floating = timed(
      fromGraph({ id: "f", isAllDay: true, start: { dateTime: "2026-11-03T00:00:00.0000000", timeZone: "UTC" }, end: { dateTime: "2026-11-04T00:00:00.0000000", timeZone: "UTC" } }),
    );
    expect([floating.startDay, floating.endDay]).toEqual(["2026-11-03", "2026-11-03"]);
  });

  it("reads sensitivity, show-as and the owner's answer; removals and series masters", () => {
    const event = timed(
      fromGraph({
        id: "p",
        subject: "Review",
        sensitivity: "personal",
        showAs: "free",
        responseStatus: { response: "tentativelyAccepted" },
        start: { dateTime: "2026-11-03T08:00:00", timeZone: "UTC" },
        end: { dateTime: "2026-11-03T09:00:00", timeZone: "UTC" },
        attendees: [{ type: "required", emailAddress: { address: "Partner@Work.example" }, status: { response: "accepted" } }],
        seriesMasterId: "master",
        iCalUId: "occurrence-uid",
        webLink: "https://outlook.office365.com/owa/?itemid=p",
      }),
    );
    expect(event).toMatchObject({ markedPrivate: true, busy: false, tentative: true, seriesId: "master", attendees: [{ email: "partner@work.example", response: "accepted" }] });
    expect(fromGraph({ id: "gone", "@removed": { reason: "deleted" } })).toEqual({ remoteId: "gone", removed: true });
    expect(fromGraph({ id: "c", isCancelled: true, start: { dateTime: "2026-11-03T08:00:00" } })).toEqual({ remoteId: "c", removed: true });
    expect(fromGraph({ id: "s", type: "seriesMaster", start: { dateTime: "2026-11-03T08:00:00" } })).toBeNull();
  });
});

describe("days in the house's time zone", () => {
  it("doesn't spill into tomorrow when a meeting ends at midnight", () => {
    expect(daysOf("2026-11-03T18:00:00Z", "2026-11-03T22:00:00Z", "Asia/Jerusalem")).toEqual({ startDay: "2026-11-03", endDay: "2026-11-03" });
    expect(daysOf("2026-11-03T21:30:00Z", "2026-11-03T23:00:00Z", "Asia/Jerusalem")).toEqual({ startDay: "2026-11-03", endDay: "2026-11-04" });
  });

  it("follows daylight saving in Israel and New York", () => {
    // Israel moves to summer time on 27 March 2026 and back on 25 October 2026.
    expect(daysOf("2026-03-26T23:30:00Z", "2026-03-27T00:30:00Z", "Asia/Jerusalem").startDay).toBe("2026-03-27");
    expect(daysOf("2026-03-27T21:30:00Z", "2026-03-27T22:00:00Z", "Asia/Jerusalem").startDay).toBe("2026-03-28");
    expect(daysOf("2026-10-24T21:30:00Z", "2026-10-24T22:00:00Z", "Asia/Jerusalem").startDay).toBe("2026-10-25");
    const overnight = fromGoogle({ id: "ny", start: { dateTime: "2026-03-08T01:30:00-05:00" }, end: { dateTime: "2026-03-08T03:30:00-04:00" } }) as RemoteEvent;
    expect(Date.parse(overnight.endsAt!) - Date.parse(overnight.startsAt!)).toBe(60 * 60_000);
    expect(daysOf(overnight.startsAt!, overnight.endsAt!, "America/New_York")).toEqual({ startDay: "2026-03-08", endDay: "2026-03-08" });
  });
});

describe("who takes part", () => {
  const addresses = new Map([
    ["owner", new Set(["owner@example.com"])],
    ["partner", new Set(["partner@example.com", "partner@work.example"])],
  ]);
  const event = (attendees: RemoteEvent["attendees"], myResponse: RemoteEvent["myResponse"] = "accepted") => ({ attendees, myResponse });

  it("adds the other parent only for an invite to an address they proved, not a similar one", () => {
    expect(takingPart(event([{ email: "partner@work.example", response: "none" }]), "owner", addresses)).toEqual({ people: ["owner", "partner"], declined: [] });
    expect(takingPart(event([{ email: "partner@example.co", response: "accepted" }]), "owner", addresses)).toEqual({ people: ["owner"], declined: [] });
    expect(takingPart(event([{ email: "partner@example.com", response: "declined" }]), "owner", addresses)).toEqual({ people: ["owner"], declined: ["partner"] });
  });

  it("drops an event the calendar's owner declined", () => {
    expect(takingPart(event([], "declined"), "owner", addresses)).toBeNull();
  });
});

describe("planning a batch", () => {
  const base = { ownerId: "owner", addresses: new Map([["owner", new Set<string>()]]), timeZone: "Asia/Jerusalem", fromDay: "2026-11-01", toDay: "2026-12-31" };
  const meeting = (id: string, start = "2026-11-03T08:00:00Z") =>
    fromGoogle({ id, summary: id, start: { dateTime: start }, end: { dateTime: start.replace("08:", "09:") } })!;

  it("lets the latest word on an event win and removes what fell out of the window", () => {
    const plan = planBatch(
      [meeting("a"), { remoteId: "a", removed: true }, { remoteId: "b", removed: true }, meeting("b"), meeting("old", "2026-10-01T08:00:00Z")],
      base,
    );
    expect(plan.write.map((event) => event.remoteId)).toEqual(["b"]);
    expect(plan.remove.sort()).toEqual(["a", "old"]);
    expect(plan.write[0]).toMatchObject({ startDay: "2026-11-03", endDay: "2026-11-03", people: ["owner"] });
  });
});

describe("reading changes", () => {
  afterEach(() => vi.unstubAllGlobals());
  const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

  it("returns nothing at all when a later page can't be read", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(200, { items: [{ id: "a", status: "cancelled" }], nextPageToken: "p2" }))
      .mockResolvedValue(reply(500, {}));
    vi.stubGlobal("fetch", fetch);
    await expect(readChanges("google", "token", "primary", { cursor: "s1" })).rejects.toMatchObject({ failure: "unavailable" });
  });

  it("reads every Google page and keeps the new sync token", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(200, { items: [{ id: "a", status: "cancelled" }], nextPageToken: "p2" }))
        .mockResolvedValueOnce(reply(200, { items: [{ id: "b", start: { date: "2026-11-03" }, end: { date: "2026-11-04" } }], nextSyncToken: "s2" })),
    );
    const batch = await readChanges("google", "token", "primary", { cursor: "s1" });
    expect([batch.cursor, batch.full, batch.changes.map((change) => change.remoteId)]).toEqual(["s2", false, ["a", "b"]]);
  });

  it("asks for a full read when the sync token expired, and backs off when rate limited", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(410, { error: { code: 410 } })));
    await expect(readChanges("google", "token", "primary", { cursor: "old" })).rejects.toMatchObject({ failure: "gone" });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(reply(429, {}, { "retry-after": "0" }))
        .mockResolvedValueOnce(reply(200, { value: [], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/me/calendars/x/calendarView/delta?$deltatoken=t" })),
    );
    const batch = await readChanges("microsoft", "token", "x", { window: { start: new Date("2026-11-01"), end: new Date("2026-12-01") } });
    expect(batch.cursor).toContain("$deltatoken=t");
    expect(batch.full).toBe(true);
  });

  it("refuses paging links that leave Microsoft Graph", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { value: [], "@odata.nextLink": "https://evil.example/steal" })));
    await expect(readChanges("microsoft", "token", "x", { cursor: "https://graph.microsoft.com/v1.0/me/calendarView/delta?$deltatoken=1" })).rejects.toBeInstanceOf(
      ProviderError,
    );
    await expect(readChanges("microsoft", "token", "x", { cursor: "https://evil.example/" })).rejects.toMatchObject({ failure: "bad" });
  });
});

describe("tokens at rest", () => {
  beforeAll(() => {
    process.env.CALENDAR_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("opens only with the same key and the same account", () => {
    const sealed = seal('{"refresh":"r"}', "account-1");
    expect(sealed).not.toContain("refresh");
    expect(unseal(sealed, "account-1")).toBe('{"refresh":"r"}');
    expect(unseal(sealed, "account-2")).toBeNull();
    expect(unseal(sealed.slice(0, -2) + "AA", "account-1")).toBeNull();
  });

  it("notices a consent screen where a calendar box was unticked", () => {
    expect(grantedEnough("google", "openid https://www.googleapis.com/auth/calendar.events.readonly")).toBe(false);
    expect(
      grantedEnough("google", "https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events.readonly email"),
    ).toBe(true);
    expect(grantedEnough("microsoft", "https://graph.microsoft.com/Calendars.Read https://graph.microsoft.com/User.Read")).toBe(true);
    expect(grantedEnough("microsoft", "https://graph.microsoft.com/User.Read")).toBe(false);
  });
});
