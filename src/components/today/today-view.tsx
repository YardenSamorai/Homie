"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addDays, dayRange, diffDays, fromDayKey, type DayKey } from "@/lib/dates";
import { sortEvents } from "@/lib/household";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { useAuth } from "@/lib/auth/session";
import { periodFor } from "@/lib/period";
import { isProjectedOn, tasksOfDay, type Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { useI18n } from "@/i18n/dictionary-provider";
import { ActivityBell } from "@/components/shell/activity";
import { UndoToast } from "@/components/ui/undo-toast";
import { DateStrip } from "./date-strip";
import { DayOverview } from "./day-overview";
import { DayTasks } from "./day-tasks";
import { HouseholdMembers } from "./household-members";

/** A greeting says "Good afternoon, Yarden", never the full name. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const DAYS_BACK = 30;
const DAYS_AHEAD = 90;

/**
 * Home: who's home and what the day holds. A greeting under the light of the hour, the household, the week,
 * then the chosen day: how far along it is, and its tasks.
 */
export function TodayView() {
  const { locale, dict } = useI18n();
  const clock = useClock();
  const today = clock?.today ?? null;
  const { currentUserId, members, tasks, events, shopping, toggleTask } = useHousehold();
  const householdName = useAuth((s) => s.session?.householdName ?? null);
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const currentUser = members.find((member) => member.id === currentUserId) ?? members[0];

  const [selection, setSelection] = useState<{ day: DayKey | null; previous: DayKey | null }>({ day: null, previous: null });
  const selected = selection.day ?? today;
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    setSharedDay(selected);
    return () => setSharedDay(null);
  }, [selected, setSharedDay]);

  const days = useMemo(() => (today ? dayRange(addDays(today, -DAYS_BACK), DAYS_BACK + DAYS_AHEAD + 1) : []), [today]);

  const marked = useMemo(() => {
    const set = new Set<DayKey>();
    if (!today) return set;
    for (const task of tasks) if (task.dueDate && !task.completedAt) set.add(task.dueDate);
    for (const event of events) set.add(event.date);
    for (const day of days) if (tasks.some((task) => isProjectedOn(task, day, today))) set.add(day);
    return set;
  }, [tasks, events, days, today]);

  const dismissToast = useCallback(() => setToast(null), []);

  const select = (day: DayKey) => setSelection((s) => ({ day, previous: s.day ?? today }));
  const period = clock && clock.hour != null ? periodFor(clock.hour) : null;
  const greeting = period ? dict.today.greeting[period] : "";
  const dateLine = today
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(today))
    : "";

  const toggle = (task: Task) => {
    if (!today) return;
    setToast(task.completedAt ? null : { id: task.id, title: task.title });
    toggleTask(task, today);
  };
  const undo = (id: string) => {
    const task = useHousehold.getState().tasks.find((t) => t.id === id);
    if (task?.completedAt && today) toggleTask(task, today);
    setToast(null);
  };

  const overview = (() => {
    if (!today || !selected) return null;
    const { fromBefore, open, done } = tasksOfDay(tasks, selected, today);
    const offset = diffDays(selected, today);
    const heading =
      offset === 0
        ? dict.today.overviewToday
        : offset === 1
          ? dict.today.overviewTomorrow
          : offset === -1
            ? new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-1, "day").replace(/^\p{Ll}/u, (c) => c.toUpperCase())
            : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(selected));
    return {
      heading,
      counts: { open: open.length + fromBefore.length, done: done.length, fromBefore: fromBefore.length },
      events: events.filter((e) => e.date === selected).sort(sortEvents),
      toBuy: offset === 0 ? shopping.filter((item) => !item.checkedAt).length : null,
    };
  })();

  return (
    <div className="relative isolate flex flex-col gap-7 pt-5 md:pt-10">
      <AnimatePresence initial={false}>
        {period && (
          <motion.div
            key={period}
            aria-hidden
            data-period={period}
            className="atmosphere"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* Greeting, people and week read as one block: who's home and which day, before the day itself. */}
      <div className="flex flex-col gap-4">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-label-secondary first-letter:uppercase">{dateLine || "\u00a0"}</p>
            <h1 className="mt-0.5 text-balance text-[clamp(1.75rem,8.4vw,2.125rem)] font-bold leading-[1.1] tracking-tight [overflow-wrap:anywhere]">
              <bdi>{currentUser ? `${greeting}, ${firstName(currentUser.name)}` : greeting || "\u00a0"}</bdi>
            </h1>
            {householdName && (
              <p className="mt-1 truncate text-[15px] text-label-secondary">
                <bdi>{householdName}</bdi>
              </p>
            )}
          </div>
          <div className="mt-1 shrink-0">
            <ActivityBell />
          </div>
        </header>
        {members.length > 0 && (
          <HouseholdMembers
            members={members}
            self={currentUser?.id ?? ""}
            tasks={tasks}
            today={today}
            canInvite={members.length < 2 && householdId != null}
          />
        )}
        {today && selected ? (
          <DateStrip from={days[0]} to={days[days.length - 1]} today={today} selected={selected} marked={marked} onSelect={select} />
        ) : (
          <div aria-hidden className="h-[104px]" />
        )}
      </div>

      {today && selected && overview ? (
        <>
          <DayOverview heading={overview.heading} isToday={selected === today} counts={overview.counts} events={overview.events} toBuy={overview.toBuy} />
          <DayTasks
            day={selected}
            previousDay={selection.previous ?? selected}
            today={today}
            tasks={tasks}
            members={members}
            onToggle={toggle}
          />
        </>
      ) : (
        <div aria-hidden className="h-[240px]" />
      )}

      <UndoToast toast={toast} label={dict.today.markedDone} undoLabel={dict.today.undo} onUndo={undo} onDismiss={dismissToast} />
    </div>
  );
}
