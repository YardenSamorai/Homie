"use client";

import { useState } from "react";
import { ListChecks, Plus, Search, SearchX, X } from "lucide-react";
import { PageStage } from "@/components/shell/page-stage";
import { TaskTemplates } from "@/components/tasks/task-templates";
import { TaskRow, type RowKind } from "@/components/today/task-row";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { fromDayKey } from "@/lib/dates";
import { useAddSheet, useHousehold } from "@/lib/household-store";
import { usePrefs } from "@/lib/prefs-store";
import type { Task } from "@/lib/tasks";
import { useClock } from "@/lib/use-clock";

type Scope = "mine" | "all" | "done";

const separator =
  "relative after:absolute after:inset-x-0 after:bottom-0 after:ms-[60px] after:h-px after:bg-separator last:after:hidden";

const byDue = (a: Task, b: Task) => ((a.dueDate ?? "9999") < (b.dueDate ?? "9999") ? -1 : 1);

/**
 * The home's tasks: a title that says how much is open, the stage with what's next, then the list, narrowed
 * to mine, the whole home, or what's done, and by a search.
 */
export function TasksView() {
  const { locale, dict } = useI18n();
  const today = useClock()?.today ?? null;
  const { tasks, members, currentUserId, toggleTask, addTask } = useHousehold();
  const show = useAddSheet((s) => s.show);
  const showEdit = useAddSheet((s) => s.showEdit);
  const newTask = usePrefs((s) => s.prefs.newTask);
  const [scope, setScope] = useState<Scope>("mine");
  const [query, setQuery] = useState("");
  const copy = dict.tasks;

  if (!today) {
    return (
      <>
        <PageHeader title={copy.title} />
        <div aria-hidden className="h-[420px]" />
      </>
    );
  }

  const shortDate = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short" });
  const open = tasks.filter((t) => !t.completedAt).sort(byDue);
  const done = tasks
    .filter((t) => t.completedAt)
    .sort((a, b) => ((a.completedAt ?? "") > (b.completedAt ?? "") ? -1 : 1));
  const scoped = scope === "done" ? done : open.filter((t) => scope === "all" || t.assigneeId === currentUserId);
  const needle = query.trim().toLocaleLowerCase(locale);
  const visible = needle ? scoped.filter((t) => t.title.toLocaleLowerCase(locale).includes(needle)) : scoped;

  const title =
    scope === "done"
      ? done.length === 0
        ? copy.titleDoneNone
        : done.length === 1
          ? copy.titleDoneOne
          : format(copy.titleDone, { count: done.length })
      : scoped.length === 0
        ? copy.titleQuiet
        : scoped.length === 1
          ? copy.titleOpenOne
          : format(copy.titleOpen, { count: scoped.length });

  // What the open ones add up to, for the scope at hand (the whole home when looking at what's done).
  const pending = scope === "mine" ? scoped : open;
  const overdue = pending.filter((t) => t.dueDate && t.dueDate < today).length;
  const dueToday = pending.filter((t) => t.dueDate === today).length;
  const eyebrow = [
    overdue > 0 && (
      <span key="overdue" className="text-danger">
        {overdue === 1 ? copy.metaOverdueOne : format(copy.metaOverdue, { count: overdue })}
      </span>
    ),
    dueToday > 0 && <span key="today">{dueToday === 1 ? copy.metaTodayOne : format(copy.metaToday, { count: dueToday })}</span>,
  ].filter(Boolean);

  const groups: { key: string; title: string | null; tasks: Task[] }[] =
    scope === "done"
      ? [{ key: "done", title: null, tasks: visible }]
      : [
          { key: "overdue", title: dict.today.overdue, tasks: visible.filter((t) => t.dueDate && t.dueDate < today) },
          { key: "today", title: copy.today, tasks: visible.filter((t) => t.dueDate === today) },
          { key: "upcoming", title: copy.upcoming, tasks: visible.filter((t) => t.dueDate && t.dueDate > today) },
          { key: "someday", title: copy.noDate, tasks: visible.filter((t) => !t.dueDate) },
        ];
  const shown = groups.filter((g) => g.tasks.length > 0);

  const kindOf = (task: Task, group: string): RowKind => (task.completedAt ? "done" : group === "overdue" ? "overdue" : "open");
  const captionOf = (task: Task, group: string) =>
    task.dueDate && group !== "today" ? shortDate.format(fromDayKey(task.dueDate)) : undefined;
  const whenOf = (task: Task) =>
    !task.dueDate ? null : task.dueDate < today ? dict.today.overdue : task.dueDate === today ? copy.today : shortDate.format(fromDayKey(task.dueDate));
  const defaultAssignee = () => {
    const partner = members.find((member) => member.id !== currentUserId);
    return newTask.assignee === "partner" && partner ? partner.id : currentUserId;
  };

  return (
    <>
      <PageHeader
        eyebrow={eyebrow.length > 0 ? <span className="flex gap-1.5">{eyebrow.flatMap((part, i) => (i ? [<span key={`dot-${i}`}>·</span>, part] : [part]))}</span> : undefined}
        title={title}
      />
      <div className="flex flex-col gap-5">
        {/* The stage shows what's next: overdue first, then today, then later, then whenever. */}
        <PageStage
          icon={ListChecks}
          tint={["#8f93c9", "#565c9c"]}
          count={open.length}
          chips={open.map((task) => {
            const assignee = members.find((m) => m.id === task.assigneeId);
            const note = [assignee ? assignee.name.trim().split(/\s+/)[0] : null, whenOf(task)].filter(Boolean).join(" · ");
            return {
              id: task.id,
              title: task.title,
              note: note || null,
              visual: (
                <span className="flex size-8 shrink-0 items-center justify-center">
                  <span className="size-[22px] rounded-full border-2" style={{ borderColor: assignee?.color ?? "var(--accent)" }} />
                </span>
              ),
            };
          })}
        />

        <div className="flex items-center gap-3">
          <TaskTemplates
            today={today}
            openTitles={new Set(open.map((t) => t.title))}
            onPick={(task) => addTask({ ...task, assigneeId: defaultAssignee() })}
          />
          <button
            type="button"
            onClick={() => show("task", today)}
            className="flex min-h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-accent px-5 text-[16px] font-semibold text-accent-contrast shadow-[0_8px_20px_-6px_color-mix(in_oklab,var(--accent)_55%,transparent),inset_0_1px_0_rgb(255_255_255/0.24)] transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <Plus aria-hidden size={19} strokeWidth={2.5} />
            <span className="truncate">{copy.newTask}</span>
          </button>
        </div>

        <label className="flex h-12 items-center gap-2 rounded-[14px] bg-fill ps-3.5 pe-1.5 text-label-secondary focus-within:ring-2 focus-within:ring-accent/40">
          <Search aria-hidden size={18} strokeWidth={2.25} className="shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.search}
            aria-label={copy.search}
            enterKeyHint="search"
            dir="auto"
            className="h-full min-w-0 flex-1 bg-transparent text-[17px] text-label outline-none placeholder:text-label-tertiary [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={dict.add.cancel}
              className="flex size-9 shrink-0 items-center justify-center rounded-full active:bg-fill"
            >
              <span className="flex size-[18px] items-center justify-center rounded-full bg-label-tertiary text-bg">
                <X aria-hidden size={12} strokeWidth={3} />
              </span>
            </button>
          )}
        </label>

        <SegmentedControl
          label={copy.title}
          value={scope}
          onChange={setScope}
          options={(["mine", "all", "done"] as const).map((value) => ({ value, label: copy.scopes[value] }))}
        />

        {shown.length === 0 ? (
          <div className="flex flex-col items-center rounded-card bg-surface pb-8 shadow-card">
            {needle ? (
              <EmptyState icon={SearchX} tint="var(--label-secondary)" title={copy.noMatch} hint={format(copy.noMatchHint, { query: query.trim() })} />
            ) : (
              <>
                <EmptyState
                  icon={ListChecks}
                  tint="var(--accent)"
                  title={scope === "done" ? copy.titleDoneNone : copy.titleQuiet}
                  hint={scope === "done" ? copy.emptyDone : copy.emptyView}
                />
                {scope !== "done" && (
                  <button
                    type="button"
                    onClick={() => show("task", today)}
                    className="-mt-4 flex min-h-11 items-center gap-1.5 rounded-full bg-accent ps-4 pe-5 text-[15px] font-semibold text-accent-contrast shadow-[0_6px_16px_-4px_color-mix(in_oklab,var(--accent)_50%,transparent)] transition-transform duration-150 ease-out active:scale-[0.97]"
                  >
                    <Plus aria-hidden size={17} strokeWidth={2.5} />
                    {copy.addTask}
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          shown.map((group) => (
            <section key={group.key} className="flex flex-col gap-2">
              {group.title && (
                <h2
                  className={`section-label flex items-baseline gap-1.5 px-1 ${group.key === "overdue" ? "text-danger" : "text-label-secondary"}`}
                >
                  {group.title}
                  <span className="font-medium tabular-nums text-label-tertiary">{group.tasks.length}</span>
                </h2>
              )}
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
      </div>
    </>
  );
}
