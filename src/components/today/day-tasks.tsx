"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { CalendarCheck } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/i18n/dictionary-provider";
import { localeDirection } from "@/i18n/config";
import { diffDays, fromDayKey, type DayKey } from "@/lib/dates";
import { easeOut, spring } from "@/lib/motion";
import { isProjectedOn, type Member, type Task } from "@/lib/tasks";
import { EventRow } from "@/components/events/event-row";
import { sortEvents, type HouseEvent } from "@/lib/household";
import { TaskRow, type RowKind } from "./task-row";

type Row = { task: Task; kind: RowKind; caption?: string };

const rowRule =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-12 after:h-px after:bg-separator last:after:hidden";

function GroupLabel({ children, danger }: { children: string; danger?: boolean }) {
  return (
    <h3 className={`px-1 pb-1.5 text-[13px] font-semibold ${danger ? "text-danger" : "text-label-secondary"}`}>
      {children}
    </h3>
  );
}

function Inset({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[20px] bg-surface">{children}</div>;
}

function TaskItems({
  rows,
  day,
  members,
  onToggle,
}: {
  rows: Row[];
  day: DayKey;
  members: Member[];
  onToggle: (task: Task) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <ul>
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
              className={rowRule}
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
  const ofDay: Row[] = tasks
    .filter((t) => t.dueDate === day)
    .map((t) => ({ task: t, kind: t.completedAt ? "done" : "open" }));
  const projected: Row[] = tasks.filter((t) => isProjectedOn(t, day, today)).map((t) => ({ task: t, kind: "projected" }));
  const dayEvents = events.filter((e) => e.date === day).sort(sortEvents);
  const dayTasks = [...ofDay, ...projected];
  const isEmpty = overdue.length + dayTasks.length + dayEvents.length === 0;
  const mixed = [dayEvents.length > 0, overdue.length > 0, dayTasks.length > 0].filter(Boolean).length > 1;

  const forward = day >= previousDay ? 1 : -1;
  const shift = 16 * forward * (localeDirection[locale] === "rtl" ? -1 : 1);

  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <h2 className="px-1 text-[22px] font-semibold tracking-tight">{heading}</h2>
      <AnimatePresence mode="popLayout" initial={false} custom={shift}>
        <motion.div
          key={day}
          custom={shift}
          variants={{
            enter: (x: number) => ({ opacity: 0, transform: `translateX(${x}px)` }),
            center: { opacity: 1, transform: "translateX(0px)", transition: { duration: 0.22, ease: easeOut } },
            exit: (x: number) => ({
              opacity: 0,
              transform: `translateX(${-x}px)`,
              transition: { duration: 0.14, ease: easeOut },
            }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          className="flex flex-col gap-4"
        >
          {isEmpty ? (
            <Inset>
              <EmptyState icon={CalendarCheck} tint="var(--green)" title={dict.today.noTasksForDay} hint={dict.today.noTasksForDayHint} />
            </Inset>
          ) : (
            <LayoutGroup id={day}>
              {dayEvents.length > 0 && (
                <div>
                  {mixed && <GroupLabel>{dict.events.title}</GroupLabel>}
                  <Inset>
                    <ul>
                      {dayEvents.map((event) => (
                        <li key={event.id} className={rowRule}>
                          <EventRow event={event} />
                        </li>
                      ))}
                    </ul>
                  </Inset>
                </div>
              )}
              {overdue.length > 0 && (
                <div>
                  <GroupLabel danger>{dict.today.overdue}</GroupLabel>
                  <Inset>
                    <TaskItems rows={overdue} day={day} members={members} onToggle={onToggle} />
                  </Inset>
                </div>
              )}
              {dayTasks.length > 0 && (
                <div>
                  {mixed && <GroupLabel>{dict.nav.tasks}</GroupLabel>}
                  <Inset>
                    <TaskItems rows={dayTasks} day={day} members={members} onToggle={onToggle} />
                  </Inset>
                </div>
              )}
            </LayoutGroup>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
