import { format } from "@/i18n/format";
import type { Dictionary } from "@/i18n/get-dictionary";
import { sortEvents, type HouseEvent } from "@/lib/household";
import type { DayKey } from "@/lib/dates";

type Copy = Dictionary["today"];

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** The next event that still belongs to this hour of the day. All-day stays up all day. */
export function nextOpenEvent(events: HouseEvent[], day: DayKey, hour: number | null, isToday: boolean) {
  const ofDay = events.filter((event) => event.date === day).sort(sortEvents);
  if (!isToday || hour == null) return ofDay[0] ?? null;
  return ofDay.find((event) => !event.time || Number(event.time.slice(0, 2)) >= hour) ?? null;
}

export function laterEvents(events: HouseEvent[], day: DayKey, hour: number | null, isToday: boolean) {
  const ofDay = events.filter((event) => event.date === day).sort(sortEvents);
  if (!isToday || hour == null) return ofDay;
  return ofDay.filter((event) => !event.time || Number(event.time.slice(0, 2)) >= hour);
}

/**
 * Today's line under the greeting, short enough never to cut a title: what's left to do, when the next thing is,
 * and the shopping waiting, each only when there is one. "2 tasks today · Next event at 19:00".
 * `next` is the viewer's next home event or meeting that hasn't ended (an imported one carries its own end).
 */
export function summarizeToday({
  open,
  done,
  next,
  shopping,
  copy,
}: {
  open: number;
  done: number;
  next: { start: string | null; end: string | null; now: boolean } | null;
  shopping: number;
  copy: Copy;
}): { text: string; marks: string[] } {
  const parts: string[] = [];
  const marks: string[] = [];
  if (open > 0) {
    parts.push(open === 1 ? copy.sumTasksOne : format(copy.sumTasks, { count: open }));
    marks.push(open === 1 ? copy.storyMarkOne : format(copy.storyMark, { count: open }));
  } else {
    parts.push(done > 0 ? copy.sumTasksDone : copy.sumTasksNone);
  }
  if (next?.now && next.end) {
    parts.push(format(copy.sumNowUntil, { time: next.end }));
    marks.push(next.end);
  } else if (next?.now && next.start) {
    parts.push(format(copy.sumNowStarted, { time: next.start }));
    marks.push(next.start);
  } else if (next?.start) {
    parts.push(format(copy.sumNext, { time: next.start }));
    marks.push(next.start);
  }
  if (shopping > 0) {
    parts.push(shopping === 1 ? copy.sumShopOne : format(copy.sumShop, { count: shopping }));
    marks.push(shopping === 1 ? copy.sumShopMarkOne : format(copy.sumShopMark, { count: shopping }));
  }
  return { text: parts.join(" · "), marks };
}

/**
 * One spoken sentence for the day: what's left, and the next thing on the calendar.
 * The greeting already said hello — this is what the house is actually doing.
 */
export function tellDay({
  open,
  done,
  isToday,
  event,
  copy,
}: {
  open: number;
  done: number;
  isToday: boolean;
  event: { title: string; time: string | null; who: string | null } | null;
  copy: Copy;
}): { text: string; marks: string[] } {
  const many = (one: string, other: string, count: number) => (count === 1 ? one : format(other, { count }));
  const marks: string[] = [];
  if (open > 0) marks.push(open === 1 ? copy.storyMarkOne : format(copy.storyMark, { count: open }));
  const base =
    open > 0
      ? isToday
        ? many(copy.storyLeftOne, copy.storyLeft, open)
        : many(copy.storyLeftOneOther, copy.storyLeftOther, open)
      : done > 0
        ? isToday
          ? copy.storyDone
          : copy.storyDoneOther
        : isToday
          ? copy.storyClear
          : copy.storyClearOther;

  const time = event?.time ? event.time.slice(0, 5) : null;
  if (time) marks.push(time);
  if (!event) return { text: `${base}.`, marks };

  const who = event.who;
  const values = { time: time ?? "", who: who ?? "", title: event.title };

  if (open === 0 && done === 0) {
    const solo = time
      ? who
        ? format(copy.storyOnlyTimedWho, values)
        : format(copy.storyOnlyTimed, values)
      : who
        ? format(copy.storyOnlyAllWho, values)
        : event.title;
    return { text: `${solo}.`, marks };
  }

  const clause = time
    ? who
      ? format(copy.storyEventTimedWho, values)
      : format(copy.storyEventTimed, values)
    : who
      ? format(copy.storyEventAllWho, values)
      : format(copy.storyEventAll, values);
  return { text: `${base}, ${clause}.`, marks };
}
