import { NextResponse } from "next/server";
import en from "@/i18n/dictionaries/en.json";
import he from "@/i18n/dictionaries/he.json";
import { format } from "@/i18n/format";
import { apnsKeys, sendApns } from "@/lib/push/apns";
import { createAdminSupabase } from "@/lib/supabase/admin";

const dictionaries = { he, en } as const;

type Task = { assignee_id: string; title: string; household_id: string };
type Event = { title: string; time: string | null; household_id: string };

/** Today's date in Israel, where the house is: the job runs at 05:00 UTC, already morning there. */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

function summary(locale: "he" | "en", tasks: Task[], events: Event[]) {
  const copy = dictionaries[locale].morning;
  const parts: string[] = [];
  if (tasks.length > 0) {
    const shown = tasks.slice(0, 2).map((task) => task.title);
    const list = tasks.length > 2 ? format(copy.more, { list: shown.join(", "), count: tasks.length - 2 }) : shown.join(", ");
    parts.push(tasks.length === 1 ? format(copy.oneTask, { list }) : format(copy.manyTasks, { count: tasks.length, list }));
  }
  if (events.length === 1) {
    const [event] = events;
    parts.push(format(copy.oneEvent, { title: event.time ? `${event.title} ${event.time.slice(0, 5)}` : event.title }));
  } else if (events.length > 1) {
    parts.push(format(copy.manyEvents, { count: events.length }));
  }
  return parts.join(copy.join);
}

/**
 * Once a morning (vercel.json): each parent with tasks due today or overdue, or an event today, hears about it.
 * The same pass clears status photos past their 24 hours, files and rows.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const db = createAdminSupabase();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 503 });

  const cleared = await clearExpiredStories(db);

  const keys = apnsKeys();
  if (!keys) return NextResponse.json({ cleared, sent: 0 });

  const { data: devices } = await db.from("push_devices").select("token, locale, user_id");
  if (!devices?.length) return NextResponse.json({ cleared, sent: 0 });
  const people = [...new Set(devices.map((device) => device.user_id as string))];
  const { data: memberships } = await db.from("household_members").select("user_id, household_id").in("user_id", people);
  const houseOf = new Map((memberships ?? []).map((row) => [row.user_id as string, row.household_id as string]));
  const houses = [...new Set(houseOf.values())];
  if (houses.length === 0) return NextResponse.json({ cleared, sent: 0 });

  const day = today();
  const [{ data: tasks }, { data: events }] = await Promise.all([
    db.from("tasks").select("assignee_id, title, household_id").in("household_id", houses).is("completed_at", null).is("deleted_at", null).lte("due_date", day),
    db.from("events").select("title, time, household_id").in("household_id", houses).eq("date", day).is("deleted_at", null).order("time"),
  ]);

  let sent = 0;
  await Promise.all(
    devices.map(async (device) => {
      const person = device.user_id as string;
      const house = houseOf.get(person);
      if (!house) return;
      const mine = ((tasks ?? []) as Task[]).filter((task) => task.household_id === house && task.assignee_id === person);
      const ours = ((events ?? []) as Event[]).filter((event) => event.household_id === house);
      if (mine.length === 0 && ours.length === 0) return;
      const locale = device.locale === "en" ? "en" : "he";
      const result = await sendApns(
        device.token as string,
        { title: dictionaries[locale].morning.title, body: summary(locale, mine, ours), url: `/${locale}`, collapseId: `morning-${day}` },
        keys,
      );
      if (result === "sent") sent += 1;
      if (result === "gone") await db.from("push_devices").delete().eq("token", device.token);
    }),
  );
  return NextResponse.json({ cleared, sent });
}

async function clearExpiredStories(db: NonNullable<ReturnType<typeof createAdminSupabase>>) {
  const { data } = await db.from("stories").select("id, path").lte("expires_at", new Date().toISOString()).limit(500);
  if (!data?.length) return 0;
  await db.storage.from("house-media").remove(data.map((row) => row.path as string));
  await db.from("stories").delete().in("id", data.map((row) => row.id as string));
  return data.length;
}
