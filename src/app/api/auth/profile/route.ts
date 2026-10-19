import { NextResponse } from "next/server";
import { saveDisplayName } from "@/lib/auth/demo-server";

export async function POST(request: Request) {
  const { userId, displayName } = (await request.json().catch(() => ({}))) as {
    userId?: string;
    displayName?: string;
  };
  if (!userId || !displayName?.trim()) return NextResponse.json({ error: "name" }, { status: 400 });
  const profile = saveDisplayName(userId, displayName);
  if (!profile) return NextResponse.json({ error: "generic" }, { status: 404 });
  return NextResponse.json(profile);
}
