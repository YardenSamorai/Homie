"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, Plus } from "lucide-react";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { localeDirection } from "@/i18n/config";
import { diffDays, type DayKey } from "@/lib/dates";
import { easeOut } from "@/lib/motion";
import { isProjectedOn, tasksOfDay, type Member, type Task } from "@/lib/tasks";
import { useAddSheet } from "@/lib/household-store";
import { WaitingRow } from "./later-today";
import { TaskRow, type RowKind } from "./task-row";

type Row = { task: Task; kind: RowKind; caption?: string };

/** How long a finished task stays where it was, checked and struck through, before it folds away. */
const SETTLE_MS = 900;
const DAY_LIMIT = 6;

const rowRule =
  "relative after:absolute after:inset-x-0 after:top-0 after:ms-[54px] after:h-px after:bg-separator first:after:hidden";

const addRule = "relative after:absolute after:inset-x-0 after:top-0 after:ms-[54px] after:h-px after:bg-separator";

const byDue = (a: Task, b: Task) => ((a.dueDate ?? "") < (b.dueDate ?? "") ? -1 : 1);

function Rows({
  rows,
  members,
  showAssignee,
  onToggle,
}: {
  rows: Row[];
  members: Member[];
  showAssignee: boolean;
  onToggle: (task: Task) => void;
}) {
  const showEdit = useAddSheet((s) => s.showEdit);
  return (
    <ul>
      <AnimatePresence initial={false}>
        {rows.map(({ task, kind, caption }) => (
          <motion.li
            key={kind === "projected" ? `${task.id}:projected` : task.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: easeOut }}
            className={`${rowRule} overflow-hidden`}
          >
            <TaskRow
              task={task}
              kind={kind}
              caption={caption}
              showAssignee={showAssignee}
              assignee={members.find((m) => m.id === task.assigneeId)}
              onToggle={onToggle}
              onOpen={kind === "projected" ? undefined : (next) => showEdit({ kind: "task", id: next.id })}
            />
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function MoreButton({ shown, total, open, onToggle }: { shown: number; total: number; open: boolean; onToggle: () => void }) {
  const { dict } = useI18n();
  if (total <= shown && !open) return null;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={`${rowRule} flex min-h-12 w-full items-center ps-[54px] pe-4 text-[15px] font-medium text-accent transition-colors duration-150 active:bg-fill`}
    >
      {open ? dict.today.showLess : format(dict.today.showAll, { count: total })}
    </button>
  );
}

const card = "overflow-hidden rounded-card bg-surface shadow-card ring-1 ring-hairline";

/**
 * The day's tasks: what's left over from earlier days first, then the day's own, then what's done, folded.
 * A task ticked off here stays put for a moment, so the tick is seen, then leaves for the done group.
 */
export function DayTasks({
  day,
  previousDay,
  today,
  tasks,
  members,
  onToggle,
}: {
  day: DayKey;
  previousDay: DayKey;
  today: DayKey;
  tasks: Task[];
  members: Member[];
  onToggle: (task: Task) => void;
}) {
  const { locale, dict } = useI18n();
  const show = useAddSheet((s) => s.show);
  const [settling, setSettling] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<{ attention: boolean; day: boolean; done: boolean }>({
    attention: false,
    day: false,
    done: false,
  });
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((timer) => window.clearTimeout(timer)), []);

  const toggle = (task: Task) => {
    if (!task.completedAt) {
      setSettling((current) => new Set(current).add(task.id));
      timers.current.push(
        window.setTimeout(() => {
          setSettling((current) => {
            const next = new Set(current);
            next.delete(task.id);
            return next;
          });
        }, SETTLE_MS),
      );
    }
    onToggle(task);
  };

  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const { fromBefore, done } = tasksOfDay(tasks, day, today);
  const justDone = done.filter((t) => settling.has(t.id));

  const attention: Row[] = [...fromBefore, ...justDone.filter((t) => t.dueDate !== day)]
    .sort(byDue)
    .map((task): Row => ({
      task,
      kind: task.completedAt ? "done" : "overdue",
      caption: relative.format(-diffDays(today, task.dueDate!), "day"),
    }));
  const ofDay: Row[] = [
    ...tasks
      .filter((t) => t.dueDate === day && (!t.completedAt || settling.has(t.id)))
      .map((task): Row => ({ task, kind: task.completedAt ? "done" : "open" })),
    ...tasks.filter((t) => isProjectedOn(t, day, today)).map((task): Row => ({ task, kind: "projected" })),
  ];
  const finished: Row[] = done
    .filter((t) => !settling.has(t.id))
    .sort((a, b) => ((a.completedAt ?? "") > (b.completedAt ?? "") ? -1 : 1))
    .map((task): Row => ({ task, kind: "done" }));

  const dayShown = expanded.day ? ofDay : ofDay.slice(0, DAY_LIMIT);
  const showAssignee = members.length > 1;

  const forward = day >= previousDay ? 1 : -1;
  const shift = 16 * forward * (localeDirection[locale] === "rtl" ? -1 : 1);

  return (
    <section aria-label={dict.nav.tasks}>
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
          className="flex flex-col gap-6"
        >
          <div className={card}>
              <Rows rows={dayShown} members={members} showAssignee={showAssignee} onToggle={toggle} />
              <MoreButton
                shown={DAY_LIMIT}
                total={ofDay.length}
                open={expanded.day}
                onToggle={() => setExpanded((e) => ({ ...e, day: !e.day }))}
              />
              <button
                type="button"
                onClick={() => show("task", day)}
                className={`${dayShown.length > 0 ? addRule : ""} flex min-h-[52px] w-full items-center gap-3 px-4 text-start text-[17px] text-accent transition-colors duration-150 active:bg-fill`}
              >
                <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center rounded-full bg-accent text-accent-contrast">
                  <Plus size={16} strokeWidth={2.75} />
                </span>
                {dict.tasks.newTask}
              </button>
            </div>

          {fromBefore.length > 0 && (
            <div className="flex flex-col gap-2">
              <WaitingRow
                count={fromBefore.length}
                open={expanded.attention}
                onToggle={() => setExpanded((e) => ({ ...e, attention: !e.attention }))}
              />
              <AnimatePresence initial={false}>
                {expanded.attention && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: easeOut }}
                    className="overflow-hidden"
                  >
                    <div className={card}>
                      <Rows rows={attention} members={members} showAssignee={showAssignee} onToggle={toggle} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {finished.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setExpanded((e) => ({ ...e, done: !e.done }))}
                aria-expanded={expanded.done}
                className="flex min-h-11 items-center gap-1.5 self-start rounded-full px-1 text-[15px] font-semibold text-label-secondary"
              >
                {dict.today.groupDone}
                <span className="text-[14px] font-medium tabular-nums text-label-tertiary">{finished.length}</span>
                <ChevronDown
                  aria-hidden
                  size={16}
                  strokeWidth={2.5}
                  className={`text-label-tertiary transition-transform duration-200 ease-[var(--ease-out-strong)] ${expanded.done ? "rotate-180" : ""}`}
                />
              </button>
              <AnimatePresence initial={false}>
                {expanded.done && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.24, ease: easeOut }}
                    className="-mx-4 -mb-6 overflow-hidden px-4 pb-6"
                  >
                    <div className={card}>
                      <Rows rows={finished} members={members} showAssignee={showAssignee} onToggle={toggle} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
}
