import type { CalendarRow } from "@/lib/agenda";
import { addDays, type DayKey } from "@/lib/dates";

/**
 * Development only, in the demo build with no database: rows shaped like house_calendar() returns them to the viewer,
 * already cut down (the partner's availability-only calendar arrives as bare busy blocks; their private calendar not
 * at all). Lets Today and the calendar be looked at with a full day. Never used when Supabase is configured.
 */
export function demoCalendarRows(today: DayKey, selfId: string, partnerId: string | null): CalendarRow[] {
  const [y, m, d] = today.split("-").map(Number);
  const at = (offset: number, hour: number, minute = 0) => new Date(y, m - 1, d + offset, hour, minute).toISOString();
  const base = {
    tentative: false,
    fixed: false,
    prep: null,
    link: null,
    match_key: null,
    all_day: false,
  };
  const day = (offset: number) => addDays(today, offset);
  const rows: CalendarRow[] = [
    {
      ...base,
      id: "demo-1",
      owner_id: selfId,
      detail: "details",
      provider: "google",
      source_name: "Work",
      calendar_key: "0a1b2c3d4e5f60718293a4b5c6d7e8f9",
      title: "סקירת רבעון עם צוות המוצר — Quarterly product review",
      starts_at: at(0, 16),
      ends_at: at(0, 17, 30),
      start_day: day(0),
      end_day: day(0),
      people: [selfId],
      link: "https://calendar.google.com/calendar/event?eid=demo",
    },
    {
      ...base,
      id: "demo-2",
      owner_id: selfId,
      detail: "details",
      provider: "google",
      source_name: "משפחה",
      calendar_key: "1f2e3d4c5b6a79881726354453627180",
      title: "ארוחה משפחתית אצל סבתא",
      starts_at: at(1, 18),
      ends_at: at(1, 21),
      start_day: day(1),
      end_day: day(1),
      people: partnerId ? [selfId, partnerId] : [selfId],
      prep: "להביא עוגה ופרחים",
      fixed: true,
      match_key: "demo-family",
    },
  ];
  if (partnerId) {
    rows.push(
      { ...base, id: "demo-3", owner_id: partnerId, detail: "busy", provider: null, source_name: null, title: null, starts_at: at(0, 13), ends_at: at(0, 14), start_day: day(0), end_day: day(0), people: [partnerId] },
      { ...base, id: "demo-4", owner_id: partnerId, detail: "busy", provider: null, source_name: null, title: null, starts_at: at(0, 14), ends_at: at(0, 15, 30), start_day: day(0), end_day: day(0), people: [partnerId] },
      {
        ...base,
        id: "demo-5",
        owner_id: partnerId,
        detail: "details",
        provider: "microsoft",
        source_name: "Calendar",
        calendar_key: "9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b",
        title: "Parent–teacher meeting · אסיפת הורים",
        starts_at: at(0, 20),
        ends_at: at(0, 21),
        start_day: day(0),
        end_day: day(0),
        people: [selfId, partnerId],
        tentative: true,
        link: "https://outlook.office365.com/owa/?itemid=demo",
      },
    );
  }
  return rows;
}
