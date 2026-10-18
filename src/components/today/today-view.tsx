"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, dayRange, type DayKey } from "@/lib/dates";
import { useHousehold, useSelectedDay } from "@/lib/household-store";
import { isProjectedOn, type Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";
import { DateStrip } from "./date-strip";
import { DayTasks } from "./day-tasks";
import { Hero } from "./hero";
import { HouseholdMembers } from "./household-members";

const DAYS_BACK = 30;
const DAYS_AHEAD = 90;

export function TodayView() {
  const clock = useClock();
  const today = clock?.today ?? null;
  const { seeded, members, tasks, events, toggleTask } = useHousehold();
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

  return (
    <div className="flex flex-col gap-8">
      <Hero name={currentUser.name} today={today} hour={clock?.hour ?? null} openCount={openToday} />
      <HouseholdMembers members={members} />
      {today && selected && seeded ? (
        <>
          <DateStrip
            from={days[0]}
            to={days[days.length - 1]}
            today={today}
            selected={selected}
            markers={markers}
            onSelect={select}
          />
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
