"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ShoppingBasket } from "lucide-react";
import { addDays, fromDayKey, dayRange, type DayKey } from "@/lib/dates";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { periodFor } from "@/lib/period";
import { isProjectedOn, type Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { ActivityBell } from "@/components/shell/activity";
import { IconTile } from "@/components/ui/icon-tile";
import { DateStrip } from "./date-strip";
import { DayTasks } from "./day-tasks";
import { HouseholdMembers } from "./household-members";

/** A greeting says "Good afternoon, Yarden", never the full name. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

const DAYS_BACK = 30;
const DAYS_AHEAD = 90;

export function TodayView() {
  const { locale, dict } = useI18n();
  const clock = useClock();
  const today = clock?.today ?? null;
  const { currentUserId, members, tasks, events, shopping, toggleTask } = useHousehold();
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const currentUser = members.find((member) => member.id === currentUserId) ?? members[0];

  const [selection, setSelection] = useState<{ day: DayKey | null; previous: DayKey | null }>({ day: null, previous: null });
  const selected = selection.day ?? today;

  useEffect(() => {
    setSharedDay(selected);
    return () => setSharedDay(null);
  }, [selected, setSharedDay]);

  const days = useMemo(() => (today ? dayRange(addDays(today, -DAYS_BACK), DAYS_BACK + DAYS_AHEAD + 1) : []), [today]);

  const markers = useMemo(() => {
    const map = new Map<DayKey, string[]>();
    if (!today) return map;
    const mark = (day: DayKey, task: Task) => {
      const color = members.find((m) => m.id === task.assigneeId)?.color;
      const colors = map.get(day) ?? [];
      if (color && !colors.includes(color)) map.set(day, [...colors, color]);
    };
    for (const task of tasks) if (task.dueDate) mark(task.dueDate, task);
    for (const day of days) for (const task of tasks) if (isProjectedOn(task, day, today)) mark(day, task);
    return map;
  }, [tasks, days, today, members]);

  const select = (day: DayKey) => setSelection((s) => ({ day, previous: s.day ?? today }));
  const greeting = clock && clock.hour != null ? dict.today.greeting[periodFor(clock.hour)] : "";
  const dateLine = selected
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(selected))
    : "";

  // One line for the day, and only when it says something the empty card below doesn't: how much is waiting.
  const waiting = today ? tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today) : [];
  const overdue = today ? waiting.filter((t) => t.dueDate && t.dueDate < today).length : 0;
  const onDay = selected ? tasks.filter((t) => !t.completedAt && t.dueDate === selected).length : 0;
  const eventsOnDay = selected ? events.filter((e) => e.date === selected).length : 0;
  const countLine = (one: string, many: string, count: number) => (count === 1 ? one : format(many, { count }));
  const status =
    selected && selected !== today
      ? [onDay > 0 && countLine(dict.today.dayTasksOne, dict.today.dayTasks, onDay), eventsOnDay > 0 && countLine(dict.today.dayEventsOne, dict.today.dayEvents, eventsOnDay)]
          .filter(Boolean)
          .join(" · ")
      : waiting.length > 0
        ? waiting.length === 1
          ? dict.today.summary.one
          : format(dict.today.summary.many, { count: waiting.length })
        : "";
  const toBuy = shopping.filter((item) => !item.checkedAt).length;

  return (
    <div className="flex flex-col gap-5 pt-4 md:pt-8">
      {/* Greeting, people and week read as one block: who's home and which day, before the day itself. */}
      <div className="flex flex-col gap-3">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-balance text-[clamp(1.625rem,7.4vw,2rem)] font-bold leading-[1.12] tracking-tight [overflow-wrap:anywhere]">
              <bdi>{currentUser ? `${greeting}, ${firstName(currentUser.name)}` : greeting || "\u00a0"}</bdi>
            </h1>
            <p className="mt-1 text-[15px] capitalize text-label-secondary">{dateLine || "\u00a0"}</p>
            {status && (
              <p className="mt-0.5 text-[15px] text-label-secondary">
                {status}
                {selected === today && overdue > 0 && (
                  <span className="text-danger">
                    {" · "}
                    {overdue === 1 ? dict.today.tileOverdueOne : format(dict.today.tileOverdue, { count: overdue })}
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="mt-1 shrink-0">
            <ActivityBell />
          </div>
        </header>
        {members.length > 0 && <HouseholdMembers members={members} self={currentUser?.id ?? ""} tasks={tasks} today={today} />}
        {today && selected ? (
          <DateStrip
            compact
            from={days[0]}
            to={days[days.length - 1]}
            today={today}
            selected={selected}
            markers={markers}
            onSelect={select}
          />
        ) : (
          <div aria-hidden className="h-16" />
        )}
      </div>
      {toBuy > 0 && (
        <Link
          href={`/${locale}/shopping`}
          className="flex min-h-[3.25rem] touch-manipulation select-none items-center gap-3 rounded-card bg-surface px-3.5 shadow-card transition-transform duration-150 ease-out active:scale-[0.98]"
        >
          <IconTile icon={ShoppingBasket} color="var(--orange)" />
          <span className="min-w-0 flex-1 truncate text-[17px]">
            {toBuy === 1 ? dict.today.shoppingOne : format(dict.today.shoppingLeft, { count: toBuy })}
          </span>
          <ChevronRight aria-hidden size={18} strokeWidth={2.25} className="shrink-0 text-label-tertiary rtl:-scale-x-100" />
        </Link>
      )}
      {today && selected ? (
        <DayTasks
          day={selected}
          previousDay={selection.previous ?? selected}
          today={today}
          tasks={tasks}
          events={events}
          members={members}
          onToggle={(task) => toggleTask(task, today)}
        />
      ) : (
          <div aria-hidden className="h-[164px]" />
        )}
    </div>
  );
}
