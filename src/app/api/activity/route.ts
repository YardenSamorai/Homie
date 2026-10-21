import { NextResponse } from "next/server";
import en from "@/i18n/dictionaries/en.json";
import he from "@/i18n/dictionaries/he.json";
import { activityLine, activityPath, isActivityKind, type ActivityKind } from "@/lib/activity";
import { notifyKindOf, readPrefs, type Prefs } from "@/lib/prefs";
import { apnsKeys, sendApns } from "@/lib/push/apns";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

const dictionaries = { he, en } as const;

type Db = Awaited<ReturnType<typeof createServerSupabase>>;

/** One parent did something: log it for the bell and tell the other parent's iPhones. */
export async function POST(request: Request) {
  if (!supabaseConfigured()) return NextResponse.json({ error: "generic" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; subjectId?: unknown; title?: unknown };
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 200) : "";
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : null;
  if (!isActivityKind(body.kind) || !title) return NextResponse.json({ error: "generic" }, { status: 400 });
  const kind = body.kind;

  const db = await createServerSupabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "auth" }, { status: 401 });

  const [{ data: membership }, { data: profile }] = await Promise.all([
    db.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle(),
    db.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!membership) return NextResponse.json({ error: "missing" }, { status: 404 });

  const household = membership.household_id;
  const log = (as: ActivityKind) =>
    db.from("activity").insert({ household_id: household, actor_id: user.id, kind: as, subject_id: subjectId, title }).select("id").single();
  let saved = await log(kind);
  // A project without 0007 doesn't know "task_assigned" yet: log it as a plain new task.
  if (saved.error && kind === "task_assigned") saved = await log("task_added");
  const row = saved.data;
  if (saved.error || !row) return NextResponse.json({ error: "generic" }, { status: 400 });

  const keys = apnsKeys();
  if (keys) {
    const { data } = await db.rpc("partner_push_devices");
    const all = (data ?? []) as { token: string; locale: string; user_id?: string }[];
    const name = profile?.display_name?.trim() || "Homie";
    const recipients = await recipientsOf(db, all);
    // Each parent chose in Settings what reaches their phone; the bell still shows everything.
    const devices = all.filter((device) => !device.user_id || recipients.get(device.user_id)?.notify[notifyKindOf(kind)] !== false);
    const badges = await unreadFor(db, household, devices, recipients);
    const results = await Promise.all(
      devices.map(async (device) => {
        const locale = device.locale === "en" ? "en" : "he";
        const result = await sendApns(
          device.token,
          {
            title: name,
            body: activityLine(dictionaries[locale].activity.kinds, kind, title),
            url: activityPath(locale, kind),
            collapseId: row.id,
            badge: device.user_id ? badges.get(device.user_id) : undefined,
          },
          keys,
        );
        return { token: device.token, result };
      }),
    );
    await Promise.all(
      results.filter(({ result }) => result === "gone").map(({ token }) => db.rpc("drop_partner_push_device", { device_token: token })),
    );
  }

  return NextResponse.json({ id: row.id });
}

type Recipient = { seenAt: string | null; notify: Prefs["notify"] };

/** The phones' owners: what they last saw in the bell and what they want to hear about. */
async function recipientsOf(db: Db, devices: { user_id?: string }[]) {
  const people = [...new Set(devices.flatMap((device) => (device.user_id ? [device.user_id] : [])))];
  const found = new Map<string, Recipient>();
  if (people.length === 0) return found;
  type Row = { id: string; activity_seen_at: string | null; prefs?: unknown };
  let rows = (await db.from("profiles").select("id, activity_seen_at, prefs").in("id", people)).data as Row[] | null;
  // A project without 0009 has no prefs yet: everyone hears about everything.
  rows ??= (await db.from("profiles").select("id, activity_seen_at").in("id", people)).data as Row[] | null;
  for (const row of rows ?? []) {
    found.set(row.id, { seenAt: row.activity_seen_at, notify: readPrefs(row.prefs).notify });
  }
  return found;
}

/** The red number on each partner's app icon: what the other parent did since they last opened the bell. */
async function unreadFor(db: Db, household: string, devices: { user_id?: string }[], recipients: Map<string, Recipient>) {
  const people = [...new Set(devices.flatMap((device) => (device.user_id ? [device.user_id] : [])))];
  const counts = new Map<string, number>();
  if (people.length === 0) return counts;
  await Promise.all(
    people.map(async (person) => {
      const seen = recipients.get(person)?.seenAt ?? "1970-01-01T00:00:00Z";
      const { count } = await db
        .from("activity")
        .select("id", { count: "exact", head: true })
        .eq("household_id", household)
        .neq("actor_id", person)
        .gt("created_at", seen);
      if (count !== null) counts.set(person, count);
    }),
  );
  return counts;
}
