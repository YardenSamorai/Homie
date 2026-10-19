"use client";

import { useI18n } from "@/i18n/dictionary-provider";
import { format } from "@/i18n/format";
import { useHousehold } from "@/lib/household-store";
import { useClock } from "@/lib/use-clock";

export function TasksMeta() {
  const { dict } = useI18n();
  const today = useClock()?.today;
  const tasks = useHousehold((s) => s.tasks);
  if (!today) return null;

  const open = tasks.filter((t) => !t.completedAt);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today).length;
  const dueToday = open.filter((t) => t.dueDate === today).length;
  const rest = open.length - overdue - dueToday;

  const parts: string[] = [];
  if (overdue > 0) parts.push(overdue === 1 ? dict.tasks.metaOverdueOne : format(dict.tasks.metaOverdue, { count: overdue }));
  if (dueToday > 0) parts.push(dueToday === 1 ? dict.tasks.metaTodayOne : format(dict.tasks.metaToday, { count: dueToday }));
  if (rest > 0 && overdue === 0 && dueToday === 0) {
    parts.push(rest === 1 ? dict.tasks.metaOpenOne : format(dict.tasks.metaOpen, { count: rest }));
  }
  if (parts.length === 0) return <span>{dict.tasks.metaQuiet}</span>;

  return (
    <span>
      {overdue > 0 && <span className="text-danger">{parts[0]}</span>}
      {overdue > 0 && parts.length > 1 && " · "}
      {parts.slice(overdue > 0 ? 1 : 0).join(" · ")}
    </span>
  );
}
