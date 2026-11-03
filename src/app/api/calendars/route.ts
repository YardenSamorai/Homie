import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminOrNull, calendarSetup, signedIn } from "@/lib/calendars/server";
import { disconnectAccount, syncAccount, syncDue, type Account } from "@/lib/calendars/sync";

const SHARING = new Set(["details", "busy", "private"]);

/** The signed-in parent's own accounts and calendars, read under their session (row security keeps it theirs). */
async function overview(db: SupabaseClient) {
  const [{ data: accounts }, { data: calendars }] = await Promise.all([
    db.from("calendar_accounts").select("id, provider, email, status, last_synced_at, last_error, created_at").order("created_at"),
    db
      .from("calendar_sources")
      .select("id, account_id, name, color, is_primary, selected, sharing, together, last_synced_at, last_error, gone_at")
      .order("is_primary", { ascending: false })
      .order("name"),
  ]);
  return {
    setup: calendarSetup(),
    accounts: (accounts ?? []).map((account) => ({
      id: account.id,
      provider: account.provider,
      email: account.email,
      status: account.status,
      lastSyncedAt: account.last_synced_at,
      lastError: account.last_error,
      calendars: (calendars ?? [])
        .filter((calendar) => calendar.account_id === account.id)
        .map((calendar) => ({
          id: calendar.id,
          name: calendar.name,
          color: calendar.color,
          isPrimary: calendar.is_primary,
          selected: calendar.selected,
          sharing: calendar.sharing,
          together: calendar.together,
          lastSyncedAt: calendar.last_synced_at,
          lastError: calendar.last_error,
          gone: Boolean(calendar.gone_at),
        })),
    })),
  };
}

export async function GET() {
  const session = await signedIn();
  if (!session) return NextResponse.json({ setup: calendarSetup(), accounts: [] });
  return NextResponse.json(await overview(session.db));
}

type Body =
  | { action: "choose"; calendarId: string; selected: boolean; sharing: string | null; together: boolean | null }
  | { action: "sync"; scope: "mine" | "house" }
  | { action: "disconnect"; accountId: string };

/**
 * choose:     pick or drop a calendar and say who sees what (the database refuses picking without a choice).
 * sync:       "mine" is the parent's own Sync now; "house" refreshes whatever in the home is out of date.
 * disconnect: removes an account with everything imported from it.
 */
export async function POST(request: Request) {
  const session = await signedIn();
  if (!session) return NextResponse.json({ error: "auth" }, { status: 401 });
  const admin = adminOrNull();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as Body | null;
  const { db, user } = session;

  if (body?.action === "choose") {
    if (typeof body.calendarId !== "string" || typeof body.selected !== "boolean") return NextResponse.json({ error: "bad" }, { status: 400 });
    if (body.sharing !== null && !SHARING.has(body.sharing)) return NextResponse.json({ error: "bad" }, { status: 400 });
    const { error } = await db.rpc("choose_calendar", {
      calendar_id: body.calendarId,
      pick: body.selected,
      share: body.sharing,
      shared_by_house: typeof body.together === "boolean" ? body.together : null,
    });
    if (error) return NextResponse.json({ error: error.message.includes("sharing") ? "sharing" : "missing" }, { status: 400 });
    if (body.selected) {
      const { data: calendar } = await db.from("calendar_sources").select("account_id").eq("id", body.calendarId).maybeSingle();
      if (calendar) await syncAccount(admin, calendar.account_id as string, 5_000);
    }
    return NextResponse.json(await overview(db));
  }

  if (body?.action === "sync") {
    if (body.scope === "house") {
      const { data: me } = await db.from("household_members").select("household_id").eq("user_id", user.id).maybeSingle();
      if (me) {
        const { data: members } = await db.from("household_members").select("user_id").eq("household_id", me.household_id);
        await syncDue(admin, { userIds: (members ?? []).map((row) => row.user_id as string), olderThanMs: 10 * 60_000, limit: 4 });
      }
      return NextResponse.json({ ok: true });
    }
    const { data: mine } = await db.from("calendar_accounts").select("id");
    for (const account of mine ?? []) await syncAccount(admin, account.id as string, 20_000);
    return NextResponse.json(await overview(db));
  }

  if (body?.action === "disconnect") {
    const { data: account } = await db
      .from("calendar_accounts")
      .select("id, user_id, provider, subject, email, status")
      .eq("id", body.accountId)
      .maybeSingle();
    if (!account || account.user_id !== user.id) return NextResponse.json({ error: "missing" }, { status: 404 });
    await disconnectAccount(admin, account as Account);
    return NextResponse.json(await overview(db));
  }

  return NextResponse.json({ error: "bad" }, { status: 400 });
}
