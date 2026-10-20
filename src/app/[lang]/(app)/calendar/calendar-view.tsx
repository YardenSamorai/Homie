"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList } from "lucide-react";
import { MonthGrid } from "@/components/calendar/month-grid";
import { EventRow } from "@/components/events/event-row";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { addDays, diffDays, fromDayKey, startOfMonth, type DayKey } from "@/lib/dates";
import { PREP_WINDOW_DAYS, sortEvents } from "@/lib/household";
import { useAddSheet, useHousehold, useSelectedDay } from "@/lib/household-store";
import { useClock } from "@/lib/use-clock";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-8 after:h-px after:bg-separator last:after:hidden";

export function CalendarView() {
  const { locale, dict } = useI18n();
  const today = useClock()?.today ?? null;
  const { events } = useHousehold();
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const showEdit = useAddSheet((s) => s.showEdit);

  const [picked, setPicked] = useState<DayKey | null>(null);
  const [months, setMonths] = useState<{ current: DayKey | null; previous: DayKey | null }>({ current: null, previous: null });
  const selected = picked ?? today;
  const month = months.current ?? (selected ? startOfMonth(selected) : null);

  useEffect(() => {
    setSharedDay(selected);
    return () => setSharedDay(null);
  }, [selected, setSharedDay]);

  const marked = useMemo(() => new Set(events.map((e) => e.date)), [events]);
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  if (!today || !selected || !month) return <div aria-hidden className="h-[420px]" />;

  const goToMonth = (next: DayKey) => setMonths({ current: next, previous: month });
  const select = (day: DayKey) => {
    setPicked(day);
    if (startOfMonth(day) !== month) goToMonth(startOfMonth(day));
  };

  const dayEvents = events.filter((e) => e.date === selected).sort(sortEvents);
  const toPrepare = events
    .filter((e) => e.prep && e.date >= today && e.date <= addDays(today, PREP_WINDOW_DAYS))
    .sort(sortEvents);

  const offset = diffDays(selected, today);
  const heading =
    Math.abs(offset) <= 1
      ? relative.format(offset, "day").replace(/^\p{Ll}/u, (c) => c.toUpperCase())
      : longDate.format(fromDayKey(selected));

  return (
    <div className="flex flex-col gap-8">
      <MonthGrid
        month={month}
        previousMonth={months.previous ?? month}
        today={today}
        selected={selected}
        marked={marked}
        onSelect={select}
        onMonthChange={(next) => {
          goToMonth(next);
          setPicked(next === startOfMonth(today) ? today : next);
        }}
      />

      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-xl font-semibold tracking-tight">{heading}</h2>
        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          {dayEvents.length === 0 ? (
            <EmptyState icon={CalendarDays} title={dict.calendar.noEvents} hint={dict.calendar.noEventsHint} />
          ) : (
            <ul>
              {dayEvents.map((event) => (
                <li key={event.id} className={separator}>
                  <button
                    type="button"
                    onClick={() => showEdit({ kind: "event", id: event.id })}
                    aria-label={format(dict.add.editNamed, { title: event.title })}
                    className="block w-full touch-manipulation select-none text-start active:bg-fill"
                  >
                    <EventRow event={event} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {toPrepare.length > 0 && (
        <section aria-labelledby="prepare-title" className="flex flex-col gap-2">
          <div className="flex items-center gap-2 px-1">
            <span aria-hidden className="flex size-[26px] items-center justify-center rounded-[7px] bg-orange text-white">
              <ClipboardList size={16} strokeWidth={2.25} />
            </span>
            <h2 id="prepare-title" className="text-xl font-semibold tracking-tight">
              {dict.calendar.prepare}
            </h2>
          </div>
          <ul className="overflow-hidden rounded-card bg-surface shadow-card">
            {toPrepare.map((event) => {
              const days = diffDays(event.date, today);
              return (
                <li key={event.id} className={separator}>
                  <button
                    type="button"
                    onClick={() => select(event.date)}
                    className="block w-full text-start transition-colors duration-150 active:bg-fill hover:bg-fill"
                  >
                    <EventRow
                      event={event}
                      caption={days <= 7 ? relative.format(days, "day") : shortDate.format(fromDayKey(event.date))}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-1 text-[13px] text-label-secondary">{dict.calendar.prepareHint}</p>
        </section>
      )}
    </div>
  );
}
