"use client";

import { motion } from "motion/react";
import { Repeat } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle } from "@/components/ui/check-circle";
import { StrikeText } from "@/components/ui/strike-text";
import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { spring } from "@/lib/motion";
import type { Member, Task } from "@/lib/tasks";

export type RowKind = "open" | "overdue" | "done" | "projected";

export function TaskRow({
  task,
  assignee,
  kind,
  caption,
  onToggle,
}: {
  task: Task;
  assignee: Member | undefined;
  kind: RowKind;
  caption?: string;
  onToggle: (task: Task) => void;
}) {
  const { dict } = useI18n();
  const done = kind === "done";
  const projected = kind === "projected";
  const color = assignee?.color ?? "var(--accent)";

  return (
    <div className={`flex min-h-14 items-center gap-3 px-4 py-2.5 ${projected ? "opacity-55" : ""}`}>
      {projected ? (
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center">
          <span className="size-[26px] rounded-full border-2 border-dashed border-label-tertiary" />
        </span>
      ) : (
        <motion.button
          type="button"
          onClick={() => onToggle(task)}
          whileTap={{ scale: 0.88 }}
          transition={spring.snappy}
          aria-label={format(done ? dict.today.markUndone : dict.today.markDone, { title: task.title })}
          aria-pressed={done}
          className="-m-[9px] flex size-11 shrink-0 items-center justify-center rounded-full"
        >
          <CheckCircle checked={done} color={color} />
        </motion.button>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <StrikeText done={done}>{task.title}</StrikeText>
        {(caption || task.recurrence !== "none" || projected) && (
          <span className="flex items-center gap-1.5 text-[13px] text-label-secondary">
            {caption && <span className={kind === "overdue" ? "text-danger" : undefined}>{caption}</span>}
            {projected && <span>{dict.today.projected}</span>}
            {task.recurrence !== "none" && (
              <span className="flex items-center gap-1">
                <Repeat aria-hidden size={12} />
                {dict.today.recurrence[task.recurrence]}
              </span>
            )}
          </span>
        )}
      </div>

      {assignee && (
        <span title={format(dict.today.assignedTo, { name: assignee.name })} className="flex">
          <Avatar member={assignee} size={26} />
          <span className="sr-only">{format(dict.today.assignedTo, { name: assignee.name })}</span>
        </span>
      )}
    </div>
  );
}
