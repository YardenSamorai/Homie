"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { fromDayKey } from "@/lib/dates";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { useAuth } from "@/lib/auth/session";
import { firstName, laterEvents, nextOpenEvent, tellDay } from "@/lib/day-story";
import { periodFor } from "@/lib/period";
import { tasksOfDay, type Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { useI18n } from "@/i18n/dictionary-provider";
import { ActivityBell } from "@/components/shell/activity";
import { UndoToast } from "@/components/ui/undo-toast";
import { DayTasks } from "./day-tasks";
import { HouseholdMembers } from "./household-members";
import { LaterToday } from "./later-today";

/** Bold the count and the time inside the day's sentence, the way the rest stays quiet. */
function StoryLine({ text, marks }: { text: string; marks: string[] }) {
  const parts: Array<string | { mark: string }> = [];
  let rest = text;
  for (const mark of marks) {
    const at = rest.indexOf(mark);
    if (at < 0) continue;
    if (at > 0) parts.push(rest.slice(0, at));
    parts.push({ mark });
    rest = rest.slice(at + mark.length);
  }
  if (rest) parts.push(rest);
  return (
    <p className="mt-3 text-[20px] font-medium leading-[1.45] text-pretty text-label/65">
      {parts.map((part, index) =>
        typeof part === "string" ? (
          <span key={index}>{part}</span>
        ) : (
          <span key={index} className="font-bold text-label">
            {part.mark}
          </span>
        ),
      )}
    </p>
  );
}

/**
 * Home is today: a sentence, the people, what's still coming, then the list.
 * Another day lives in the calendar. The greeting does not animate.
 */
export function TodayView() {
  const { locale, dict } = useI18n();
  const clock = useClock();
  const today = clock?.today ?? null;
  const { currentUserId, members, tasks, events, toggleTask } = useHousehold();
  const householdId = useAuth((s) => s.session?.householdId ?? null);
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const currentUser = members.find((member) => member.id === currentUserId) ?? members[0];
  const [toast, setToast] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    setSharedDay(today);
    return () => setSharedDay(null);
  }, [today, setSharedDay]);

  const dismissToast = useCallback(() => setToast(null), []);
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

  const ofDay = today ? tasksOfDay(tasks, today, today) : null;
  const next = today ? nextOpenEvent(events, today, clock?.hour ?? null, true) : null;
  const coming = today ? laterEvents(events, today, clock?.hour ?? null, true) : [];
  const story = ofDay
    ? tellDay({
        open: ofDay.open.length,
        done: ofDay.done.length,
        isToday: true,
        event: next ? { title: next.title, time: next.time, who: null } : null,
        copy: dict.today,
      })
    : null;
  const yours = currentUser ? (ofDay?.open.find((task) => task.assigneeId === currentUser.id) ?? null) : null;

  return (
    <div className="relative isolate flex flex-col gap-6 pt-3 md:pt-10">
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

      <header>
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] font-semibold text-label/60 first-letter:uppercase">{dateLine || "\u00a0"}</p>
          <ActivityBell glass />
        </div>
        <h1 className="mt-1 text-balance text-[clamp(2.15rem,9.2vw,2.25rem)] font-bold leading-[1.08] tracking-[-0.025em] [overflow-wrap:anywhere]">
          <bdi>{currentUser ? `${greeting}, ${firstName(currentUser.name)}` : greeting || "\u00a0"}</bdi>
        </h1>
        {story && <StoryLine text={story.text} marks={story.marks} />}
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

      {today && ofDay ? (
        <>
          <LaterToday isToday events={coming} yours={yours} />
          <DayTasks day={today} previousDay={today} today={today} tasks={tasks} members={members} onToggle={toggle} />
        </>
      ) : (
        <div aria-hidden className="h-[240px]" />
      )}

      <UndoToast toast={toast} label={dict.today.markedDone} undoLabel={dict.today.undo} onUndo={undo} onDismiss={dismissToast} />
    </div>
  );
}
