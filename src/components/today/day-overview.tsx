"use client";

import Link from "next/link";
import { Check, ChevronRight, Coffee, ListChecks, ShoppingBasket } from "lucide-react";
import { EventRow } from "@/components/events/event-row";
import { IconTile } from "@/components/ui/icon-tile";
import { ProgressRing } from "@/components/ui/progress-ring";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import type { HouseEvent } from "@/lib/household";
import { useAddSheet } from "@/lib/household-store";

export type DayCounts = {
  /** Still open on the day, including what's left over from earlier days. */
  open: number;
  done: number;
  /** Open from before the day (only counted for today). */
  fromBefore: number;
};

const rowRule =
  "relative after:absolute after:inset-x-0 after:top-0 after:ms-4 after:h-px after:bg-separator";

/** The day in one card: how far along it is, what's on the calendar, and what's left to buy. */
export function DayOverview({
  heading,
  isToday,
  counts,
  events,
  toBuy,
}: {
  heading: string;
  isToday: boolean;
  counts: DayCounts;
  events: HouseEvent[];
  /** Only on today: the shopping list isn't tied to a day. */
  toBuy: number | null;
}) {
  const { locale, dict } = useI18n();
  const showEdit = useAddSheet((s) => s.showEdit);
  const copy = dict.today;
  const total = counts.open + counts.done;
  const many = (one: string, other: string, count: number) => (count === 1 ? one : format(other, { count }));

  // Today counts down what's left; another day just says what's on it.
  const title =
    counts.open > 0
      ? isToday
        ? many(copy.leftOne, copy.left, counts.open)
        : many(copy.dayTasksOne, copy.dayTasks, counts.open)
      : total > 0
        ? copy.allDone
        : isToday
          ? copy.noTasksToday
          : copy.noTasksForDay;
  const showRing = total > 0 && (isToday || counts.done > 0);
  const note =
    counts.done > 0
      ? counts.open > 0
        ? format(copy.dayProgress, { done: counts.done, total })
        : many(copy.doneOne, copy.done, counts.done)
      : total === 0 && events.length === 0
        ? copy.noTasksForDayHint
        : null;
  const fromBefore = counts.fromBefore > 0 ? many(copy.fromBeforeOne, copy.fromBefore, counts.fromBefore) : null;

  return (
    <section aria-labelledby="day-overview" className="flex flex-col gap-2.5">
      <h2 id="day-overview" className="px-1 text-[22px] font-bold leading-tight tracking-tight">
        {heading}
      </h2>
      <div className="overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-hairline">
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          {showRing ? (
            <ProgressRing value={counts.done / total} size={40} stroke={4} color={counts.open === 0 ? "var(--green)" : "var(--accent)"}>
              {counts.open === 0 && <Check aria-hidden size={18} strokeWidth={3} className="text-green" />}
            </ProgressRing>
          ) : (
            <span
              aria-hidden
              style={{ "--tone": total > 0 ? "var(--accent)" : "var(--green)" } as React.CSSProperties}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--tone)_12%,transparent)] text-(--tone)"
            >
              {total > 0 ? <ListChecks size={19} strokeWidth={2} /> : <Coffee size={19} strokeWidth={2} />}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-semibold leading-snug">{title}</p>
            {note && <p className="mt-0.5 text-[14px] leading-snug text-label-secondary">{note}</p>}
            {fromBefore && <p className="mt-0.5 text-[14px] font-medium leading-snug text-orange">{fromBefore}</p>}
          </div>
        </div>

        {events.length > 0 && (
          <ul>
            {events.map((event) => (
              <li key={event.id} className={rowRule}>
                <button
                  type="button"
                  onClick={() => showEdit({ kind: "event", id: event.id })}
                  aria-label={format(dict.add.editNamed, { title: event.title })}
                  className="block w-full touch-manipulation select-none text-start transition-colors duration-150 active:bg-fill"
                >
                  <EventRow event={event} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {toBuy != null && toBuy > 0 && (
          <Link
            href={`/${locale}/shopping`}
            className={`${rowRule} flex min-h-[52px] touch-manipulation select-none items-center gap-3 px-4 transition-colors duration-150 active:bg-fill`}
          >
            <IconTile icon={ShoppingBasket} color="var(--orange)" />
            <span className="min-w-0 flex-1 text-[16px]">{many(copy.shoppingOne, copy.shoppingLeft, toBuy)}</span>
            <ChevronRight aria-hidden size={18} strokeWidth={2.25} className="shrink-0 text-label-tertiary rtl:-scale-x-100" />
          </Link>
        )}
      </div>
    </section>
  );
}
