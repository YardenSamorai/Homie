"use client";

import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { TaskRow, type RowKind } from "@/components/today/task-row";
import { useI18n } from "@/i18n/dictionary-provider";
import { fromDayKey } from "@/lib/dates";
import { useAddSheet, useHousehold } from "@/lib/household-store";
import type { Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";

type Scope = "all" | "mine";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-[60px] after:h-px after:bg-separator last:after:hidden";

export function TasksView() {
  const { locale, dict } = useI18n();
  const today = useClock()?.today ?? null;
  const { tasks, members, currentUserId, toggleTask, addTask } = useHousehold();
  const showEdit = useAddSheet((s) => s.showEdit);
  const [scope, setScope] = useState<Scope>("all");
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const shortDate = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });

  const add = (event: React.FormEvent) => {
    event.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    addTask({ title: clean, assigneeId: currentUserId, dueDate: today, recurrence: "none" });
    setTitle("");
  };

  const field = (
    <form onSubmit={add} className="flex items-center gap-1 rounded-card bg-surface px-1.5 shadow-card">
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder={dict.add.taskTitle}
        aria-label={dict.add.taskTitle}
        enterKeyHint="done"
        maxLength={120}
        className="h-14 min-w-0 flex-1 bg-transparent ps-2.5 text-[17px] outline-none placeholder:text-label-tertiary"
      />
      <button
        type="submit"
        disabled={!title.trim()}
        aria-label={dict.add.submit}
        className="flex size-11 shrink-0 items-center justify-center rounded-full transition-transform duration-100 ease-[var(--ease-out-strong)] active:scale-[0.97] disabled:opacity-35"
      >
        <span className="flex size-[26px] items-center justify-center rounded-full bg-green text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.28)]">
          <Plus size={18} strokeWidth={2.75} />
        </span>
      </button>
    </form>
  );

  const control = (
    <SegmentedControl
      label={dict.tasks.title}
      value={scope}
      onChange={setScope}
      options={[
        { value: "all", label: dict.tasks.all },
        { value: "mine", label: dict.tasks.mine },
      ]}
    />
  );

  if (!today) {
    return (
      <div className="flex flex-col gap-6">
        {field}
        {control}
      </div>
    );
  }

  const visible = tasks
    .filter((t) => scope === "all" || t.assigneeId === currentUserId)
    .filter((t) => showDone || !t.completedAt)
    .sort((a, b) => (a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1);

  const groups: { key: string; title: string; tasks: Task[] }[] = [
    { key: "overdue", title: dict.today.overdue, tasks: visible.filter((t) => t.dueDate && t.dueDate < today && !t.completedAt) },
    { key: "today", title: dict.tasks.today, tasks: visible.filter((t) => t.dueDate === today) },
    { key: "upcoming", title: dict.tasks.upcoming, tasks: visible.filter((t) => t.dueDate && t.dueDate > today) },
    { key: "someday", title: dict.tasks.noDate, tasks: visible.filter((t) => !t.dueDate) },
    { key: "earlier", title: dict.tasks.earlier, tasks: visible.filter((t) => t.dueDate && t.dueDate < today && t.completedAt) },
  ].filter((g) => g.tasks.length > 0);

  const kindOf = (task: Task, group: string): RowKind => (task.completedAt ? "done" : group === "overdue" ? "overdue" : "open");
  const captionOf = (task: Task, group: string) =>
    task.dueDate && group !== "today" ? shortDate.format(fromDayKey(task.dueDate)) : undefined;
  const doneCount = tasks.filter((t) => t.completedAt && (scope === "all" || t.assigneeId === currentUserId)).length;

  return (
    <div className="flex flex-col gap-6">
      {field}
      {control}
      {groups.length === 0 ? (
        <div className="rounded-card bg-surface shadow-card">
          <EmptyState icon={ListChecks} title={dict.tasks.empty} hint={dict.tasks.emptyHint} />
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="flex flex-col gap-2">
            <h2
              className={`section-label flex items-baseline gap-1.5 px-1 ${
                group.key === "overdue" ? "text-danger" : "text-label-secondary"
              }`}
            >
              {group.title}
              <span className="font-medium tabular-nums text-label-tertiary">{group.tasks.length}</span>
            </h2>
            <ul className="overflow-hidden rounded-card bg-surface shadow-card">
              {group.tasks.map((task) => (
                <li key={task.id} className={separator}>
                  <TaskRow
                    task={task}
                    kind={kindOf(task, group.key)}
                    caption={captionOf(task, group.key)}
                    assignee={members.find((m) => m.id === task.assigneeId)}
                    onToggle={(t) => toggleTask(t, today)}
                    onOpen={(next) => showEdit({ kind: "task", id: next.id })}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      {doneCount > 0 && (
        <button
          type="button"
          onClick={() => setShowDone((v) => !v)}
          className="min-h-11 self-center rounded-full px-4 text-[15px] font-medium text-accent transition-opacity active:opacity-60"
        >
          {showDone ? dict.tasks.hideDone : `${dict.tasks.showDone} (${doneCount})`}
        </button>
      )}
    </div>
  );
}
