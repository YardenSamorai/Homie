"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localeDirection } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import { addDays, dayRange, diffDays, fromDayKey, isWeekend, weekStart, type DayKey } from "@/lib/dates";
import { easeOut, press, spring } from "@/lib/motion";

/** iOS Calendar-style week strip: one week per page, swipe to move a week, the weekday is kept. */
export function DateStrip({
  from,
  to,
  today,
  selected,
  markers,
  onSelect,
}: {
  from: DayKey;
  to: DayKey;
  today: DayKey;
  selected: DayKey;
  /** Colors of the members who have something on each day. */
  markers: Map<DayKey, string[]>;
  onSelect: (day: DayKey) => void;
}) {
  const { locale, dict } = useI18n();
  const rtl = localeDirection[locale] === "rtl";
  const scroller = useRef<HTMLDivElement>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  const isFirstScroll = useRef(true);

  const weeks = useMemo(() => {
    const first = weekStart(from);
    const count = diffDays(weekStart(to), first) / 7 + 1;
    return Array.from({ length: count }, (_, w) => dayRange(addDays(first, w * 7), 7));
  }, [from, to]);
  const selectedWeek = Math.floor(diffDays(selected, weeks[0][0]) / 7);
  const selectedWeekday = fromDayKey(selected).getDay();

  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });
  const selectedDate = fromDayKey(selected);
  const month = new Intl.DateTimeFormat(locale, { month: "long" }).format(selectedDate);
  const year = selectedDate.getFullYear();

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const left = selectedWeek * el.clientWidth * (rtl ? -1 : 1);
    if (Math.abs(el.scrollLeft - left) > 1) {
      el.scrollTo({ left, behavior: isFirstScroll.current ? "instant" : "smooth" });
    }
    isFirstScroll.current = false;
  }, [selectedWeek, rtl]);

  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // Scroll-snap does the paging; once it settles, follow the visible week like iOS does.
  const onScroll = () => {
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const el = scroller.current;
      if (!el) return;
      const index = Math.round(Math.abs(el.scrollLeft) / el.clientWidth);
      if (index !== selectedWeek && weeks[index]) onSelect(weeks[index][selectedWeekday]);
    }, 120);
  };

  const goWeek = (delta: number) => {
    const week = weeks[selectedWeek + delta];
    if (week) onSelect(week[selectedWeekday]);
  };

  return (
    <section aria-label={dict.today.pickDay} className="flex flex-col gap-3 rounded-card bg-surface px-2 pb-2 pt-3 shadow-card">
      <div className="flex min-h-10 items-center justify-between ps-3 pe-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2
            key={`${month}-${year}`}
            initial={{ opacity: 0, transform: "translateY(6px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-6px)" }}
            transition={{ duration: 0.2, ease: easeOut }}
            className="text-[22px] font-bold tracking-tight"
          >
            {month} <span className="font-normal text-label-secondary">{year}</span>
          </motion.h2>
        </AnimatePresence>

        <div className="flex items-center">
          <AnimatePresence>
            {selected !== today && (
              <motion.button
                type="button"
                onClick={() => onSelect(today)}
                initial={{ opacity: 0, transform: "scale(0.92)" }}
                animate={{ opacity: 1, transform: "scale(1)" }}
                exit={{ opacity: 0, transform: "scale(0.92)" }}
                whileTap={press}
                transition={{ duration: 0.18, ease: easeOut }}
                className="me-1 min-h-8 rounded-full bg-today/10 px-3.5 text-[15px] font-semibold text-today"
              >
                {dict.today.backToToday}
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => goWeek(-1)}
            disabled={selectedWeek === 0}
            aria-label={dict.today.previousWeek}
            className="flex size-10 items-center justify-center rounded-full text-accent transition-[opacity,scale] duration-100 ease-out active:scale-90 disabled:opacity-30"
          >
            <ChevronLeft aria-hidden size={22} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={() => goWeek(1)}
            disabled={selectedWeek === weeks.length - 1}
            aria-label={dict.today.nextWeek}
            className="flex size-10 items-center justify-center rounded-full text-accent transition-[opacity,scale] duration-100 ease-out active:scale-90 disabled:opacity-30"
          >
            <ChevronRight aria-hidden size={22} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
        </div>
      </div>

      <div aria-hidden className="grid grid-cols-7 text-center text-[11px] font-semibold text-label-secondary">
        {weeks[0].map((day) => (
          <span key={day} className={isWeekend(day, locale) ? "text-label-tertiary" : undefined}>
            {weekdayFormat.format(fromDayKey(day))}
          </span>
        ))}
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {weeks.map((week, w) => (
          <ul key={week[0]} className="grid w-full shrink-0 snap-start snap-always grid-cols-7">
            {week.map((day) => {
              const isSelected = day === selected;
              const isToday = day === today;
              const colors = markers.get(day) ?? [];
              return (
                <li key={day} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => onSelect(day)}
                    aria-pressed={isSelected}
                    aria-label={fullDate.format(fromDayKey(day))}
                    aria-current={isToday ? "date" : undefined}
                    className="group flex min-h-12 w-full flex-col items-center gap-1 py-1"
                  >
                    <span className="relative flex size-9 items-center justify-center transition-[scale] duration-100 ease-out group-active:scale-90">
                      {isSelected && (
                        <motion.span
                          layoutId={`week-${w}-selection`}
                          transition={spring.snappy}
                          className={`absolute inset-0 rounded-full ${isToday ? "bg-today" : "bg-label"}`}
                        />
                      )}
                      <span
                        className={`relative text-[19px] tabular-nums transition-colors duration-150 ${
                          isSelected
                            ? `font-semibold ${isToday ? "text-today-contrast" : "text-bg"}`
                            : isToday
                              ? "font-semibold text-today"
                              : "text-label"
                        }`}
                      >
                        {fromDayKey(day).getDate()}
                      </span>
                    </span>
                    <span aria-hidden className="flex h-1.5 gap-[3px]">
                      {colors.slice(0, 3).map((color) => (
                        <span key={color} className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </section>
  );
}
