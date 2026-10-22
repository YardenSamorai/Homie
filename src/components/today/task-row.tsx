"use client";

import { motion } from "motion/react";
import { Repeat } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle } from "@/components/ui/check-circle";
import { StrikeText } from "@/components/ui/strike-text";
import { SyncCaption, SyncRetry } from "@/components/ui/sync-note";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { completionHaptic } from "@/lib/haptics";
import { spring } from "@/lib/motion";
import type { Member, Task } from "@/lib/tasks";

export type RowKind = "open" | "overdue" | "done" | "projected";

export function TaskRow({
  task,
  assignee,
  kind,
  caption,
  showAssignee = true,
  onToggle,
  onOpen,
}: {
  task: Task;
  assignee: Member | undefined;
  kind: RowKind;
  caption?: string;
  /** Off in a home of one, where every task is yours. */
  showAssignee?: boolean;
  onToggle: (task: Task) => void;
  onOpen?: (task: Task) => void;
}) {
  const { dict } = useI18n();
  const done = kind === "done";
  const projected = kind === "projected";
  const color = assignee?.color ?? "var(--accent)";
  const meta = [
    caption ? { text: caption } : null,
    projected ? { text: dict.today.projected } : null,
    task.recurrence !== "none" ? { text: dict.today.recurrence[task.recurrence], repeat: true } : null,
  ].filter(Boolean) as { text: string; repeat?: boolean }[];

  const body = (
    <>
      <StrikeText done={done}>{task.title}</StrikeText>
      {meta.length > 0 && (
        <span className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-[13px] text-label-secondary">
          {meta.map((item, index) => (
            <span key={item.text} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <span aria-hidden className="text-label-tertiary">·</span>}
              <span className="flex min-w-0 items-center gap-1">
                {item.repeat && <Repeat aria-hidden size={11} strokeWidth={2.25} />}
                <span>{item.text}</span>
              </span>
            </span>
          ))}
        </span>
      )}
      <SyncCaption id={task.id} />
    </>
  );

  return (
    <div
      className={`flex min-h-[56px] items-center gap-3 py-2.5 ps-4 pe-3.5 transition-opacity duration-200 ${projected ? "opacity-55" : ""} ${done ? "opacity-75" : ""}`}
    >
      {projected ? (
        <span aria-hidden className="flex size-[26px] shrink-0 items-center justify-center">
          <span className="size-[24px] rounded-full border-[1.5px] border-dashed border-label-tertiary" />
        </span>
      ) : (
        <motion.button
          type="button"
          onClick={() => {
            if (!done) completionHaptic();
            onToggle(task);
          }}
          whileTap={{ scale: 0.88 }}
          transition={spring.snappy}
          aria-label={format(done ? dict.today.markUndone : dict.today.markDone, { title: task.title })}
          aria-pressed={done}
          className="-m-[9px] flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <CheckCircle checked={done} color={color} />
        </motion.button>
      )}

      {onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(task)}
          aria-label={format(dict.add.editNamed, { title: task.title })}
          className="flex min-w-0 flex-1 touch-manipulation select-none flex-col text-start"
        >
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col">{body}</div>
      )}

      <SyncRetry id={task.id} label={task.title} />
      {assignee && showAssignee && (
        <span title={format(dict.today.assignedTo, { name: assignee.name })} className="shrink-0 rounded-full">
          <span className="sr-only">{format(dict.today.assignedTo, { name: assignee.name })}</span>
          <Avatar member={assignee} size={24} />
        </span>
      )}
    </div>
  );
}
