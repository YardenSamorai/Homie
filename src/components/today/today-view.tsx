"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, fromDayKey, dayRange, type DayKey } from "@/lib/dates";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { periodFor } from "@/lib/period";
import { isProjectedOn, type Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { useI18n } from "@/i18n/dictionary-provider";
import { Avatar } from "@/components/ui/avatar";
import { DomainTiles } from "./briefing";
import { DateStrip } from "./date-strip";
import { DayTasks } from "./day-tasks";
import { HouseCard } from "./house-card";
import { HouseholdMembers } from "./household-members";

const DAYS_BACK = 30;
const DAYS_AHEAD = 90;

export function TodayView() {
  const { locale, dict } = useI18n();
  const clock = useClock();
  const today = clock?.today ?? null;
  const { members, tasks, events, toggleTask } = useHousehold();
  const setSharedDay = useSelectedDay((s) => s.setDay);
  const currentUser = members[0];

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

  const openToday = today ? tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today).length : 0;

  const select = (day: DayKey) => setSelection((s) => ({ day, previous: s.day ?? today }));
  const greeting = clock && clock.hour != null ? dict.today.greeting[periodFor(clock.hour)] : "";
  const dateLine = selected
    ? new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(selected))
    : "";

  return (
    <div className="flex flex-col gap-5 pt-4 md:pt-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[32px] font-bold leading-[1.1] tracking-tight">
            <bdi>{currentUser ? `${greeting}, ${currentUser.name}` : greeting || "\u00a0"}</bdi>
          </h1>
          <p className="mt-1 text-[15px] capitalize text-label-secondary">{dateLine || "\u00a0"}</p>
        </div>
        <Link href={`/${locale}/settings`} aria-label={dict.nav.settings} className="mt-1 shrink-0">
          {currentUser ? (
            <Avatar member={currentUser} size={44} />
          ) : (
            <span className="block size-11 rounded-full bg-sage-light" />
          )}
        </Link>
      </header>
      {members.length > 1 && <HouseholdMembers members={members} tasks={tasks} today={today} />}
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
      <HouseCard openCount={openToday} day={selected} />
      {today && <DomainTiles today={today} />}
      {today && selected ? (
          <>
            <DayTasks
              day={selected}
              previousDay={selection.previous ?? selected}
              today={today}
              tasks={tasks}
              events={events}
              members={members}
              onToggle={(task) => toggleTask(task, today)}
            />
          </>
        ) : (
          <div aria-hidden className="h-[164px]" />
        )}
    </div>
  );
}
