import { format } from "@/i18n/format";

export const activityKinds = ["task_added", "task_done", "shopping_added", "shopping_bought", "event_added", "story_added"] as const;
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

/** One line, the same in the bell and in the notification: "New task: Fix the shelf". */
export function activityLine(kinds: Record<ActivityKind, string> & { story_plain: string }, kind: ActivityKind, title: string) {
  if (kind === "story_added" && title === storyWithoutCaption) return kinds.story_plain;
  return format(kinds[kind], { title });
}
