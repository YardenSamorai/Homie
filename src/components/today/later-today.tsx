"use client";

import { Clock } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { HouseEvent } from "@/lib/household";
import { useAddSheet } from "@/lib/household-store";
import type { Task } from "@/lib/tasks";

const card = "w-[216px] shrink-0 snap-start rounded-[22px] bg-surface p-4 shadow-card ring-1 ring-hairline";

/**
 * What's still coming on the chosen day — the next events, and one of yours.
 * A short horizontal strip, not a second list of the same tasks.
 */
export function LaterToday({
  isToday,
  events,
  yours,
}: {
  isToday: boolean;
  events: HouseEvent[];
  yours: Task | null;
}) {
  const { dict } = useI18n();
  const showEdit = useAddSheet((s) => s.showEdit);
  if (events.length === 0 && !yours) return null;

  return (
    <section aria-labelledby="later-today">
      <h2 id="later-today" className="px-1 text-[20px] font-bold tracking-[-0.01em]">
        {isToday ? dict.today.laterToday : dict.today.laterThatDay}
      </h2>
      <div className="-me-4 mt-2 flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 pe-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {events.map((event) => {
          const time = event.time?.slice(0, 5);
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => showEdit({ kind: "event", id: event.id })}
              className={`${card} text-start transition-transform duration-150 ease-out active:scale-[0.98]`}
            >
              <span className="inline-flex rounded-full bg-[color-mix(in_oklab,var(--pink)_14%,transparent)] px-2.5 py-0.5 text-[13px] font-semibold tabular-nums text-pink">
                {time ?? dict.events.allDay}
              </span>
              <p dir="auto" className="align-ui mt-2.5 line-clamp-2 text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">
                {event.title}
              </p>
              <p className="mt-0.5 truncate text-[14px] text-label-secondary">{event.prep || "\u00a0"}</p>
            </button>
          );
        })}
        {yours && (
          <button
            type="button"
            onClick={() => showEdit({ kind: "task", id: yours.id })}
            className={`${card} text-start transition-transform duration-150 ease-out active:scale-[0.98]`}
          >
            <span className="inline-flex rounded-full bg-fill px-2.5 py-0.5 text-[13px] font-semibold text-accent">{dict.today.yours}</span>
            <p dir="auto" className="align-ui mt-2.5 line-clamp-2 text-[17px] font-semibold leading-snug [overflow-wrap:anywhere]">
              {yours.title}
            </p>
            <p className="mt-0.5 truncate text-[14px] text-label-secondary">{dict.today.taskToday}</p>
          </button>
        )}
      </div>
    </section>
  );
}

export function WaitingRow({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const { dict } = useI18n();
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className="flex w-full items-center gap-3 rounded-[22px] bg-surface p-4 text-start shadow-card ring-1 ring-hairline transition-transform duration-150 ease-out active:scale-[0.99]"
    >
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-full bg-orange text-white">
        <Clock size={16} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-medium">
        {count === 1 ? dict.today.waitingEarlierOne : format(dict.today.waitingEarlier, { count })}
      </span>
    </button>
  );
}
