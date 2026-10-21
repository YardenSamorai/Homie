import { NextResponse } from "next/server";
import en from "@/i18n/dictionaries/en.json";
import he from "@/i18n/dictionaries/he.json";
import { activityLine, activityPath, isActivityKind, type ActivityKind } from "@/lib/activity";
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
    const devices = (data ?? []) as { token: string; locale: string; user_id?: string }[];
    const name = profile?.display_name?.trim() || "Homie";
    const badges = await unreadFor(db, household, devices);
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

/** The red number on each partner's app icon: what the other parent did since they last opened the bell. */
async function unreadFor(db: Db, household: string, devices: { user_id?: string }[]) {
  const people = [...new Set(devices.flatMap((device) => (device.user_id ? [device.user_id] : [])))];
  const counts = new Map<string, number>();
  if (people.length === 0) return counts;
  const { data: profiles } = await db.from("profiles").select("id, activity_seen_at").in("id", people);
  await Promise.all(
    people.map(async (person) => {
      const seen = profiles?.find((row) => row.id === person)?.activity_seen_at ?? "1970-01-01T00:00:00Z";
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
