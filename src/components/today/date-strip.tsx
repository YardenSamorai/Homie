"use client";

import { useEffect, useMemo, useRef, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localeDirection } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import { addDays, dayRange, diffDays, fromDayKey, isWeekend, weekStart, type DayKey } from "@/lib/dates";
import { easeOut, press, spring } from "@/lib/motion";

const arrow =
  "relative flex size-9 items-center justify-center rounded-full text-accent transition-[opacity,scale] duration-100 ease-out before:absolute before:-inset-1 active:scale-90 disabled:opacity-30";

/** iOS Calendar-style week strip: one week per page, swipe to move a week, the weekday is kept. */
export function DateStrip({
  from,
  to,
  today,
  selected,
  marked,
  onSelect,
}: {
  from: DayKey;
  to: DayKey;
  today: DayKey;
  selected: DayKey;
  /** Days with a task or an event on them. */
  marked: Set<DayKey>;
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

  // The week names its month; a week across two names both, and another year says which.
  const week = weeks[selectedWeek];
  const [first, last] = [fromDayKey(week[0]), fromDayKey(week[6])];
  const monthOnly = new Intl.DateTimeFormat(locale, { month: "long" });
  const withYear = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" });
  const thisYear = fromDayKey(today).getFullYear();
  const monthOf = (date: Date) => (date.getFullYear() === thisYear ? monthOnly : withYear).format(date);
  const monthLabel = first.getMonth() === last.getMonth() ? monthOf(first) : `${monthOf(first)} – ${monthOf(last)}`;

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
    const next = weeks[selectedWeek + delta];
    if (next) onSelect(next[selectedWeekday]);
  };

  // One Tab stop for the strip and arrows to move the day: every week is in the DOM, and focusing a
  // hidden one would scroll it in and select its day.
  const onDayKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const targets: Record<string, DayKey | undefined> = {
      ArrowRight: addDays(selected, rtl ? -1 : 1),
      ArrowLeft: addDays(selected, rtl ? 1 : -1),
      PageDown: addDays(selected, 7),
      PageUp: addDays(selected, -7),
      Home: weeks[selectedWeek][0],
      End: weeks[selectedWeek][6],
    };
    const target = targets[event.key];
    if (!target) return;
    event.preventDefault();
    if (target < weeks[0][0] || target > weeks[weeks.length - 1][6]) return;
    onSelect(target);
    scroller.current?.querySelector<HTMLButtonElement>(`[data-day="${target}"]`)?.focus({ preventScroll: true });
  };

  return (
    <section aria-label={dict.today.pickDay} className="flex flex-col gap-1">
      <div className="flex min-h-9 items-center justify-between gap-2 ps-1">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.h2
            key={monthLabel}
            initial={{ opacity: 0, transform: "translateY(4px)" }}
            animate={{ opacity: 1, transform: "translateY(0px)" }}
            exit={{ opacity: 0, transform: "translateY(-4px)" }}
            transition={{ duration: 0.18, ease: easeOut }}
            className="min-w-0 truncate text-[15px] font-semibold"
          >
            {monthLabel}
          </motion.h2>
        </AnimatePresence>

        <div className="flex shrink-0 items-center">
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
                className="relative min-h-8 rounded-full bg-today/10 px-3.5 text-[15px] font-semibold text-today before:absolute before:inset-x-0 before:-inset-y-1.5"
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
            className={`${arrow} ms-1 max-md:hidden`}
          >
            <ChevronLeft aria-hidden size={20} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={() => goWeek(1)}
            disabled={selectedWeek === weeks.length - 1}
            aria-label={dict.today.nextWeek}
            className={`${arrow} max-md:hidden`}
          >
            <ChevronRight aria-hidden size={20} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-1 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
      >
        {weeks.map((days, w) => (
          <ul key={days[0]} className="grid w-full shrink-0 snap-start snap-always grid-cols-7 px-1">
            {days.map((day) => {
              const isSelected = day === selected;
              const isToday = day === today;
              return (
                <li key={day} className="flex justify-center">
                  <button
                    type="button"
                    data-day={day}
                    tabIndex={isSelected ? 0 : -1}
                    onClick={() => onSelect(day)}
                    onKeyDown={onDayKey}
                    aria-pressed={isSelected}
                    aria-label={fullDate.format(fromDayKey(day))}
                    aria-current={isToday ? "date" : undefined}
                    className="group flex w-full flex-col items-center gap-1 pb-1 pt-0.5"
                  >
                    <span
                      className={`text-[12px] font-medium ${
                        isToday ? "text-today" : isWeekend(day, locale) ? "text-label-tertiary" : "text-label-secondary"
                      }`}
                    >
                      {weekdayFormat.format(fromDayKey(day))}
                    </span>
                    <span className="relative flex size-10 items-center justify-center transition-[scale] duration-100 ease-out group-active:scale-90">
                      {isSelected && (
                        <motion.span
                          layoutId={`week-${w}-selection`}
                          transition={spring.snappy}
                          className={`absolute inset-0 rounded-full ${isToday ? "bg-today" : "bg-label"}`}
                        />
                      )}
                      <span
                        className={`relative text-[18px] tabular-nums transition-colors duration-150 ${
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
                    <span
                      aria-hidden
                      className={`size-[5px] rounded-full transition-opacity duration-150 ${marked.has(day) ? "bg-label-tertiary" : "opacity-0"}`}
                    />
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
