"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { addDays, dayRange, fromDayKey, type DayKey } from "@/lib/dates";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { useAuth } from "@/lib/auth/session";
import { firstName, laterEvents, nextOpenEvent, tellDay } from "@/lib/day-story";
import { periodFor } from "@/lib/period";
import { isProjectedOn, tasksOfDay, type Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { useI18n } from "@/i18n/dictionary-provider";
import { ActivityBell } from "@/components/shell/activity";
import { UndoToast } from "@/components/ui/undo-toast";
import { DateStrip } from "./date-strip";
import { DayTasks } from "./day-tasks";
import { HouseholdMembers } from "./household-members";
import { LaterToday } from "./later-today";

const DAYS_BACK = 30;
const DAYS_AHEAD = 90;

/**
 * Home: one sentence for the day, the people, what's still coming, then the list.
 * The greeting does not animate — this screen opens tens of times a day.
 */
export function TodayView() {
  const { locale, dict } = useI18n();
  const clock = useClock();
  const today = clock?.today ?? null;
  const { currentUserId, members, tasks, events, toggleTask } = useHousehold();
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

  const isToday = Boolean(today && selected && selected === today);
  const ofDay = today && selected ? tasksOfDay(tasks, selected, today) : null;
  const next = today && selected ? nextOpenEvent(events, selected, clock?.hour ?? null, isToday) : null;
  const coming = today && selected ? laterEvents(events, selected, clock?.hour ?? null, isToday) : [];
  const story =
    ofDay && selected
      ? tellDay({
          open: ofDay.open.length,
          done: ofDay.done.length,
          isToday,
          event: next ? { title: next.title, time: next.time, who: null } : null,
          copy: dict.today,
        })
      : "";
  const yours = isToday && currentUser ? (ofDay?.open.find((task) => task.assigneeId === currentUser.id) ?? null) : null;

  return (
    <div className="relative isolate flex flex-col gap-6 pt-5 md:pt-10">
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

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-label/60 first-letter:uppercase">{dateLine || "\u00a0"}</p>
          <h1 className="mt-1 text-balance text-[clamp(2rem,9vw,2.25rem)] font-bold leading-[1.08] tracking-[-0.025em] [overflow-wrap:anywhere]">
            <bdi>{currentUser ? `${greeting}, ${firstName(currentUser.name)}` : greeting || "\u00a0"}</bdi>
          </h1>
          {story && (
            <p className="mt-3 text-[20px] font-medium leading-[1.45] text-pretty text-label/65">{story}</p>
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

      {today && selected && ofDay ? (
        <>
          <LaterToday isToday={isToday} events={coming} yours={yours} />
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
