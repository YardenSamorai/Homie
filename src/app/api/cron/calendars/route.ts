import { NextResponse } from "next/server";
import { adminOrNull } from "@/lib/calendars/server";
import { syncDue } from "@/lib/calendars/sync";

/**
 * Every 15 minutes (.github/workflows/calendars.yml): connected calendars that haven't synced in that time are read
 * again, incrementally. Opening the app does the same for the house, so this only keeps a quiet home fresh.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "auth" }, { status: 401 });
  }
  const admin = adminOrNull();
  if (!admin) return NextResponse.json({ skipped: "calendars are not set up on this server" });
  const outcomes = await syncDue(admin, { olderThanMs: 14 * 60_000, limit: 25 });
  return NextResponse.json({
    synced: outcomes.filter((outcome) => outcome === "synced").length,
    failed: outcomes.filter((outcome) => outcome === "failed").length,
    reauth: outcomes.filter((outcome) => outcome === "reauth").length,
  });
}
