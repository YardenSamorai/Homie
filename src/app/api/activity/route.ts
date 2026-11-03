import { NextResponse } from "next/server";
import en from "@/i18n/dictionaries/en.json";
import he from "@/i18n/dictionaries/he.json";
import { activityLine, activityPath, isActivityKind, type ActivityKind } from "@/lib/activity";
import { format } from "@/i18n/format";
import { notifyKindOf, readPrefs, validTimeZone, type Prefs } from "@/lib/prefs";
import { inQuiet, localTime } from "@/lib/routine";
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
    const [recipients, houseZone] = await Promise.all([recipientsOf(db, all), zoneOf(db, household)]);
    const now = new Date();
    // Each parent chose in Settings what reaches their phone; the bell still shows everything. Quiet hours and the
    // digest hold the push back: the cron sums it up afterwards (/api/cron/morning).
    const devices = all.filter((device) => {
      const prefs = device.user_id ? recipients.get(device.user_id)?.prefs : undefined;
      if (!prefs) return true;
      if (!prefs.notify[notifyKindOf(kind)] || prefs.delivery === "digest") return false;
      return !inQuiet(prefs.quiet, localTime(now, prefs.timezone ?? houseZone));
    });
    const burst = kind === "shopping_added" && devices.length > 0 ? await shoppingBurst(db, household, user.id, row.id) : null;
    const badges = await unreadFor(db, household, devices, recipients);
    const results = await Promise.all(
      devices.map(async (device) => {
        const locale = device.locale === "en" ? "en" : "he";
        const copy = dictionaries[locale];
        const result = await sendApns(
          device.token,
          {
            title: name,
            body: burst?.more
              ? format(copy.routine.push.shoppingBurst, { count: burst.titles.length, list: burst.titles.slice(-4).join(", ") })
              : activityLine(copy.activity.kinds, kind, title),
            url: activityPath(locale, kind),
            collapseId: burst?.collapseId ?? row.id,
            quiet: Boolean(burst?.more),
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

type Recipient = { seenAt: string | null; prefs: Prefs | null };

const BURST_MINUTES = 3;

/**
 * Items added to the list one after another: the first one buzzes, the rest replace it quietly with the whole
 * run so far (same collapse id), so a parent filling the list doesn't send ten notifications.
 */
async function shoppingBurst(db: Db, household: string, actor: string, id: string) {
  const since = new Date(Date.now() - BURST_MINUTES * 60_000).toISOString();
  const { data } = await db
    .from("activity")
    .select("id, title")
    .eq("household_id", household)
    .eq("actor_id", actor)
    .eq("kind", "shopping_added")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(20);
  const rows = (data ?? []) as { id: string; title: string }[];
  const first = rows[0]?.id ?? id;
  return { collapseId: `shop-${first}`, titles: rows.map((item) => item.title), more: rows.length > 1 };
}

async function zoneOf(db: Db, household: string) {
  const { data } = await db.from("households").select("timezone").eq("id", household).maybeSingle();
  const zone = (data as { timezone?: string } | null)?.timezone;
  return validTimeZone(zone) ? zone : "Asia/Jerusalem";
}

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
    found.set(row.id, { seenAt: row.activity_seen_at, prefs: "prefs" in row ? readPrefs(row.prefs) : null });
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
