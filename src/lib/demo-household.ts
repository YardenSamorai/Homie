import { addDays, type DayKey } from "./dates";
import type { HouseEvent, ShoppingItem } from "./household";
import type { Member, Task } from "./tasks";

// Placeholder household until Supabase auth and data are wired in.

export const demoCurrentUserId = "yarden";

export const demoMembers: Member[] = [
  { id: "yarden", name: "ירדן", color: "var(--indigo)" },
  { id: "yana", name: "יאנה", color: "var(--pink)" },
];

export function demoTasks(today: DayKey): Task[] {
  const task = (id: string, title: string, assigneeId: string, offset: number, extra: Partial<Task> = {}): Task => ({
    id,
    title,
    assigneeId,
    dueDate: addDays(today, offset),
    recurrence: "none",
    spawnedFromId: null,
    editedAt: null,
    completedAt: null,
    ...extra,
  });

  return [
    task("t1", "להוציא את הזבל", "yarden", 0, { recurrence: "daily" }),
    task("t2", "לקבוע תור לרופא שיניים", "yana", 0),
    task("t3", "כביסה", "yarden", 0, { completedAt: "demo" }),
    task("t4", "להשקות את העציצים", "yana", -2, { recurrence: "weekly" }),
    task("t5", "לשלם חשבון חשמל", "yarden", -1),
    task("t6", "לנקות את המטבח", "yana", 1, { recurrence: "weekly" }),
    task("t7", "קניות לשבת", "yarden", 3),
    task("t8", "להחליף פילטר במזגן", "yarden", 6),
  ];
}

export function demoShopping(): ShoppingItem[] {
  const item = (id: string, name: string, addedBy: string, extra: Partial<ShoppingItem> = {}): ShoppingItem => ({
    id,
    name,
    note: null,
    addedBy,
    checkedAt: null,
    ...extra,
  });

  return [
    item("s1", "חלב", "yana", { note: "2 קרטונים" }),
    item("s2", "לחם", "yarden"),
    item("s3", "ביצים", "yana", { note: "12" }),
    item("s4", "עגבניות", "yarden"),
    item("s5", "קפה", "yarden", { checkedAt: "demo" }),
  ];
}

export function demoEvents(today: DayKey): HouseEvent[] {
  const event = (id: string, title: string, offset: number, time: string | null, prep: string | null): HouseEvent => ({
    id,
    title,
    date: addDays(today, offset),
    time,
    prep,
    createdBy: "yarden",
  });

  return [
    event("e1", "ארוחת ערב עם חברים", 0, "20:00", null),
    event("e2", "יום הולדת לסבתא", 2, "19:30", "לקנות מתנה ולהזמין עוגה"),
    event("e3", "אסיפת הורים", 5, "18:00", "להכין שאלות למורה"),
    event("e4", "טסט לרכב", 9, "08:30", "רישיון רכב וביטוח חובה"),
    event("e5", "חופשה באילת", 20, null, "להזמין חדר ולארוז"),
  ];
}
