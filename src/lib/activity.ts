import { format } from "@/i18n/format";

export const activityKinds = ["task_added", "task_done", "shopping_added", "shopping_bought", "event_added"] as const;
export type ActivityKind = (typeof activityKinds)[number];

export type ActivityItem = {
  id: string;
  actorId: string;
  kind: ActivityKind;
  subjectId: string | null;
  title: string;
  createdAt: string;
};

export const isActivityKind = (value: unknown): value is ActivityKind =>
  typeof value === "string" && (activityKinds as readonly string[]).includes(value);

/** The screen a bell row or a notification opens. */
export function activityPath(locale: string, kind: ActivityKind) {
  if (kind.startsWith("task")) return `/${locale}/tasks`;
  if (kind.startsWith("shopping")) return `/${locale}/shopping`;
  return `/${locale}/calendar`;
}

/** One line, the same in the bell and in the notification: "New task: Fix the shelf". */
export function activityLine(kinds: Record<ActivityKind, string>, kind: ActivityKind, title: string) {
  return format(kinds[kind], { title });
}
