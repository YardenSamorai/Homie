"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, Plus } from "lucide-react";
import { WeekTiles } from "@/components/calendar/week-tiles";
import { EventRow } from "@/components/events/event-row";
import { PageStage } from "@/components/shell/page-stage";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { addDays, dayRange, diffDays, fromDayKey, weekStart, type DayKey } from "@/lib/dates";
import { PREP_WINDOW_DAYS, sortEvents, type HouseEvent } from "@/lib/household";
import { useAddSheet, useHousehold, useSelectedDay } from "@/lib/household-store";
import { useClock } from "@/lib/use-clock";

type Scope = "day" | "week" | "upcoming";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-8 after:h-px after:bg-separator last:after:hidden";

const UPCOMING_DAYS = 30;

/**
 * The home's calendar: a live title for what's picked, the stage with what's coming, then a day, its week,
 * or the month ahead. The week tiles pick the day; the scope decides how much of it to show.
 */
export function CalendarView() {
  const { locale, dict } = useI18n();
  const today = useClock()?.today ?? null;
  const { events } = useHousehold();
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const show = useAddSheet((s) => s.show);
  const showEdit = useAddSheet((s) => s.showEdit);
  const [picked, setPicked] = useState<DayKey | null>(null);
  const [scope, setScope] = useState<Scope>("day");
  const selected = picked ?? today;
  const copy = dict.calendar;

  useEffect(() => {
    setSharedDay(selected);
    return () => setSharedDay(null);
  }, [selected, setSharedDay]);

  const marked = useMemo(() => new Set(events.map((e) => e.date)), [events]);
  const longDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "long" });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (!today || !selected) {
    return (
      <>
        <PageHeader title={copy.title} />
        <div aria-hidden className="h-[420px]" />
      </>
    );
  }

  const weekDays = dayRange(weekStart(selected), 7);
  const inScope = (event: HouseEvent) =>
    scope === "day"
      ? event.date === selected
      : scope === "week"
        ? event.date >= weekDays[0] && event.date <= weekDays[6]
        : event.date >= today && event.date <= addDays(today, UPCOMING_DAYS);
  const shown = events.filter(inScope).sort(sortEvents);

  const offset = diffDays(selected, today);
  const when =
    scope === "upcoming"
      ? copy.whenUpcoming
      : scope === "week"
        ? weekDays.includes(today)
          ? copy.whenWeek
          : format(copy.whenWeekOf, { date: shortDate.format(fromDayKey(weekDays[0])) })
        : offset === 0
          ? copy.whenToday
          : offset === 1
            ? copy.whenTomorrow
            : format(copy.whenOn, { day: dayName.format(fromDayKey(selected)) });
  const title =
    shown.length === 0
      ? format(copy.countNone, { when })
      : shown.length === 1
        ? format(copy.countOne, { when })
        : format(copy.countMany, { count: shown.length, when });
  const freeTitle =
    scope === "upcoming" ? copy.freeUpcoming : scope === "week" ? copy.freeWeek : offset === 0 ? copy.freeToday : copy.freeDay;

  const coming = events
    .filter((e) => e.date > today || (e.date === today && (!e.time || e.time.slice(0, 5) >= new Date().toTimeString().slice(0, 5))))
    .sort(sortEvents);
  const toPrepare = events.filter((e) => e.prep && e.date >= today && e.date <= addDays(today, PREP_WINDOW_DAYS)).sort(sortEvents);
  const groups = scope === "day" ? [{ date: selected, events: shown }] : [...new Set(shown.map((e) => e.date))].map((date) => ({ date, events: shown.filter((e) => e.date === date) }));
  const dayLabel = (date: DayKey) => {
    const days = diffDays(date, today);
    return Math.abs(days) <= 1
      ? relative.format(days, "day").replace(/^\p{Ll}/u, (c) => c.toUpperCase())
      : longDate.format(fromDayKey(date));
  };
  const chipDay = (date: DayKey) => {
    const days = diffDays(date, today);
    if (days <= 1) return relative.format(days, "day");
    return days < 7 ? dayName.format(fromDayKey(date)) : shortDate.format(fromDayKey(date));
  };

  return (
    <>
      <PageHeader eyebrow={<span className="capitalize">{longDate.format(fromDayKey(selected))}</span>} title={title} />
      <div className="flex flex-col gap-6">
        <PageStage
          icon={CalendarDays}
          tint={["#7cc0c4", "#3f8a90"]}
          count={coming.length}
          chips={coming.map((event) => ({
            id: event.id,
            title: event.title,
            note: [chipDay(event.date), event.time?.slice(0, 5)].filter(Boolean).join(" · "),
            visual: (
              <span className="flex w-8 shrink-0 flex-col items-center overflow-hidden rounded-[9px] bg-[color-mix(in_oklab,var(--teal)_14%,var(--surface))] leading-none">
                <span className="w-full bg-teal py-[2px] text-center text-[9px] font-bold text-white">
                  {new Intl.DateTimeFormat(locale, { weekday: "narrow" }).format(fromDayKey(event.date))}
                </span>
                <span className="py-[4px] text-[13px] font-bold tabular-nums text-label">{fromDayKey(event.date).getDate()}</span>
              </span>
            ),
          }))}
        />

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <SegmentedControl
              label={copy.title}
              value={scope}
              onChange={setScope}
              options={(["day", "week", "upcoming"] as const).map((value) => ({ value, label: copy.scopes[value] }))}
            />
          </div>
          <button
            type="button"
            onClick={() => show("event", selected)}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent ps-3 pe-4 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_color-mix(in_oklab,var(--accent)_28%,transparent),inset_0_1px_0_rgb(255_255_255/0.28)] transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <Plus aria-hidden size={17} strokeWidth={2.5} />
            {copy.newEvent}
          </button>
        </div>

        {scope !== "upcoming" && (
          <WeekTiles today={today} selected={selected} marked={marked} onSelect={setPicked} />
        )}

        <div className="overflow-hidden rounded-card bg-surface shadow-card">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center pb-8">
              {scope === "day" && <p className="w-full px-4 pt-3 text-start text-[13px] font-semibold text-label-secondary">{longDate.format(fromDayKey(selected))}</p>}
              <EmptyState icon={CalendarDays} tint="var(--teal)" title={freeTitle} hint={format(copy.freeHint, { when })} />
              <button
                type="button"
                onClick={() => show("event", selected)}
                className="-mt-4 flex min-h-11 items-center gap-1.5 rounded-full bg-fill ps-4 pe-5 text-[15px] font-semibold text-label transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                <Plus aria-hidden size={17} strokeWidth={2.5} />
                {copy.addEvent}
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <section key={group.date}>
                <h2 className="px-4 pb-1 pt-3 text-[13px] font-semibold text-label-secondary">
                  {scope === "day" ? longDate.format(fromDayKey(group.date)) : dayLabel(group.date)}
                </h2>
                <ul>
                  {group.events.map((event) => (
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
              </section>
            ))
          )}
        </div>

        {toPrepare.length > 0 && (
          <section aria-labelledby="prepare-title" className="flex flex-col gap-2">
            <div className="flex items-center gap-2 px-1">
              <span aria-hidden className="flex size-[26px] items-center justify-center rounded-[7px] bg-orange text-white">
                <ClipboardList size={16} strokeWidth={2.25} />
              </span>
              <h2 id="prepare-title" className="text-xl font-semibold tracking-tight">
                {copy.prepare}
              </h2>
            </div>
            <ul className="overflow-hidden rounded-card bg-surface shadow-card">
              {toPrepare.map((event) => {
                const days = diffDays(event.date, today);
                return (
                  <li key={event.id} className={separator}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(event.date);
                        setScope("day");
                      }}
                      className="block w-full text-start transition-colors duration-150 active:bg-fill hover:bg-fill"
                    >
                      <EventRow event={event} caption={days <= 7 ? relative.format(days, "day") : shortDate.format(fromDayKey(event.date))} />
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="px-1 text-[13px] text-label-secondary">{copy.prepareHint}</p>
          </section>
        )}
      </div>
    </>
  );
}
