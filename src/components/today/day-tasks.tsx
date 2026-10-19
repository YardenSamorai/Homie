"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { localeDirection } from "@/i18n/config";
import { diffDays, fromDayKey, type DayKey } from "@/lib/dates";
import { easeOut, spring } from "@/lib/motion";
import { isProjectedOn, type Member, type Task } from "@/lib/tasks";
import { EventRow } from "@/components/events/event-row";
import { sortEvents, type HouseEvent } from "@/lib/household";
import { TaskRow, type RowKind } from "./task-row";

type Row = { task: Task; kind: RowKind; caption?: string };

function Group({
  title,
  rows,
  day,
  members,
  onToggle,
}: {
  title?: string;
  rows: Row[];
  day: DayKey;
  members: Member[];
  onToggle: (task: Task) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <motion.section layout="position" transition={spring.gentle} className="flex flex-col gap-2">
      {title && (
        <h3 className="section-label px-1 text-label-secondary">{title}</h3>
      )}
      <ul className="overflow-hidden rounded-card bg-surface shadow-card">
        <AnimatePresence initial={false}>
          {rows.map(({ task, kind, caption }) => {
            const rowKey = kind === "projected" ? `${task.id}:projected` : task.id;
            return (
            <motion.li
              key={rowKey}
              layoutId={`${day}-${rowKey}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ layout: spring.gentle, opacity: { duration: 0.2, ease: easeOut } }}
              className="relative after:absolute after:inset-x-0 after:bottom-0 after:ms-[60px] after:h-px after:bg-separator last:after:hidden"
            >
              <TaskRow
                task={task}
                kind={kind}
                caption={caption}
                assignee={members.find((m) => m.id === task.assigneeId)}
                onToggle={onToggle}
              />
            </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </motion.section>
  );
}

export function DayTasks({
  day,
  previousDay,
  today,
  tasks,
  events,
  members,
  onToggle,
}: {
  day: DayKey;
  previousDay: DayKey;
  today: DayKey;
  tasks: Task[];
  events: HouseEvent[];
  members: Member[];
  onToggle: (task: Task) => void;
}) {
  const { locale, dict } = useI18n();
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const shortDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });

  const offset = diffDays(day, today);
  const heading =
    Math.abs(offset) <= 1
      ? relative.format(offset, "day").replace(/^\p{Ll}/u, (c) => c.toUpperCase())
      : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" }).format(fromDayKey(day));

  const overdue: Row[] =
    day === today
      ? tasks
          .filter((t) => !t.completedAt && t.dueDate && t.dueDate < today)
          .map((t) => ({ task: t, kind: "overdue", caption: shortDate.format(fromDayKey(t.dueDate!)) }))
      : [];
  // Completed tasks keep their place (checked and struck through) so the day reads as its own history.
  const ofDay: Row[] = tasks
    .filter((t) => t.dueDate === day)
    .map((t) => ({ task: t, kind: t.completedAt ? "done" : "open" }));
  const projected: Row[] = tasks.filter((t) => isProjectedOn(t, day, today)).map((t) => ({ task: t, kind: "projected" }));
  const dayEvents = events.filter((e) => e.date === day).sort(sortEvents);
  const isEmpty = overdue.length + ofDay.length + projected.length + dayEvents.length === 0;

  const forward = day >= previousDay ? 1 : -1;
  const shift = 16 * forward * (localeDirection[locale] === "rtl" ? -1 : 1);

  return (
    <section className="flex flex-col gap-3">
      <AnimatePresence mode="popLayout" initial={false} custom={shift}>
        <motion.div
          key={day}
          custom={shift}
          variants={{
            enter: (x: number) => ({ opacity: 0, transform: `translateX(${x}px)` }),
            center: { opacity: 1, transform: "translateX(0px)", transition: { duration: 0.22, ease: easeOut } },
            exit: (x: number) => ({ opacity: 0, transform: `translateX(${-x}px)`, transition: { duration: 0.14, ease: easeOut } }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          className="flex flex-col gap-5"
        >
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="text-xl font-semibold tracking-tight">{heading}</h2>
            {!isEmpty && (
              <p className="text-[13px] text-label-secondary">
                {[
                  ofDay.length + overdue.length > 0 &&
                    (ofDay.length + overdue.length === 1
                      ? dict.today.dayTasksOne
                      : format(dict.today.dayTasks, { count: ofDay.length + overdue.length })),
                  dayEvents.length > 0 &&
                    (dayEvents.length === 1
                      ? dict.today.dayEventsOne
                      : format(dict.today.dayEvents, { count: dayEvents.length })),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
          {isEmpty ? (
            <div className="rounded-card bg-surface shadow-card">
              <EmptyState icon={CalendarCheck} tint="var(--green)" title={dict.today.noTasksForDay} hint={dict.today.noTasksForDayHint} />
            </div>
          ) : (
            <LayoutGroup id={day}>
              {dayEvents.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h3 className="section-label px-1 text-label-secondary">
                    {dict.events.title}
                  </h3>
                  <ul className="overflow-hidden rounded-card bg-surface shadow-card">
                    {dayEvents.map((event) => (
                      <li
                        key={event.id}
                        className="relative after:absolute after:inset-x-0 after:bottom-0 after:ms-8 after:h-px after:bg-separator last:after:hidden"
                      >
                        <EventRow event={event} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              <Group title={overdue.length ? dict.today.overdue : undefined} rows={overdue} day={day} members={members} onToggle={onToggle} />
              <Group
                title={dayEvents.length > 0 || overdue.length > 0 ? dict.nav.tasks : undefined}
                rows={[...ofDay, ...projected]}
                day={day} members={members} onToggle={onToggle} />
            </LayoutGroup>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
