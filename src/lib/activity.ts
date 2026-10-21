import { format } from "@/i18n/format";

export const activityKinds = [
  "task_added",
  "task_assigned",
  "task_done",
  "shopping_added",
  "shopping_bought",
  "event_added",
  "story_added",
] as const;
export type ActivityKind = (typeof activityKinds)[number];

export type ActivityItem = {
  id: string;
  actorId: string;
  kind: ActivityKind;
  subjectId: string | null;
  title: string;
  createdAt: string;
};

/** The title a status photo without a caption is logged with; the line then reads "New status photo". */
export const storyWithoutCaption = "📷";

export const isActivityKind = (value: unknown): value is ActivityKind =>
  typeof value === "string" && (activityKinds as readonly string[]).includes(value);

/** The screen a bell row or a notification opens. */
export function activityPath(locale: string, kind: ActivityKind) {
  if (kind.startsWith("task")) return `/${locale}/tasks`;
  if (kind.startsWith("shopping")) return `/${locale}/shopping`;
  if (kind === "story_added") return `/${locale}`;
  return `/${locale}/calendar`;
}

/**
 * One line, the same in the bell and in the notification: "New task: Fix the shelf".
 * A task given to the other parent reads "A task for you" to them, and a plain new task to whoever gave it.
 */
export function activityLine(
  kinds: Record<ActivityKind, string> & { story_plain: string },
  kind: ActivityKind,
  title: string,
  byViewer = false,
) {
  if (kind === "story_added" && title === storyWithoutCaption) return kinds.story_plain;
  if (kind === "task_assigned" && byViewer) return format(kinds.task_added, { title });
  return format(kinds[kind], { title });
}
