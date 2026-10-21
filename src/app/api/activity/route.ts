import { NextResponse } from "next/server";
import en from "@/i18n/dictionaries/en.json";
import he from "@/i18n/dictionaries/he.json";
import { activityLine, activityPath, isActivityKind } from "@/lib/activity";
import { apnsKeys, sendApns } from "@/lib/push/apns";
import { supabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

const dictionaries = { he, en } as const;

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

  const { data: row, error } = await db
    .from("activity")
    .insert({ household_id: membership.household_id, actor_id: user.id, kind, subject_id: subjectId, title })
    .select("id")
    .single();
  if (error || !row) return NextResponse.json({ error: "generic" }, { status: 400 });

  const keys = apnsKeys();
  if (keys) {
    const { data: devices } = await db.rpc("partner_push_devices");
    const name = profile?.display_name?.trim() || "Homie";
    const results = await Promise.all(
      ((devices ?? []) as { token: string; locale: string }[]).map(async (device) => {
        const locale = device.locale === "en" ? "en" : "he";
        const result = await sendApns(
          device.token,
          {
            title: name,
            body: activityLine(dictionaries[locale].activity.kinds, kind, title),
            url: activityPath(locale, kind),
            collapseId: row.id,
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
