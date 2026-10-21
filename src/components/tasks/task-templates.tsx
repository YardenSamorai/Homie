"use client";

import { LayoutTemplate, Repeat } from "lucide-react";
import { PickMenu } from "@/components/ui/pick-menu";
import { useI18n } from "@/i18n/dictionary-provider";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { DayKey } from "@/lib/dates";
import type { Recurrence } from "@/lib/tasks";

type Template = { key: keyof Dictionary["tasks"]["templates"]; recurrence: Exclude<Recurrence, "none"> };

const templates: Template[] = [
  { key: "trash", recurrence: "daily" },
  { key: "dishes", recurrence: "daily" },
  { key: "laundry", recurrence: "weekly" },
  { key: "vacuum", recurrence: "weekly" },
  { key: "floors", recurrence: "weekly" },
  { key: "bathroom", recurrence: "weekly" },
  { key: "sheets", recurrence: "weekly" },
  { key: "plants", recurrence: "weekly" },
  { key: "fridge", recurrence: "weekly" },
];

/** The chores every home repeats, one tap each: added from today and repeating. */
export function TaskTemplates({
  today,
  openTitles,
  onPick,
}: {
  today: DayKey;
  openTitles: Set<string>;
  onPick: (task: { title: string; dueDate: DayKey; recurrence: Recurrence }) => void;
}) {
  const { dict } = useI18n();
  const copy = dict.tasks;

  return (
    <PickMenu
      label={copy.template}
      icon={LayoutTemplate}
      heading={copy.templateTitle}
      addedLabel={copy.templateAdded}
      items={templates.map(({ key, recurrence }) => ({
        id: key,
        label: copy.templates[key],
        added: openTitles.has(copy.templates[key]),
        meta: (
          <>
            <Repeat aria-hidden size={13} strokeWidth={2.25} />
            {dict.today.recurrence[recurrence]}
          </>
        ),
      }))}
      onPick={(id) => {
        const template = templates.find((t) => t.key === id);
        if (template) onPick({ title: copy.templates[template.key], dueDate: today, recurrence: template.recurrence });
      }}
    />
  );
}
