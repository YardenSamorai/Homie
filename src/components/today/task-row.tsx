"use client";

import { motion } from "motion/react";
import { Repeat } from "lucide-react";
import { CheckCircle } from "@/components/ui/check-circle";
import { StrikeText } from "@/components/ui/strike-text";
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
  onToggle,
  onOpen,
}: {
  task: Task;
  assignee: Member | undefined;
  kind: RowKind;
  caption?: string;
  onToggle: (task: Task) => void;
  onOpen?: (task: Task) => void;
}) {
  const { dict } = useI18n();
  const done = kind === "done";
  const projected = kind === "projected";
  const color = assignee?.color ?? "var(--accent)";
  const meta = [
    caption ? { text: caption, danger: kind === "overdue" } : null,
    projected ? { text: dict.today.projected, danger: false } : null,
    task.recurrence !== "none" ? { text: dict.today.recurrence[task.recurrence], danger: false, repeat: true } : null,
  ].filter(Boolean) as { text: string; danger: boolean; repeat?: boolean }[];

  const body = (
    <>
      <StrikeText done={done}>{task.title}</StrikeText>
      {meta.length > 0 && (
        <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-label-secondary">
          {meta.map((item, index) => (
            <span key={item.text} className="flex min-w-0 items-center gap-1.5">
              {index > 0 && <span aria-hidden className="text-label-tertiary">·</span>}
              <span className={`flex min-w-0 items-center gap-1 ${item.danger ? "text-danger" : ""}`}>
                {item.repeat && <Repeat aria-hidden size={11} strokeWidth={2.25} />}
                <span className="truncate">{item.text}</span>
              </span>
            </span>
          ))}
        </span>
      )}
    </>
  );

  return (
    <div className={`flex min-h-[52px] items-center gap-3 px-4 py-2 ${projected ? "opacity-55" : ""} ${done ? "opacity-70" : ""}`}>
      {projected ? (
        <span aria-hidden className="flex size-11 shrink-0 items-center justify-center">
          <span className="size-[26px] rounded-full border-2 border-dashed border-label-tertiary" />
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

      {assignee && (
        <span
          title={format(dict.today.assignedTo, { name: assignee.name })}
          aria-label={format(dict.today.assignedTo, { name: assignee.name })}
          style={{ backgroundColor: color }}
          className="size-2.5 shrink-0 rounded-full"
        />
      )}
    </div>
  );
}
