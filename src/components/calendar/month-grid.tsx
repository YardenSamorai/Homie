"use client";

import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { localeDirection } from "@/i18n/config";
import { useI18n } from "@/i18n/dictionary-provider";
import { addMonths, dayRange, fromDayKey, isWeekend, weekStart, type DayKey } from "@/lib/dates";
import { easeOut, press, spring } from "@/lib/motion";

/** Apple Calendar-style month: six weeks, red today, filled circle on the selected day, dots for events. */
export function MonthGrid({
  month,
  previousMonth,
  today,
  selected,
  marked,
  onSelect,
  onMonthChange,
}: {
  /** First day of the visible month. */
  month: DayKey;
  previousMonth: DayKey;
  today: DayKey;
  selected: DayKey;
  marked: Set<DayKey>;
  onSelect: (day: DayKey) => void;
  onMonthChange: (month: DayKey) => void;
}) {
  const { locale, dict } = useI18n();
  const cells = dayRange(weekStart(month), 42);
  const monthDate = fromDayKey(month);
  const monthName = new Intl.DateTimeFormat(locale, { month: "long" }).format(monthDate);
  const weekdayFormat = new Intl.DateTimeFormat(locale, { weekday: "narrow" });
  const fullDate = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });

  const forward = month >= previousMonth ? 1 : -1;
  const shift = 20 * forward * (localeDirection[locale] === "rtl" ? -1 : 1);
  const isCurrentMonth = month === today.slice(0, 7) + "-01";

  return (
    <section aria-label={dict.calendar.title} className="flex flex-col gap-3 rounded-card bg-surface px-2 pb-3 pt-3 shadow-card">
      <div className="flex min-h-10 items-center justify-between ps-3 pe-1">
        <h2 className="text-[22px] font-bold tracking-tight">
          <span className={isCurrentMonth ? "text-today" : undefined}>{monthName}</span>{" "}
          <span className="font-normal text-label-secondary">{monthDate.getFullYear()}</span>
        </h2>
        <div className="flex items-center">
          <AnimatePresence>
            {(selected !== today || !isCurrentMonth) && (
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
            onClick={() => onMonthChange(addMonths(month, -1))}
            aria-label={dict.calendar.previousMonth}
            className="flex size-10 items-center justify-center rounded-full text-accent transition-[scale] duration-100 ease-out active:scale-90"
          >
            <ChevronLeft aria-hidden size={22} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(addMonths(month, 1))}
            aria-label={dict.calendar.nextMonth}
            className="flex size-10 items-center justify-center rounded-full text-accent transition-[scale] duration-100 ease-out active:scale-90"
          >
            <ChevronRight aria-hidden size={22} strokeWidth={2.5} className="rtl:-scale-x-100" />
          </button>
        </div>
      </div>

      <div aria-hidden className="grid grid-cols-7 text-center text-[11px] font-semibold text-label-secondary">
        {cells.slice(0, 7).map((day) => (
          <span key={day} className={isWeekend(day, locale) ? "text-label-tertiary" : undefined}>
            {weekdayFormat.format(fromDayKey(day))}
          </span>
        ))}
      </div>

      <div className="overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={shift}>
          <motion.ul
            key={month}
            custom={shift}
            variants={{
              enter: (x: number) => ({ opacity: 0, transform: `translateX(${x}px)` }),
              center: { opacity: 1, transform: "translateX(0px)", transition: { duration: 0.22, ease: easeOut } },
              exit: (x: number) => ({ opacity: 0, transform: `translateX(${-x}px)`, transition: { duration: 0.14, ease: easeOut } }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            className="grid grid-cols-7 gap-y-0.5"
          >
            {cells.map((day) => {
              const inMonth = day.slice(0, 7) === month.slice(0, 7);
              const isSelected = day === selected;
              const isToday = day === today;
              return (
                <li key={day} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => onSelect(day)}
                    aria-pressed={isSelected}
                    aria-label={fullDate.format(fromDayKey(day))}
                    aria-current={isToday ? "date" : undefined}
                    className="group flex min-h-12 w-full flex-col items-center gap-0.5 pt-0.5"
                  >
                    <span className="relative flex size-9 items-center justify-center transition-[scale] duration-100 ease-out group-active:scale-90">
                      {isSelected && (
                        <motion.span
                          layoutId={`month-${month}-selection`}
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
                              : inMonth
                                ? "text-label"
                                : "text-label-tertiary"
                        }`}
                      >
                        {fromDayKey(day).getDate()}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`size-1.5 rounded-full ${marked.has(day) ? (inMonth ? "bg-label-tertiary" : "bg-separator") : ""}`}
                    />
                  </button>
                </li>
              );
            })}
          </motion.ul>
        </AnimatePresence>
      </div>
    </section>
  );
}
