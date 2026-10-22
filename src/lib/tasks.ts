import { addDays, diffDays, toDayKey, type DayKey } from "./dates";

export type Recurrence = "none" | "daily" | "weekly";

export type Member = {
  id: string;
  name: string;
  color: string;
  /** Profile photo: where it's stored, and a short-lived link to show it. */
  photoPath?: string | null;
  photo?: string | null;
};

export type Task = {
  id: string;
  title: string;
  assigneeId: string;
  dueDate: DayKey | null;
  recurrence: Recurrence;
  spawnedFromId: string | null;
  editedAt: string | null;
  completedAt: string | null;
};

const stepDays: Record<Exclude<Recurrence, "none">, number> = { daily: 1, weekly: 7 };

/** SPEC §5.1: next = D + step × max(1, ⌈(T − D) / step⌉). */
export function nextOccurrence(due: DayKey, recurrence: Exclude<Recurrence, "none">, today: DayKey): DayKey {
  const step = stepDays[recurrence];
  const k = Math.max(1, Math.ceil(diffDays(today, due) / step));
  return addDays(due, step * k);
}

/**
 * A day's tasks as Home shows them. Today also gathers what's left over from earlier days, and counts as done
 * what was due today or finished today.
 */
export function tasksOfDay(tasks: Task[], day: DayKey, today: DayKey) {
  const isToday = day === today;
  const fromBefore = isToday ? tasks.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today) : [];
  const open = tasks.filter((t) => !t.completedAt && t.dueDate === day);
  const done = tasks.filter(
    (t) =>
      t.completedAt &&
      t.dueDate &&
      (t.dueDate === day || (isToday && t.dueDate < today && toDayKey(new Date(t.completedAt)) === today)),
  );
  return { fromBefore, open, done };
}

/** Open work due today or earlier, plus what this person already finished today. */
export function loadForMember(tasks: Task[], memberId: string, today: DayKey) {
  const open = tasks.filter((t) => t.assigneeId === memberId && !t.completedAt && t.dueDate && t.dueDate <= today);
  const doneToday = tasks.filter((t) => t.assigneeId === memberId && t.completedAt && t.dueDate === today);
  const total = open.length + doneToday.length;
  return {
    open: open.length,
    overdue: open.filter((t) => t.dueDate! < today).length,
    doneToday: doneToday.length,
    total,
    progress: total === 0 ? 1 : doneToday.length / total,
  };
}

/** Future occurrence preview for an open recurring task (SPEC §6.5). */
export function isProjectedOn(task: Task, day: DayKey, today: DayKey): boolean {
  if (task.recurrence === "none" || !task.dueDate || task.completedAt) return false;
  if (day <= task.dueDate || day < today) return false;
  return diffDays(day, task.dueDate) % stepDays[task.recurrence] === 0;
}

function isUntouched(task: Task) {
  return !task.editedAt && !task.completedAt;
}

/** SPEC §5.1–5.2: completing spawns at most one successor per occurrence. */
export function completeTask(tasks: Task[], id: string, today: DayKey, now: string, newId: string): Task[] {
  const task = tasks.find((t) => t.id === id);
  if (!task || task.completedAt) return tasks;

  const next = tasks.map((t) => (t.id === id ? { ...t, completedAt: now } : t));
  const hasSuccessor = tasks.some((t) => t.spawnedFromId === id);
  if (task.recurrence === "none" || !task.dueDate || hasSuccessor) return next;

  return [
    ...next,
    {
      ...task,
      id: newId,
      dueDate: nextOccurrence(task.dueDate, task.recurrence, today),
      spawnedFromId: id,
      editedAt: null,
      completedAt: null,
    },
  ];
}

/** SPEC §5.2: an untouched successor is removed; an edited or completed one is kept. */
export function uncompleteTask(tasks: Task[], id: string): Task[] {
  const successor = tasks.find((t) => t.spawnedFromId === id);
  return tasks
    .filter((t) => !(successor && t.id === successor.id && isUntouched(successor)))
    .map((t) => (t.id === id ? { ...t, completedAt: null } : t));
}
