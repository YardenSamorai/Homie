import type { DayKey } from "@/lib/dates";
import { daysOf, inWindow, isRemoved, takingPart, type Change, type RemoteEvent } from "./normalize";

export type PlannedEvent = RemoteEvent & { startDay: DayKey; endDay: DayKey; people: string[]; declined: string[] };

/**
 * What a batch of provider changes does to the stored copy: events to write and ids to remove. The latest change
 * to an event wins. Outside the window, cancelled, or declined by the calendar's owner all mean "not on it".
 */
export function planBatch(
  changes: Change[],
  options: {
    ownerId: string;
    addresses: ReadonlyMap<string, ReadonlySet<string>>;
    timeZone: string;
    fromDay: DayKey;
    toDay: DayKey;
  },
): { write: PlannedEvent[]; remove: string[] } {
  const outcome = new Map<string, PlannedEvent | null>();
  for (const change of changes) {
    // Re-inserting moves the id to the end, so the map's order follows the provider's latest word.
    outcome.delete(change.remoteId);
    if (isRemoved(change)) {
      outcome.set(change.remoteId, null);
      continue;
    }
    const days = change.allDay
      ? { startDay: change.startDay!, endDay: change.endDay! }
      : daysOf(change.startsAt!, change.endsAt!, options.timeZone);
    const part = inWindow(days, options.fromDay, options.toDay) ? takingPart(change, options.ownerId, options.addresses) : null;
    outcome.set(change.remoteId, part ? { ...change, ...days, ...part } : null);
  }
  const write: PlannedEvent[] = [];
  const remove: string[] = [];
  for (const [id, planned] of outcome) {
    if (planned) write.push(planned);
    else remove.push(id);
  }
  return { write, remove };
}
