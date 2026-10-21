"use client";

import { useRef, type PointerEvent } from "react";
import { motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localeDirection } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import { addDays, dayRange, fromDayKey, weekStart, type DayKey } from "@/lib/dates";
import { spring } from "@/lib/motion";

/**
 * One week as tiles: the picked day filled, today in the accent, a dot under days that have events.
 * The arrows or a horizontal swipe move a week, keeping the weekday.
 */
export function WeekTiles({
  today,
  selected,
  marked,
  onSelect,
}: {
  today: DayKey;
  selected: DayKey;
  marked: Set<DayKey>;
  onSelect: (day: DayKey) => void;
}) {
  const { locale, dict } = useI18n();
  const rtl = localeDirection[locale] === "rtl";
  const days = dayRange(weekStart(selected), 7);
  // Hebrew "short" is "יום א׳"; the narrow form is the letter alone, which is what a tile has room for.
  const weekday = new Intl.DateTimeFormat(locale, { weekday: locale === "he" ? "narrow" : "short" });
  const full = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const swipe = useRef<number | null>(null);

  const shift = (weeks: number) => onSelect(addDays(selected, weeks * 7));
  const down = (event: PointerEvent) => {
    swipe.current = event.clientX;
  };
  const up = (event: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = event.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) < 40) return;
    // Swiping toward the reading start brings the next week, as pages do.
    shift((dx < 0) !== rtl ? 1 : -1);
  };

  const arrow =
    "flex size-9 shrink-0 items-center justify-center rounded-full text-label-secondary transition-[scale,color] duration-150 ease-out active:scale-90 hover:text-accent";

  return (
    <section aria-label={dict.today.pickDay} className="flex items-center gap-1">
      <button type="button" onClick={() => shift(-1)} aria-label={dict.calendar.previousWeek} className={arrow}>
        <ChevronRight aria-hidden size={20} strokeWidth={2.25} className="ltr:-scale-x-100" />
      </button>
      <div className="flex min-w-0 flex-1 touch-pan-y gap-1" onPointerDown={down} onPointerUp={up} onPointerCancel={() => (swipe.current = null)}>
        {days.map((day) => {
          const picked = day === selected;
          const isToday = day === today;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              aria-pressed={picked}
              aria-label={full.format(fromDayKey(day))}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[16px] py-2 transition-transform duration-150 ease-out active:scale-95"
            >
              {picked && (
                <motion.span
                  layoutId="week-tile"
                  transition={spring.snappy}
                  className="absolute inset-0 rounded-[16px] bg-accent shadow-[0_8px_18px_-8px_color-mix(in_oklab,var(--accent)_70%,transparent)]"
                />
              )}
              <span className={`relative text-[12px] font-medium ${picked ? "text-accent-contrast/85" : "text-label-secondary"}`}>
                {weekday.format(fromDayKey(day))}
              </span>
              <span
                className={`relative text-[19px] font-bold tabular-nums leading-none ${
                  picked ? "text-accent-contrast" : isToday ? "text-accent" : "text-label"
                }`}
              >
                {fromDayKey(day).getDate()}
              </span>
              <span
                aria-hidden
                className={`relative size-1.5 rounded-full ${marked.has(day) ? (picked ? "bg-accent-contrast" : "bg-teal") : "bg-transparent"}`}
              />
            </button>
          );
        })}
      </div>
      <button type="button" onClick={() => shift(1)} aria-label={dict.calendar.nextWeek} className={arrow}>
        <ChevronLeft aria-hidden size={20} strokeWidth={2.25} className="ltr:-scale-x-100" />
      </button>
    </section>
  );
}
